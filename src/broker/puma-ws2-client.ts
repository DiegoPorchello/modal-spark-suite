/**
 * broker/puma-ws2-client.ts
 * Cliente WebSocket para candles do WS2 (wsmt5.pumabroker.com).
 *
 * O proxy WS2 (ws_proxy.py) gerencia:
 *   - Conexão em wss://wsmt5.pumabroker.com/
 *   - Envio da mensagem AUTH com chave estática
 *   - Encaminhamento bidirecional das mensagens
 *
 * Este cliente conecta no proxy local ws://127.0.0.1:3002
 * e encaminha todas as mensagens recebidas/enviadas com logs detalhados
 * para descobrir o protocolo real utilizado.
 */

import type { Candle } from "../market/types";
import { engineLogger } from "../engine/logger";

const WS2_PROXY_URL = "ws://127.0.0.1:3002";
const HEARTBEAT_INTERVAL = 10_000;
const RECONNECT_BASE_DELAY = 3_000;
const RECONNECT_MAX_DELAY = 60_000;
const DEBUG_MSG_LIMIT = 2000;
const CANDLE_TIMEOUT_MS = 15_000;
const MIN_REQUIRED_CANDLES = 70;

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
  onCandle?: (symbol: string, candle: Candle) => void;
  onBufferReady?: (symbol: string, count: number) => void;
  onRefreshToken?: () => Promise<string>;
  tokenTtlMs?: number;
  onAuthError?: (message: string) => void;
}

export class PumaWs2Client {
  private _ws: WebSocket | null = null;
  private _options: PumaWs2ClientOptions;
  private _connected = false;
  private _running = false;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private _candleCount = new Map<string, number>();
  private _readySymbols = new Set<string>();

  /* Debug state */
  private _debug: boolean;
  private _msgSentCount = 0;
  private _msgRecvCount = 0;
  private _totalCandleCount = 0;
  private _lastRawReceived: string | null = null;
  private _timeline: string[] = [];

  constructor(options: PumaWs2ClientOptions) {
    this._options = options;
    this._debug = options.debug ?? false;
  }

  get connected(): boolean { return this._connected; }

  getCandleCount(symbol: string): number {
    return this._candleCount.get(symbol.toUpperCase()) ?? 0;
  }

  isReady(symbol: string): boolean {
    return this._readySymbols.has(symbol.toUpperCase());
  }

  /* Debug helpers */
  private _log(level: "INFO" | "DEBUG" | "WARN" | "ERROR", msg: string, data?: Record<string, unknown>): void {
    const tag = "WS2_DEBUG";
    if (!this._debug && level === "DEBUG") return;
    switch (level) {
      case "INFO": engineLogger.info(tag, msg, data ?? {}); break;
      case "DEBUG": engineLogger.debug(tag, msg, {}); break;
      case "WARN": engineLogger.warn(tag, msg, data ?? {}); break;
      case "ERROR": engineLogger.error(tag, msg, data ?? {}); break;
    }
  }

  private _timelineAdd(entry: string): void {
    if (!this._debug) return;
    this._timeline.push(`[${this._timeline.length + 1}] ${entry}`);
  }

  connect(): void {
    if (this._connected || this._running) return;
    this._running = true;
    this._doConnect();
  }

  disconnect(): void {
    this._running = false;
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      this._ws.onclose = null;
      try { this._ws.close(); } catch { /* ignore */ }
      this._ws = null;
    }
    this._connected = false;
    this._log("INFO", "Desconectado");
  }

  updateSessionToken(token: string): void {
    this._options.sessionToken = token;
    this._log("INFO", "═══ TOKEN ATUALIZADO ═══");
    this.disconnect();
    this.connect();
  }

  updateAssets(assets: string[]): void {
    this._options.assets = [...assets];
  }

  getTimeline(): string[] {
    return [...this._timeline];
  }

  private _doConnect(): void {
    if (!this._running) {
      this._log("WARN", "_doConnect: _running=false — abortando");
      return;
    }

    if (this._ws) {
      try {
        this._ws.onopen = null;
        this._ws.onmessage = null;
        this._ws.onerror = null;
        this._ws.onclose = null;
        if (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING) {
          this._ws.close();
        }
      } catch { /* ignore */ }
      this._ws = null;
    }
    this._connected = false;

    try {
      const token = this._options.sessionToken;
      const url = `${WS2_PROXY_URL}?token=${encodeURIComponent(token)}`;
      const tokenPreview = token ? `${token.slice(0, 20)}... (len=${token.length})` : "NULL";

      this._log("INFO", "═══ CONECTANDO AO PROXY WS2 ═══", {
        url: WS2_PROXY_URL,
        assets: this._options.assets.join(", "),
        token: tokenPreview,
      });
      this._timelineAdd("CONNECT (proxy)");

      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._connected = true;
        this._log("INFO", "═══ WS2 CONECTADO ═══");
        this._timelineAdd("OPEN");

        // Após conectar, o proxy já envia AUTH automaticamente.
        // Aguardamos a resposta AUTH OK e então começamos a escutar.
        this._startHeartbeat();
      };

      this._ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };

      this._ws.onerror = (event) => {
        this._log("ERROR", `Erro WebSocket: ${String(event)}`);
        this._timelineAdd("ERROR");
      };

      this._ws.onclose = (event) => {
        const wasConnected = this._connected;
        this._connected = false;
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }

        if (wasConnected) {
          this._log("WARN", `Desconectado code=${event.code} reason=${event.reason || "none"}`);
          this._timelineAdd(`CLOSE code=${event.code}`);
        }

        if (this._running) {
          const delay = RECONNECT_BASE_DELAY;
          this._log("INFO", `Reconectando em ${(delay / 1000).toFixed(0)}s...`);
          this._reconnectTimer = setTimeout(() => this._doConnect(), delay);
        }
      };
    } catch (err) {
      this._log("ERROR", `Falha ao criar WebSocket: ${String(err)}`);
      if (this._running) {
        this._reconnectTimer = setTimeout(() => this._doConnect(), RECONNECT_BASE_DELAY);
      }
    }
  }

  private _startHeartbeat(): void {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._heartbeatTimer = setInterval(() => {
      this._send({ method: "server_time" });
      this._log("DEBUG", "→ HEARTBEAT server_time");
    }, HEARTBEAT_INTERVAL);
  }

  /* ── Message handling ── */

  private _handleMessage(raw: string): void {
    this._msgRecvCount++;
    this._lastRawReceived = raw;

    const truncated = raw.length > DEBUG_MSG_LIMIT
      ? raw.slice(0, DEBUG_MSG_LIMIT) + `... [${raw.length} chars total]`
      : raw;

    // Log COMPLETO de toda mensagem recebida
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log(`║  ← WS2 RECV #${this._msgRecvCount} [${raw.length} chars]`);
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    console.log(truncated);
    console.log("");

    this._log("INFO", `← RECV #${this._msgRecvCount}`, {
      raw: truncated,
    });

    try {
      const data = JSON.parse(raw);
      const msgType = data.type || data.method || "(no type)";
      this._log("INFO", `← Tipo: ${msgType}`, { payload: data });

      // ── AUTH response (proxy forwarding) ──
      if (msgType === "auth") {
        if (data.status === "ok") {
          this._log("INFO", `═══ AUTH OK ═══ broker=${data.broker} symbols=${(data.symbols ?? []).length}`);
          this._timelineAdd(`AUTH OK broker=${data.broker}`);
        } else {
          this._log("WARN", `═══ AUTH FALHOU ═══`, { data });
          this._timelineAdd("AUTH FAILED");
        }
        return;
      }

      // ── bar_update (candle) ──
      if (msgType === "bar_update") {
        this._handleBarUpdate(data as Ws2BarUpdate);
        return;
      }

      // ── server_time response ──
      if (msgType === "server_time") {
        this._log("DEBUG", `server_time response: timestamp=${data.timestamp}`);
        this._timelineAdd("HEARTBEAT OK");
        return;
      }

      // ── Error / unknown method ──
      if (msgType === "error" || data.error || data.message?.toLowerCase?.().includes("unknown method")) {
        const errMsg = data.message ?? data.msg ?? JSON.stringify(data);
        this._log("WARN", `═══ ERRO DO SERVIDOR: ${errMsg} ═══`, { full: data });
        this._timelineAdd(`SERVER ERROR: ${errMsg}`);
        engineLogger.error("PumaWs2Client", "Erro WS2", { message: errMsg, full: JSON.stringify(data).slice(0, 500) });
        return;
      }

      // ── Unknown type — log completo para descoberta ──
      const fullStr = JSON.stringify(data).slice(0, 2000);
      this._log("WARN", `═══ TIPO DESCONHECIDO: ${msgType} ═══`, { payload: data });
      console.warn("⚠️ WS2 MENSAGEM NÃO TRATADA — Tipo:", msgType);
      console.warn("   Payload completo:", fullStr);
      this._timelineAdd(`UNKNOWN: ${msgType}`);

    } catch {
      this._log("WARN", `Frame não-JSON: ${raw.slice(0, 500)}`);
      this._timelineAdd(`NON-JSON [${raw.length} chars]`);
    }
  }

  private _handleBarUpdate(data: Ws2BarUpdate): void {
    const { symbol, bar } = data;
    if (!symbol || !bar || bar.close <= 0) return;

    const upperSymbol = symbol.toUpperCase();
    const timeMs = bar.time < 1e12 ? bar.time * 1000 : bar.time;

    const candle: Candle = {
      time: timeMs,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      asset: upperSymbol,
    };

    this._totalCandleCount++;
    const count = (this._candleCount.get(upperSymbol) ?? 0) + 1;
    this._candleCount.set(upperSymbol, count);

    this._log("INFO", `📊 Candle #${this._totalCandleCount} (${upperSymbol} #${count}): close=${candle.close.toFixed(5)} time=${new Date(candle.time).toISOString()}`);

    // Callback
    this._options.onCandle?.(upperSymbol, candle);

    // Buffer pronto
    if (count >= MIN_REQUIRED_CANDLES && !this._readySymbols.has(upperSymbol)) {
      this._readySymbols.add(upperSymbol);
      this._log("INFO", `═══ ★ BUFFER PRONTO: ${upperSymbol} (${count} candles) ★ ═══`);
      this._timelineAdd(`BUFFER READY: ${upperSymbol} (${count})`);
      this._options.onBufferReady?.(upperSymbol, count);
    }
  }

  private _send(data: Record<string, unknown>): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify(data);

    this._msgSentCount++;

    // Log COMPLETO de toda mensagem enviada
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log(`║  → WS2 SEND #${this._msgSentCount} [${payload.length} chars]`);
    console.log(`║  Method: ${data.method || data.type || "?"}`);
    console.log(`║  Payload: ${payload}`);
    console.log("╚═══════════════════════════════════════════════════════════════╝");

    this._log("INFO", `→ SEND #${this._msgSentCount}`, {
      method: data.method ?? data.type,
      payload,
    });
    this._timelineAdd(`SEND ${data.method || data.type || "?"}`);

    try {
      this._ws.send(payload);
    } catch (err) {
      this._log("ERROR", `Send error: ${String(err)}`);
    }
  }
}
