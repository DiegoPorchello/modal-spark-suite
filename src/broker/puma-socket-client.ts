/**
 * broker/puma-socket-client.ts
 * Socket.IO client unificado para Puma Broker usando socket.io-client.
 *
 * Usa a biblioteca socket.io-client que cuida de TODO o protocolo
 * Engine.IO v4 + Socket.IO v4 automaticamente (handshake, ping/pong, reconexão).
 *
 * Fluxo (reproduzindo fielmente o cliente oficial):
 *   1. Login REST → accessToken (JWT)
 *   2. Abrir Socket.IO em https://trade.pumabroker.com
 *   3. Conectar namespace /trades com auth: { token: JWT }
 *   4. Emitir: subscribe com USER_ID
 *   5. Conectar namespace /otc com auth: { token: JWT }
 *   6. Emitir: subscribe para cada ativo
 *   7. Escutar: tick, candle, tradeUpdate
 *
 * Token JWT é obtido EXCLUSIVAMENTE do login atual (accessToken).
 * NUNCA utiliza tokens antigos ou persistidos.
 *
 * Renovação automática do JWT antes da expiração.
 */

import { io, type Socket } from "socket.io-client";
import { engineLogger } from "../engine/logger";

const PUMA_URL = "https://trade.pumabroker.com";

/* ── JWT helpers ──────────────────────────────────────────────────────────── */

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getTokenInfo(token: string): {
  sub: string;
  exp: string;
  expiresIn: string;
  expMs: number;
} | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  const sub = (payload.sub ?? payload.userId ?? payload.id ?? "") as string;
  if (!exp) return { sub, exp: "unknown", expiresIn: "unknown", expMs: 0 };
  const expDate = new Date(exp * 1000);
  const now = Date.now();
  const diffMs = exp * 1000 - now;
  const expiresIn =
    diffMs > 0
      ? `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`
      : "EXPIRADO";
  return { sub, exp: expDate.toISOString(), expiresIn, expMs: exp * 1000 };
}

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface PumaSocketClientOptions {
  jwt: string;
  userId: string;
  assets: string[];
  interval?: number;
  onTick?: (data: TickData) => void;
  onCandle?: (data: CandleData) => void;
  onTradeUpdate?: (data: TradeUpdateData) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: string) => void;
  /** Chamado quando o JWT precisa ser renovado. Deve retornar um novo JWT. */
  onRefreshJwt?: () => Promise<string>;
}

export interface TickData {
  symbol: string;
  price: number;
  time: number;
}

export interface CandleData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
  interval: number;
  verify?: string;
}

export interface TradeUpdateData {
  id: string;
  status: string;
  symbol?: string;
  entryPrice?: string;
  exitPrice?: string;
  direction?: string;
  amount?: number;
  raw: Record<string, unknown>;
}

type ConnectionState = "idle" | "connecting" | "ready";

export class PumaSocketClient {
  static _nextId = 1;
  readonly instanceId: number;
  private _state: ConnectionState = "idle";
  private _jwt: string;
  private _userId: string;
  private _assets: string[];
  private _interval: number;

  // Socket.IO namespaces — cada um é um socket separado
  private _tradesSocket: Socket | null = null;
  private _otcSocket: Socket | null = null;

  private _onTick: ((data: TickData) => void) | null = null;
  private _onCandle: ((data: CandleData) => void) | null = null;
  private _onTradeUpdate: ((data: TradeUpdateData) => void) | null = null;
  private _onConnect: (() => void) | null = null;
  private _onDisconnect: ((reason: string) => void) | null = null;
  private _onError: ((error: string) => void) | null = null;
  private _onRefreshJwt: (() => Promise<string>) | null = null;

  private _connected = false;
  private _tradesConnected = false;
  private _otcConnected = false;
  private _subscribedAssets: string[] = [];

  // JWT renewal timer
  private _renewalTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: PumaSocketClientOptions) {
    this.instanceId = PumaSocketClient._nextId++;
    this._jwt = options.jwt;
    this._userId = options.userId;
    this._assets = [...options.assets];
    this._interval = options.interval ?? 60;
    this._onTick = options.onTick ?? null;
    this._onCandle = options.onCandle ?? null;
    this._onTradeUpdate = options.onTradeUpdate ?? null;
    this._onConnect = options.onConnect ?? null;
    this._onDisconnect = options.onDisconnect ?? null;
    this._onError = options.onError ?? null;
    this._onRefreshJwt = options.onRefreshJwt ?? null;

    console.log(`[PumaSocketClient] 🆕 NOVA INSTÂNCIA #${this.instanceId}`, {
      userId: this._userId,
      assetsCount: this._assets.length,
      assets: this._assets.join(", "),
    });
  }

  get connected(): boolean {
    return this._connected && this._state === "ready";
  }

  get state(): string {
    return this._state;
  }

  get tradesConnected(): boolean {
    return this._tradesConnected;
  }

  get otcConnected(): boolean {
    return this._otcConnected;
  }

  get subscribedAssets(): string[] {
    return [...this._subscribedAssets];
  }

  /* ── Connection ──────────────────────────────────────────────────────────── */

  connect(): void {
    this.disconnect();
    this._state = "connecting";
    this._connected = false;

    const tokenInfo = getTokenInfo(this._jwt);

    engineLogger.info("PumaSocketClient", `═══ CONECTANDO AO PUMA (socket.io-client) #${this.instanceId} ═══`, {
      url: PUMA_URL,
      userId: this._userId,
      assetsCount: this._assets.length,
      assets: this._assets.join(", "),
      interval: this._interval,
      jwtSub: tokenInfo?.sub ?? "unknown",
      jwtExp: tokenInfo?.exp ?? "unknown",
      jwtExpiresIn: tokenInfo?.expiresIn ?? "unknown",
    });

    if (tokenInfo?.expiresIn === "EXPIRADO") {
      engineLogger.error("PumaSocketClient", "⚠️ TOKEN JWT EXPIRADO — conexão pode falhar", {
        jwtExp: tokenInfo.exp,
      });
    }

    // Agenda renovação automática do JWT
    this._scheduleJwtRenewal(tokenInfo?.expMs ?? 0);

    // Conecta ao namespace /trades
    this._connectTradesNamespace();
  }

  disconnect(): void {
    console.log(`[PumaSocketClient #${this.instanceId}] disconnect()`);
    this._clearJwtRenewal();
    this._tradesSocket?.disconnect();
    this._otcSocket?.disconnect();
    this._tradesSocket = null;
    this._otcSocket = null;
    this._state = "idle";
    this._connected = false;
    this._tradesConnected = false;
    this._otcConnected = false;
    this._subscribedAssets = [];
  }

  /* ── Namespace /trades ──────────────────────────────────────────────────── */

  private _connectTradesNamespace(): void {
    engineLogger.info("PumaSocketClient", "Conectando namespace /trades...", {});

    this._tradesSocket = io(PUMA_URL + "/trades", {
      auth: { token: this._jwt },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    console.log("[PumaSocket] trades opts:", JSON.stringify(this._tradesSocket.io.opts, null, 2));

    this._tradesSocket.on("connect", () => {
      this._tradesConnected = true;
      console.log("[PumaSocket] ✅ /trades CONECTADO — socketId:", this._tradesSocket?.id);
      engineLogger.info("PumaSocketClient", "✅ Namespace /trades CONECTADO", {
        userId: this._userId,
        socketId: this._tradesSocket?.id,
      });

      // Subscribe com USER_ID (exatamente como o cliente oficial)
      // Frame real: 42/trades,["subscribe","28318"]
      this._tradesSocket?.emit("subscribe", this._userId);
      engineLogger.info("PumaSocketClient", "Subscribe enviado: /trades", {
        userId: this._userId,
      });

      this._checkReady();

      // Conecta /otc após /trades (somente se ainda não conectado)
      if (!this._otcSocket?.connected) {
        setTimeout(() => this._connectOtcNamespace(), 500);
      }
    });

    this._tradesSocket.onAny((...args: unknown[]) => {
      console.log("[PumaSocket] /trades onAny:", args[0], JSON.stringify(args[1])?.slice(0, 200));
    });

    this._tradesSocket.on("tradeUpdate", (data: Record<string, unknown>) => {
      this._handleTradeUpdate(data);
    });

    this._tradesSocket.on("connect_error", (err: Error) => {
      engineLogger.error("PumaSocketClient", "Erro ao conectar /trades", {
        message: err.message,
      });
      this._onError?.(`Trades connect error: ${err.message}`);
    });

    this._tradesSocket.on("disconnect", (reason: string) => {
      this._tradesConnected = false;
      engineLogger.warn("PumaSocketClient", "Namespace /trades desconectado", { reason });
      this._checkDisconnected();
    });
  }

  /* ── Namespace /otc ─────────────────────────────────────────────────────── */

  private _connectOtcNamespace(): void {
    engineLogger.info("PumaSocketClient", "Conectando namespace /otc...", {});

    this._otcSocket = io(PUMA_URL + "/otc", {
      auth: { token: this._jwt },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    console.log("[PumaSocket] otc opts:", JSON.stringify(this._otcSocket.io.opts, null, 2));

    this._otcSocket.on("connect", () => {
      this._otcConnected = true;
      console.log("[PumaSocket] ✅ /otc CONECTADO — socketId:", this._otcSocket?.id);
      engineLogger.info("PumaSocketClient", "✅ Namespace /otc CONECTADO", {
        socketId: this._otcSocket?.id,
      });

      // Subscribe em cada ativo (exatamente como o cliente oficial)
      this._sendOtcSubscribe();

      this._checkReady();
    });

    this._otcSocket.onAny((...args: unknown[]) => {
      engineLogger.debug("PumaSocketClient", `/otc onAny: ${String(args[0])}`, {});
    });

    this._otcSocket.on("tick", (data: Record<string, unknown>) => {
      this._handleTick(data);
    });

    this._otcSocket.on("candle", (data: Record<string, unknown>) => {
      this._handleCandle(data);
    });

    this._otcSocket.on("connect_error", (err: Error) => {
      engineLogger.error("PumaSocketClient", "Erro ao conectar /otc", {
        message: err.message,
      });
      this._onError?.(`OTC connect error: ${err.message}`);
    });

    this._otcSocket.on("disconnect", (reason: string) => {
      this._otcConnected = false;
      engineLogger.warn("PumaSocketClient", "Namespace /otc desconectado", { reason });
      this._checkDisconnected();
    });
  }

  private _sendOtcSubscribe(): void {
    this._subscribedAssets = [];
    for (const asset of this._assets) {
      this._otcSocket?.emit("subscribe", {
        symbol: asset,
        interval: this._interval,
      });
      this._subscribedAssets.push(asset);
    }
    engineLogger.info("PumaSocketClient", "═══ ATIVOS INSCRITOS NO OTC ═══", {
      count: this._subscribedAssets.length,
      assets: this._subscribedAssets.join(", "),
      interval: this._interval,
    });
  }

  /* ── State management ────────────────────────────────────────────────────── */

  private _checkReady(): void {
    if (this._tradesConnected && this._otcConnected && this._state !== "ready") {
      this._state = "ready";
      this._connected = true;

      const tokenInfo = getTokenInfo(this._jwt);
      engineLogger.info(
        "PumaSocketClient",
        "═══════════════════════════════════════════════════",
        {},
      );
      engineLogger.info("PumaSocketClient", "═══ PUMA SOCKET CLIENT PRONTO PARA OPERAR ═══", {});
      engineLogger.info("PumaSocketClient", `  Usuário autenticado: ${this._userId}`, {});
      engineLogger.info("PumaSocketClient", `  ID do usuário: ${this._userId}`, {});
      engineLogger.info(
        "PumaSocketClient",
        `  Token expira em: ${tokenInfo?.exp ?? "unknown"} (${tokenInfo?.expiresIn ?? "unknown"})`,
        {},
      );
      engineLogger.info("PumaSocketClient", `  Namespaces conectados: /trades ✓, /otc ✓`, {});
      engineLogger.info("PumaSocketClient", `  Ativos inscritos: ${this._assets.length}`, {});
      engineLogger.info("PumaSocketClient", `  Ativos: ${this._assets.join(", ")}`, {});
      engineLogger.info("PumaSocketClient", `  Intervalo: ${this._interval}s`, {});
      engineLogger.info(
        "PumaSocketClient",
        "═══════════════════════════════════════════════════",
        {},
      );

      this._onConnect?.();
    }
  }

  private _checkDisconnected(): void {
    if (!this._tradesConnected && !this._otcConnected && this._connected) {
      this._connected = false;
      this._state = "connecting";
      this._onDisconnect?.("All namespaces disconnected");
    }
  }

  /* ── Event handlers ──────────────────────────────────────────────────────── */

  private _handleTick(data: Record<string, unknown>): void {
    if (!data) return;

    console.log("[PumaSocket] ← tick RAW:", JSON.stringify(data));

    const symbol = (data.symbol ?? data.s ?? "") as string;
    const price = parseFloat(String(data.price ?? data.p ?? "0"));
    const time = (data.time ?? data.t ?? Date.now()) as number;

    if (symbol && price > 0) {
      this._onTick?.({
        symbol: this._convertSymbol(symbol),
        price,
        time,
      });
    }
  }

  private _handleCandle(data: Record<string, unknown>): void {
    if (!data) return;

    const symbol = (data.symbol ?? data.s ?? "") as string;
    const interval = (data.interval ?? data.i ?? this._interval) as number;

    const candleData = (data.bar ?? data.candle ?? data) as Record<string, unknown>;
    const open = parseFloat(String(candleData.open ?? candleData.o ?? "0"));
    const high = parseFloat(String(candleData.high ?? candleData.h ?? "0"));
    const low = parseFloat(String(candleData.low ?? candleData.l ?? "0"));
    const close = parseFloat(String(candleData.close ?? candleData.c ?? "0"));
    const volume = parseFloat(String(candleData.volume ?? candleData.v ?? "0"));
    const time2 = (candleData.time ?? candleData.t ?? Date.now()) as number;
    const verify = (data.verify ?? candleData.verify ?? "") as string;

    if (symbol && close > 0) {
      this._onCandle?.({
        symbol: this._convertSymbol(symbol),
        open,
        high,
        low,
        close,
        volume,
        time: typeof time2 === "number" && time2 < 1e12 ? time2 * 1000 : time2,
        interval,
        verify,
      });
    }
  }

  private _handleTradeUpdate(data: Record<string, unknown>): void {
    if (!data) return;

    const tradeId = String(data.id ?? "");
    const status = String(data.status ?? "ACTIVE");

    engineLogger.info("PumaSocketClient", "📊 tradeUpdate recebido", {
      tradeId,
      status,
      symbol: data.symbol,
    });

    this._onTradeUpdate?.({
      id: tradeId,
      status,
      symbol: data.symbol as string,
      entryPrice: data.entryPrice as string,
      exitPrice: data.exitPrice as string,
      direction: data.direction as string,
      amount: data.amount as number,
      raw: data,
    });
  }

  /* ── Symbol Conversion ───────────────────────────────────────────────────── */

  private _convertSymbol(symbol: string): string {
    return symbol.replace("/", "");
  }

  /* ── JWT Auto-Renewal ────────────────────────────────────────────────────── */

  private _scheduleJwtRenewal(expMs: number): void {
    this._clearJwtRenewal();
    if (expMs <= 0) return;

    // Renova 5 minutos antes da expiração
    const renewAt = expMs - 5 * 60 * 1000;
    const delay = renewAt - Date.now();

    if (delay <= 0) {
      // Já expirou ou está para expirar — renova agora
      this._renewJwt();
      return;
    }

    engineLogger.info("PumaSocketClient", `JWT renewal agendado`, {
      expiresAt: new Date(expMs).toISOString(),
      renewIn: `${Math.floor(delay / 60000)}m`,
    });

    this._renewalTimer = setTimeout(() => {
      this._renewJwt();
    }, delay);
  }

  private _clearJwtRenewal(): void {
    if (this._renewalTimer) {
      clearTimeout(this._renewalTimer);
      this._renewalTimer = null;
    }
  }

  private async _renewJwt(): Promise<void> {
    if (!this._onRefreshJwt) {
      engineLogger.warn("PumaSocketClient", "JWT renewal: onRefreshJwt não configurado", {});
      return;
    }

    try {
      engineLogger.info("PumaSocketClient", "🔄 Renovando JWT...", {});
      const newJwt = await this._onRefreshJwt();
      if (newJwt && newJwt !== this._jwt) {
        this._jwt = newJwt;
        engineLogger.info("PumaSocketClient", "✅ JWT renovado — reconectando namespaces", {});

        // Reconecta com novo JWT
        this.disconnect();
        this.connect();
      }
    } catch (err) {
      engineLogger.error("PumaSocketClient", "❌ Falha ao renovar JWT", {
        error: String(err),
      });
    }
  }

  /* ── Update ──────────────────────────────────────────────────────────────── */

  updateAssets(assets: string[]): void {
    this._assets = [...assets];
    if (this._otcConnected) {
      this._sendOtcSubscribe();
    }
  }

  updateJwt(jwt: string): void {
    this._jwt = jwt;
    engineLogger.info("PumaSocketClient", "JWT atualizado — reconectando", {
      jwtLength: jwt.length,
    });
    this.disconnect();
    this.connect();
  }
}
