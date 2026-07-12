/**
 * broker/puma-ws2-client.ts
 * Cliente WebSocket para candles históricos do WS2 (wsmt5.pumabroker.com).
 *
 * Duas formas de conectar:
 *   1. DIRETA (padrão): conecta em wss://wsmt5.pumabroker.com/ com o
 *      JWT accessToken enviado como cookie server_name_session
 *      (headers em Node.js/Bun, document.cookie no browser).
 *   2. PROXY (useProxy:true): conecta via proxy local ws://127.0.0.1:3002.
 *      Necessário quando o runtime não suporta headers customizados em WebSocket.
 *
 * Protocolo (descoberto via DevTools):
 *   Subscribe: {"method":"subscribe","params":{"symbols":["BETHUSDT"],"intervals":["1"]}}
 *   Recebe: {"type":"bar_update","symbol":"BETHUSDT","interval":"1",
 *            "bar":{"time":...,"open":...,"high":...,"low":...,"close":...,"volume":...}}
 *   Heartbeat: {"method":"server_time"}
 *   Histórico: {"method":"history","params":{"symbol":"BETHUSDT","interval":"1","count":200}}
 *
 * DEBUG MODE: Pass debug:true nas options para logar TODAS as mensagens
 * enviadas/recebidas (primeiros 1000 chars). Logs vão para console + engineLogger.
 */

import type { Candle } from "../market/types";
import { engineLogger } from "../engine/logger";

const WS2_PROXY_URL = "ws://127.0.0.1:3002";
const WS2_DIRECT_URL = "wss://wsmt5.pumabroker.com/";
const HEARTBEAT_INTERVAL = 10_000;
const RECONNECT_BASE_DELAY = 3_000;
const RECONNECT_MAX_DELAY = 60_000;
const DEBUG_MSG_LIMIT = 1000;
const CANDLE_TIMEOUT_MS = 15_000;
const MIN_REQUIRED_CANDLES = 70;
const AUTH_RECONNECT_DELAY = 3_000;
const MAX_CONSECUTIVE_AUTH_ERRORS = 5;
const AUTH_ERROR_DEBOUNCE_MS = 2_000;

export interface Ws2BarUpdate {
  type: "bar_update";
  symbol: string;
  interval: string;
  bar: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
  last_bar?: Record<string, unknown>;
}

export interface PumaWs2ClientOptions {
  sessionToken: string;
  assets: string[];
  interval?: string;
  debug?: boolean;
  historyCount?: number;
  useProxy?: boolean;
  onCandle?: (symbol: string, candle: Candle) => void;
  onBufferReady?: (symbol: string, count: number) => void;
  /** Chamado quando o JWT accessToken expirou. Deve retornar um novo accessToken. */
  onRefreshToken?: () => Promise<string>;
  /** TTL em ms do cookie server_name_session (default: 55min). Usado para refresh preventivo. */
  tokenTtlMs?: number;
  /** Chamado quando a autenticação falha de forma não-recuperável (daemon bloqueado ou refresh esgotado). */
  onAuthError?: (message: string) => void;
}

export class PumaWs2Client {
  private _ws: WebSocket | null = null;
  private _options: PumaWs2ClientOptions;
  private _connected = false;
  private _running = false;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectCount = 0;
  private _refreshCount = 0;
  private readonly _MAX_RECONNECT_BEFORE_REFRESH = 3;
  private readonly _REFRESH_COOLDOWN_MS = 10_000; // Cooldown mínimo entre refreshes sequenciais (ms)
  private _isRefreshing = false;
  private _consecutiveAuthErrors = 0;
  private _lastAuthErrorTime = 0;
  private _lastRefreshTime = 0; // Timestamp do último refresh (sucesso ou falha)
  private _candleCount = new Map<string, number>();
  private _readySymbols = new Set<string>();

  /* ── Debug state ──────────────────────────────────────────────────────────── */
  private _debug: boolean;
  private _historyCount: number;
  private _msgSentCount = 0;
  private _msgRecvCount = 0;
  private _totalCandleCount = 0;
  private _symbolCandleCount = new Map<string, number>();
  private _lastEvent: string | null = null;
  private _lastRawReceived: string | null = null;
  private _candleTimeout: ReturnType<typeof setTimeout> | undefined;
  private _refreshTokenTimer: ReturnType<typeof setTimeout> | null = null;
  private _timeline: string[] = [];

  constructor(options: PumaWs2ClientOptions) {
    this._options = options;
    this._debug = options.debug ?? false;
    this._historyCount = options.historyCount ?? 200;
  }

  get connected(): boolean {
    return this._connected;
  }

  getCandleCount(symbol: string): number {
    return this._candleCount.get(symbol.toUpperCase()) ?? 0;
  }

  isReady(symbol: string): boolean {
    return this._readySymbols.has(symbol.toUpperCase());
  }

  /* ── Debug helpers ─────────────────────────────────────────────────────────── */

  private _dlog(level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string): void {
    if (!this._debug) return;
    const tag = "WS2_DEBUG";
    switch (level) {
      case "INFO":
        engineLogger.info(tag, msg, {});
        break;
      case "DEBUG":
        engineLogger.debug(tag, msg, {});
        break;
      case "WARN":
        engineLogger.warn(tag, msg, {});
        break;
      case "ERROR":
        engineLogger.error(tag, msg, {});
        break;
    }
  }

  private _timelineAdd(entry: string): void {
    if (!this._debug) return;
    this._timeline.push(`[${this._timeline.length + 1}] ${entry}`);
  }

  private _trunc(raw: string): string {
    return raw.length > DEBUG_MSG_LIMIT
      ? raw.slice(0, DEBUG_MSG_LIMIT) + `... [${raw.length} chars total]`
      : raw;
  }

  /* ── Public API ────────────────────────────────────────────────────────────── */

  connect(): void {
    if (this._connected || this._running) return;
    this._running = true;
    this._doConnect();
  }

  disconnect(): void {
    this._running = false;
    this._isRefreshing = false;
    this._consecutiveAuthErrors = 0;
    this._clearTimers();
    this._clearRefreshTimer();
    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      this._ws.onclose = null;
      try {
        this._ws.close();
      } catch {
        /* ignore */
      }
      this._ws = null;
    }
    this._connected = false;
    this._dlog("INFO", "Desconectado");
  }

  /** Atualiza o token/cookie e reconecta. */
  updateSessionToken(token: string): void {
    this._options.sessionToken = token;
    this._dlog("INFO", `═══ TOKEN ATUALIZADO ═══`);
    this._timelineAdd("TOKEN RENEWED");
    this.disconnect();
    this._reconnectCount = 0;
    this.connect();
  }

  updateAssets(assets: string[]): void {
    this._options.assets = [...assets];
    if (this._connected) this._subscribe();
  }

  getTimeline(): string[] {
    return [...this._timeline];
  }

  /* ── Conexão ─────────────────────────────────────────────────────────────── */

  private _doConnect(): void {
    // Se já foi desconectado durante um delay, não cria nova conexão
    if (!this._running) {
      this._dlog("WARN", "_doConnect: _running=false — abortando");
      return;
    }

    // Fecha conexão anterior ANTES de criar nova (evita vazamento de sockets)
    if (this._ws) {
      try {
        this._ws.onopen = null;
        this._ws.onmessage = null;
        this._ws.onerror = null;
        this._ws.onclose = null;
        if (
          this._ws.readyState === WebSocket.OPEN ||
          this._ws.readyState === WebSocket.CONNECTING
        ) {
          this._ws.close();
        }
      } catch {
        /* ignora */
      }
      this._ws = null;
    }
    this._connected = false;

    try {
      const token = this._options.sessionToken;
      const useProxy = this._options.useProxy ?? false;

      // Log do valor exato do token sendo enviado
      const tokenPreview = token ? `${token.slice(0, 20)}... (len=${token.length})` : "NULL";
      engineLogger.info("PumaWs2Client", `═══ _doConnect: token=${tokenPreview} | useProxy=${useProxy} ═══`, {
        tokenLength: token?.length ?? 0,
        assets: this._options.assets.join(", "),
      });

      if (useProxy) {
        const url = `${WS2_PROXY_URL}?token=${encodeURIComponent(token)}`;
        this._dlog("INFO", `═══ CONECTANDO AO PROXY WS2 ═══`);
        this._dlog("INFO", `URL: ${WS2_PROXY_URL}`);
        this._dlog("INFO", `Assets: ${this._options.assets.join(", ")}`);
        this._timelineAdd("CONNECT (proxy)");
        this._ws = new WebSocket(url);
      } else {
        this._dlog("INFO", `═══ CONECTANDO DIRETO AO WS2 ═══`);
        this._dlog("INFO", `URL: ${WS2_DIRECT_URL}`);
        this._dlog("INFO", `Token: ${token.slice(0, 20)}...`);
        this._dlog("INFO", `Assets: ${this._options.assets.join(", ")}`);
        this._timelineAdd("CONNECT (direct)");

        // Tenta setar cookie no browser para o domínio do WS2
        try {
          document.cookie = `server_name_session=${token}; path=/; domain=.pumabroker.com; secure; samesite=lax`;
        } catch {
          /* ignora se não for browser */
        }

        // Tenta com headers (Node.js 21+, Bun, Deno)
        try {
          const WebSocketWithHeaders = WebSocket as unknown as {
            new (
              url: string,
              protocols: string | string[],
              options: { headers: Record<string, string> },
            ): WebSocket;
          };
          this._ws = new WebSocketWithHeaders(WS2_DIRECT_URL, [], {
            headers: {
              Cookie: `server_name_session=${token}`,
              Origin: "https://trade.pumabroker.com",
            },
          });
          this._dlog("INFO", "WebSocket criado com headers (Node.js/Bun)");
        } catch {
          // Fallback: browser (confia que o cookie foi setado)
          this._ws = new WebSocket(WS2_DIRECT_URL);
          this._dlog("INFO", "WebSocket criado sem headers (browser)");
        }
      }

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectCount = 0;
        this._dlog("INFO", "═══ WS2 CONECTADO ═══");
        this._timelineAdd("OPEN");

        this._subscribe();
        this._startHeartbeat();
        this._startCandleTimeout();
        this._schedulePeriodicRefresh();
      };

      this._ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this._ws.onerror = (event) => {
        this._dlog("ERROR", `Erro WebSocket: ${String(event)}`);
        this._timelineAdd("ERROR");
      };

      this._ws.onclose = (event) => {
        const wasConnected = this._connected;
        this._connected = false;
        this._clearTimers();

        if (wasConnected) {
          this._dlog("WARN", `Desconectado code=${event.code} reason=${event.reason || "none"}`);
          this._timelineAdd(`CLOSE code=${event.code}`);
        }

        // Códigos de fechamento que indicam auth expirado
        const authCodes = [4001, 4003, 401, 4005, 4009, 4401];
        const isAuthError = authCodes.includes(event.code);

        if (isAuthError) {
          if (this._isRefreshing) {
            this._dlog(
              "WARN",
              "═══ FALHA DE AUTENTICAÇÃO — refresh já em andamento, ignorando onclose ═══",
            );
            return;
          }
          this._dlog("WARN", "═══ FALHA DE AUTENTICAÇÃO — renovando token ═══");
          this._timelineAdd("AUTH ERROR CLOSE — refresh");
          this._consecutiveAuthErrors++;
          this._refreshTokenAndReconnect();
        } else if (this._running) {
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      this._dlog("ERROR", `Falha ao criar WebSocket: ${String(err)}`);
      if (this._running) this._scheduleReconnect();
    }
  }

  /* ── Inscrição ───────────────────────────────────────────────────────────── */

  private _subscribe(): void {
    if (!this._connected) return;

    const interval = this._options.interval ?? "1";
    const payload = {
      method: "subscribe",
      params: {
        symbols: this._options.assets,
        intervals: [interval],
      },
    };

    this._dlog("INFO", "═══ SUBSCRIBE ENVIADO ═══");
    this._dlog("INFO", `Payload: ${JSON.stringify(payload)}`);
    this._timelineAdd(`SUBSCRIBE → ${this._options.assets.join(",")} interval=${interval}`);

    this._send(payload);

    engineLogger.info("PumaWs2Client", "═══ SUBSCRIBE ENVIADO ═══", {
      symbols: this._options.assets.join(", "),
      interval,
    });

    // Histórico — enviar para cada ativo após subscribe
    for (const asset of this._options.assets) {
      setTimeout(() => {
        this._sendHistoryRequest(asset, interval);
      }, 500);
    }
  }

  private _sendHistoryRequest(symbol: string, interval: string): void {
    if (!this._connected) return;

    this._dlog("INFO", `═══ REQUISITANDO HISTÓRICO: ${symbol} ═══`);
    this._timelineAdd(`HISTORY REQ → ${symbol} interval=${interval} count=${this._historyCount}`);

    this._send({
      method: "history",
      params: {
        symbol,
        interval,
        count: this._historyCount,
      },
    });

    engineLogger.info("PumaWs2Client", `═══ HISTÓRICO REQUISITADO: ${symbol} ═══`, {
      symbol,
      interval,
      count: this._historyCount,
    });
  }

  /* ── Heartbeat ───────────────────────────────────────────────────────────── */

  private _startHeartbeat(): void {
    this._clearTimers();
    this._heartbeatTimer = setInterval(() => {
      this._send({ method: "server_time" });
      this._dlog("DEBUG", "→ HEARTBEAT server_time");
    }, HEARTBEAT_INTERVAL);
  }

  /* ── Mensagens ───────────────────────────────────────────────────────────── */

  private _handleMessage(raw: string): void {
    this._msgRecvCount++;
    this._lastRawReceived = raw;

    this._dlog("DEBUG", `══════════════════════════════════════`);
    this._dlog("DEBUG", `← MSG #${this._msgRecvCount} [${raw.length} chars]:`);
    this._dlog("DEBUG", this._trunc(raw));
    this._dlog("DEBUG", `══════════════════════════════════════`);

    try {
      const data = JSON.parse(raw);
      const msgType = data.type || data.method || "(no type)";
      this._lastEvent = msgType;

      this._dlog("INFO", `Tipo: ${msgType}`);

      if (msgType === "bar_update") {
        this._dlog(
          "INFO",
          `bar_update: symbol=${data.symbol} interval=${data.interval} time=${data.bar?.time} close=${data.bar?.close}`,
        );
        this._timelineAdd(`BAR_UPDATE ${data.symbol} close=${data.bar?.close}`);
        this._handleBarUpdate(data as Ws2BarUpdate);
      } else if (msgType === "server_time") {
        this._dlog("DEBUG", `server_time response: timestamp=${data.timestamp}`);
        this._timelineAdd("HEARTBEAT OK");
      } else if (msgType === "error" || msgType === "error_message") {
        const errMsg = data.message ?? data.msg ?? JSON.stringify(data);
        this._dlog("WARN", `═══ ★ ERRO DO SERVIDOR: ${errMsg} ★ ═══`);
        this._timelineAdd(`SERVER ERROR: ${data.message ?? data.msg ?? "?"}`);
        engineLogger.error("PumaWs2Client", "Erro do servidor WS2", {
          message: errMsg,
          code: data.code,
          full: JSON.stringify(data).slice(0, 500),
        });

        // "Not authenticated" → token expirou/inválido → renova e reconecta
        if (
          errMsg.toLowerCase().includes("not authenticated") ||
          errMsg.toLowerCase().includes("auth")
        ) {
          const now = Date.now();
          if (now - this._lastAuthErrorTime < AUTH_ERROR_DEBOUNCE_MS) {
            this._dlog(
              "WARN",
              `═══ ★ TOKEN REJEITADO — ignorado (debounce ${AUTH_ERROR_DEBOUNCE_MS}ms) ★ ═══`,
            );
            return;
          }
          this._lastAuthErrorTime = now;
          this._consecutiveAuthErrors++;
          this._dlog(
            "WARN",
            `═══ ★ TOKEN REJEITADO — renovando... (erro consecutivo #${this._consecutiveAuthErrors}) ★ ═══`,
          );
          this._timelineAdd("AUTH ERROR VIA MSG — REFRESH");
          this._clearTimers();
          this._refreshTokenAndReconnect().catch((err) => {
            engineLogger.error("PumaWs2Client", "Falha ao renovar token após erro de auth", {
              error: String(err),
            });
          });
        }
      } else if (this._isHistoryResponse(msgType, data)) {
        this._handleHistoryResponse(data);
      } else {
        // QUALQUER OUTRO TIPO — logar COMPLETO
        const fullStr = JSON.stringify(data).slice(0, 1000);
        this._dlog("WARN", `═══ MSG DESCONHECIDA: ${msgType} ═══`);
        this._dlog("WARN", `Conteúdo completo: ${fullStr}`);
        this._timelineAdd(`UNKNOWN: ${msgType}`);

        // Tenta detectar se é erro disfarçado
        if (data.error || data.err || data.code) {
          engineLogger.error("PumaWs2Client", "Possível erro em mensagem desconhecida", {
            type: msgType,
            error: data.error ?? data.err,
            code: data.code,
            full: fullStr,
          });
        }

        // Possíveis eventos de histórico
        const knownHistory = ["history", "bars", "candles", "ohlc", "kline", "chart", "snapshot"];
        if (knownHistory.some((k) => msgType.toLowerCase().includes(k))) {
          this._dlog("INFO", `═══ ★ EVENTO DE HISTÓRICO DETECTADO: ${msgType} ★ ═══`);
          this._dlog("INFO", `Dados: ${fullStr}`);
        }
      }
    } catch {
      this._dlog("WARN", `Frame não-JSON: ${raw.slice(0, 500)}`);
      this._timelineAdd(`NON-JSON [${raw.length} chars]`);
    }
  }

  private _isHistoryResponse(msgType: string, data: Record<string, unknown>): boolean {
    const types = ["history", "bars", "candles", "ohlc", "kline", "chart", "snapshot"];
    if (types.some((t) => msgType.toLowerCase().includes(t))) return true;
    if (data.type && types.some((t) => String(data.type).toLowerCase().includes(t))) return true;
    if (data.bars || data.candles || data.data) return true;
    return false;
  }

  private _handleHistoryResponse(data: Record<string, unknown>): void {
    const symbol = (data.symbol ?? data.s ?? "") as string;
    if (!symbol) {
      this._dlog("WARN", "Histórico sem symbol — ignorando");
      return;
    }
    const upperSymbol = symbol.toUpperCase();
    const bars = (data.bars ?? data.candles ?? data.data ?? data.bar ?? []) as Record<
      string,
      unknown
    >[];

    if (!Array.isArray(bars) || bars.length === 0) {
      this._dlog("WARN", `Histórico vazio para ${upperSymbol}`);
      this._timelineAdd(`HISTORY EMPTY: ${upperSymbol}`);
      return;
    }

    this._dlog("INFO", `═══ ★ HISTÓRICO RECEBIDO: ${upperSymbol} (${bars.length} candles) ★ ═══`);
    this._timelineAdd(`HISTORY RECV: ${upperSymbol} count=${bars.length}`);

    engineLogger.info("PumaWs2Client", `═══ ★ HISTÓRICO RECEBIDO: ${upperSymbol} ═══`, {
      count: bars.length,
    });

    let processedCount = 0;
    for (const bar of bars) {
      const open = parseFloat(String(bar.open ?? bar.o ?? "0"));
      const high = parseFloat(String(bar.high ?? bar.h ?? "0"));
      const low = parseFloat(String(bar.low ?? bar.l ?? "0"));
      const close = parseFloat(String(bar.close ?? bar.c ?? "0"));
      const volume = parseFloat(String(bar.volume ?? bar.v ?? "0"));
      const rawTime = (bar.time ?? bar.t ?? 0) as number;
      const time = this._toMs(rawTime);
      if (!time || close <= 0) continue;

      const candle: Candle = {
        time,
        open,
        high,
        low,
        close,
        volume,
        asset: upperSymbol,
      };

      this._options.onCandle?.(upperSymbol, candle);
      processedCount++;

      const count = (this._candleCount.get(upperSymbol) ?? 0) + 1;
      this._candleCount.set(upperSymbol, count);
      this._totalCandleCount++;
    }

    engineLogger.info("PumaWs2Client", `[MONITOR] Histórico processado: ${upperSymbol}`, {
      received: bars.length,
      processed: processedCount,
      totalInBuffer: this._candleCount.get(upperSymbol) ?? 0,
    });

    const finalCount = this._candleCount.get(upperSymbol) ?? 0;
    if (finalCount >= MIN_REQUIRED_CANDLES && !this._readySymbols.has(upperSymbol)) {
      this._readySymbols.add(upperSymbol);
      this._dlog("INFO", `═══ ★ BUFFER PRONTO: ${upperSymbol} (${finalCount} candles) ★ ═══`);
      this._timelineAdd(`BUFFER READY: ${upperSymbol} (${finalCount})`);
      this._options.onBufferReady?.(upperSymbol, finalCount);
    }
  }

  /** Converte timestamp segundos → ms se necessário */
  private _toMs(time: number): number {
    return time < 1e12 ? time * 1000 : time;
  }

  private _handleBarUpdate(data: Ws2BarUpdate): void {
    const { symbol, bar } = data;
    if (!symbol || !bar || bar.close <= 0) return;

    const upperSymbol = symbol.toUpperCase();
    const timeMs = this._toMs(bar.time);

    const candle: Candle = {
      time: timeMs,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      asset: upperSymbol,
    };

    // Contadores
    this._totalCandleCount++;
    const symCount = (this._symbolCandleCount.get(upperSymbol) ?? 0) + 1;
    this._symbolCandleCount.set(upperSymbol, symCount);

    const count = (this._candleCount.get(upperSymbol) ?? 0) + 1;
    this._candleCount.set(upperSymbol, count);

    this._dlog(
      "INFO",
      `📊 Candle #${this._totalCandleCount} (${upperSymbol} #${symCount}): close=${candle.close.toFixed(5)} time=${new Date(candle.time).toISOString()}`,
    );

    // Cancela timeout no primeiro candle
    if (this._totalCandleCount === 1) {
      this._clearCandleTimeout();
      this._dlog("INFO", "═══ ★ PRIMEIRO CANDLE CHEGOU ★ ═══");
      this._timelineAdd("FIRST CANDLE");
    }

    // Log periódico por símbolo
    if (count <= 5 || count % 20 === 0) {
      engineLogger.info("PumaWs2Client", `📊 Candle #${count}: ${upperSymbol}`, {
        close: candle.close.toFixed(5),
        time: new Date(candle.time).toISOString(),
      });
    }

    // Callback
    this._options.onCandle?.(upperSymbol, candle);

    // Buffer pronto
    if (count >= MIN_REQUIRED_CANDLES && !this._readySymbols.has(upperSymbol)) {
      this._readySymbols.add(upperSymbol);
      this._dlog("INFO", `═══ ★ BUFFER PRONTO: ${upperSymbol} (${count} candles) ★ ═══`);
      this._timelineAdd(`BUFFER READY: ${upperSymbol} (${count})`);
      this._options.onBufferReady?.(upperSymbol, count);
    }

    // Log de resumo a cada 10 candles
    if (this._totalCandleCount % 10 === 0) {
      this._dlog("INFO", `═══ RESUMO: ${this._totalCandleCount} candles totais ═══`);
      for (const [sym, cnt] of this._symbolCandleCount) {
        this._dlog("INFO", `  ${sym}: ${cnt} candles`);
      }
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  private _send(data: Record<string, unknown>): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify(data);

    this._msgSentCount++;
    this._dlog("DEBUG", `→ SEND #${this._msgSentCount}: ${this._trunc(payload)}`);
    this._timelineAdd(`SEND ${data.method || data.type || "?"}`);

    try {
      this._ws.send(payload);
    } catch (err) {
      this._dlog("ERROR", `Send error: ${String(err)}`);
    }
  }

  private _scheduleReconnect(): void {
    if (!this._running) return;

    // Se já está em refresh, não agenda mais nada
    if (this._isRefreshing) {
      this._dlog("WARN", "_scheduleReconnect: refresh já em andamento — ignorando");
      return;
    }

    // Se excedeu o limite de reconexões sem sucesso, tenta refresh do token
    if (this._reconnectCount >= this._MAX_RECONNECT_BEFORE_REFRESH) {
      this._refreshTokenAndReconnect();
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this._reconnectCount),
      RECONNECT_MAX_DELAY,
    );
    this._reconnectCount++;

    this._dlog(
      "INFO",
      `Reconectando em ${(delay / 1000).toFixed(0)}s... (attempt ${this._reconnectCount})`,
    );
    this._timelineAdd(`RECONNECT in ${(delay / 1000).toFixed(0)}s`);

    this._reconnectTimer = setTimeout(() => {
      this._doConnect();
    }, delay);
  }

  private async _refreshTokenAndReconnect(): Promise<void> {
    if (!this._running) return;

    // Guarda de reentrância: evita múltiplas renovações concorrentes
    if (this._isRefreshing) {
      this._dlog("WARN", "═══ Refresh já em andamento — ignorando chamada concorrente ═══");
      return;
    }

    // Cooldown: evita refreshes sequenciais muito próximos (throttling client-side)
    const now = Date.now();
    const timeSinceLastRefresh = now - this._lastRefreshTime;
    if (timeSinceLastRefresh < this._REFRESH_COOLDOWN_MS) {
      const waitMs = this._REFRESH_COOLDOWN_MS - timeSinceLastRefresh;
      this._dlog(
        "WARN",
        `═══ REFRESH BLOQUEADO (cooldown ${waitMs}ms) — último refresh há ${timeSinceLastRefresh}ms ═══`,
      );
      this._timelineAdd(`REFRESH BLOCKED cooldown=${waitMs}ms`);
      // Agenda nova tentativa após o cooldown
      setTimeout(() => {
        if (this._running) this._refreshTokenAndReconnect();
      }, waitMs);
      return;
    }

    // Marca como "em refresh" IMEDIATAMENTE para travar chamadas concorrentes
    // durante toda a duração (circuit breaker + refresh HTTP + delay)
    this._isRefreshing = true;
    this._lastRefreshTime = now; // Marca timestamp ANTES de iniciar para evitar race
    this._dlog("INFO", `═══ RENOVANDO TOKEN WS2 (tentativa ${this._refreshCount + 1}) ═══`);
    this._timelineAdd("REFRESH TOKEN");

    // Circuit breaker: muitas falhas consecutivas de auth → pausa e avisa
    if (this._consecutiveAuthErrors >= MAX_CONSECUTIVE_AUTH_ERRORS) {
      const pauseMs = Math.min(
        RECONNECT_BASE_DELAY *
          Math.pow(2, this._consecutiveAuthErrors - MAX_CONSECUTIVE_AUTH_ERRORS),
        RECONNECT_MAX_DELAY,
      );
      engineLogger.error(
        "PumaWs2Client",
        `═══ CIRCUIT BREAKER ABERTO: ${this._consecutiveAuthErrors} erros consecutivos de auth — pausando ${(pauseMs / 1000).toFixed(0)}s ═══`,
        {
          consecutiveErrors: this._consecutiveAuthErrors,
          pauseSeconds: (pauseMs / 1000).toFixed(1),
          maxAllowed: MAX_CONSECUTIVE_AUTH_ERRORS,
        },
      );
      this._dlog(
        "ERROR",
        `═══ ★ CIRCUIT BREAKER ABERTO: ${this._consecutiveAuthErrors} erros — pausa ${(pauseMs / 1000).toFixed(0)}s ★ ═══`,
      );
      this._timelineAdd(`CIRCUIT BREAKER OPEN ${(pauseMs / 1000).toFixed(0)}s`);
      this._consecutiveAuthErrors = 0;
      await new Promise((r) => setTimeout(r, pauseMs));
      engineLogger.info("PumaWs2Client", `═══ CIRCUIT BREAKER FECHADO — retomando reconexão ═══`, {
        pausedForSeconds: (pauseMs / 1000).toFixed(1),
      });
      this._dlog("INFO", "═══ CIRCUIT BREAKER FECHADO — retomando reconexão ═══");
      this._timelineAdd("CIRCUIT BREAKER CLOSED");
    }

    try {
      const onRefresh = this._options.onRefreshToken;
      if (!onRefresh) {
        this._dlog("WARN", "onRefreshToken não configurado — tentando reconectar com token atual");
        this._isRefreshing = false;
        this._scheduleReconnect();
        return;
      }

      this._refreshCount++;
      const newToken = await onRefresh();
      if (newToken && newToken !== this._options.sessionToken) {
        this._options.sessionToken = newToken;
        this._dlog("INFO", "═══ TOKEN RENOVADO COM SUCESSO ═══");
        this._timelineAdd("TOKEN REFRESHED");
      }
    } catch (err) {
      const errMsg = String(err);
      this._dlog("ERROR", `Falha ao renovar token: ${errMsg}`);
      this._timelineAdd("REFRESH FAILED");

      // DAEMON_CIRCUIT_BREAKER ou DAEMON_REFRESH_FAILED → não adianta tentar de novo
      // Sinaliza pro usuário via onAuthError + log e interrompe o ciclo de reconexão
      if (errMsg.includes("DAEMON_CIRCUIT_BREAKER") || errMsg.includes("DAEMON_REFRESH_FAILED")) {
        const isBreaker = errMsg.includes("DAEMON_CIRCUIT_BREAKER");
        const userMsg = isBreaker
          ? "Servidor de autenticação temporariamente bloqueado. Faça login manualmente para restabelecer a conexão."
          : `Falha na autenticação — ${errMsg.replace(/^DAEMON_\w+:\s*/, "")}`;

        engineLogger.error(
          "PumaWs2Client",
          `═══ ${isBreaker ? "DAEMON BLOQUEADO POR CIRCUIT BREAKER" : "REFRESH ESGOTOU TENTATIVAS"} — suspendendo reconexão automática ═══`,
          { error: errMsg },
        );
        this._dlog("ERROR", `═══ ★ ${userMsg} ★ ═══`);
        this._timelineAdd(
          isBreaker ? "DAEMON CIRCUIT BREAKER — STOP" : "DAEMON REFRESH FAILED — STOP",
        );

        this._options.onAuthError?.(userMsg);
        this._isRefreshing = false;
        return;
      }
    }

    // Delay MÍNIMO antes de reconectar após erro de auth (evita loop insano)
    // Mantém _isRefreshing=true durante o delay para bloquear novos ciclos
    this._dlog(
      "INFO",
      `Aguardando ${(AUTH_RECONNECT_DELAY / 1000).toFixed(0)}s antes de reconectar...`,
    );
    this._timelineAdd(`AUTH RECONNECT DELAY ${(AUTH_RECONNECT_DELAY / 1000).toFixed(0)}s`);
    await new Promise((r) => setTimeout(r, AUTH_RECONNECT_DELAY));

    this._isRefreshing = false;
    this._reconnectCount = 0;
    this._doConnect();
  }

  private _startCandleTimeout(): void {
    this._clearCandleTimeout();
    if (!this._debug) return;

    this._candleTimeout = setTimeout(() => {
      if (this._totalCandleCount === 0) {
        const detail = [
          "═══════════════════════════════════════════════════",
          "═══ ★ TIMEOUT: NENHUM CANDLE EM 15s ★ ═══",
          "═══════════════════════════════════════════════════",
          `Último evento: ${this._lastEvent || "NENHUM"}`,
          `Mensagens recebidas: ${this._msgRecvCount}`,
          `Mensagens enviadas: ${this._msgSentCount}`,
          `Última msg raw:`,
          this._lastRawReceived || "(nenhuma)",
          "",
          "Possíveis causas:",
          "  1. Token/cookie inválido — WS2 rejeitou",
          "  2. Subscribe não foi enviado",
          "  3. Servidor WS2 não responde",
          "  4. Proxy não conectou ao wsmt5.pumabroker.com",
          "",
          "Timeline:",
          ...this._timeline,
          "═══════════════════════════════════════════════════",
        ].join("\n");
        this._dlog("WARN", detail);
      }
    }, CANDLE_TIMEOUT_MS);
  }

  private _clearCandleTimeout(): void {
    if (this._candleTimeout) {
      clearTimeout(this._candleTimeout);
      this._candleTimeout = undefined;
    }
  }

  private _clearTimers(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._clearCandleTimeout();
    this._clearRefreshTimer();
  }

  /** Agenda refresh preventivo do token antes da expiração (default: 5min antes do TTL). */
  private _schedulePeriodicRefresh(): void {
    this._clearRefreshTimer();
    if (!this._options.onRefreshToken) return;

    const ttlMs = this._options.tokenTtlMs ?? 55 * 60 * 1000; // 55 min default
    const refreshBefore = 5 * 60 * 1000; // 5 min antes
    const delay = Math.max(ttlMs - refreshBefore, refreshBefore);

    this._dlog("INFO", `Refresh preventivo agendado em ${(delay / 60000).toFixed(0)}min`);
    this._timelineAdd(`REFRESH SCHEDULED in ${(delay / 60000).toFixed(0)}min`);

    this._refreshTokenTimer = setTimeout(async () => {
      this._dlog("INFO", "═══ REFRESH PREVENTIVO DO TOKEN ═══");
      this._timelineAdd("PERIODIC REFRESH");
      await this._refreshTokenAndReconnect();
    }, delay);
  }

  private _clearRefreshTimer(): void {
    if (this._refreshTokenTimer) {
      clearTimeout(this._refreshTokenTimer);
      this._refreshTokenTimer = null;
    }
  }
}
