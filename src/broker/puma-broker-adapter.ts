/**
 * broker/puma-broker-adapter.ts
 * Adaptador Puma Broker — implementa IBroker com chamadas REAIS à API.
 *
 * Arquitetura:
 *   - Login REST → JWT (accessToken) — NUNCA persistido
 *   - Socket.IO (socket.io-client) → ÚNICO canal para trades + market data
 *   - BinanceWsClient → Candles gratuitos (mercado aberto, sem auth)
 *   - CandleBuffer → Buffer unificado (minRequired=70)
 *
 * NENHUM WebSocket puro. Toda comunicação Socket.IO via socket.io-client.
 * NENHUM token hardcoded ou persistido.
 */

import type { Candle } from "../market/types";
import type {
  IBroker,
  BrokerAsset,
  OrderParams,
  OrderResult,
  OrderStatus,
  MarketPrice,
  AccountBalance,
} from "./types";
import { engineLogger } from "../engine/logger";
import { BinanceWsClient } from "./binance-ws-client";
import { PumaWs2Client } from "./puma-ws2-client";
import {
  MarketSessionManager,
  type MarketSession,
  type MarketSessionInfo,
} from "../market/market-session-manager";
import { PumaMarketDataService, type TickData } from "../market/market-data-service";

const DAEMON_URL = "http://127.0.0.1:3001";

/* ── JWT decode para logging ──────────────────────────────────────────────── */

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
} | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const exp = payload.exp as number | undefined;
  const sub = (payload.sub ?? payload.userId ?? payload.id ?? "") as string;
  if (!exp) return { sub, exp: "unknown", expiresIn: "unknown" };
  const expDate = new Date(exp * 1000);
  const now = Date.now();
  const diffMs = exp * 1000 - now;
  const expiresIn =
    diffMs > 0
      ? `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`
      : "EXPIRADO";
  return { sub, exp: expDate.toISOString(), expiresIn };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  delayMs = 2000,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError ?? new Error("Falha na requisição");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Interfaces
 * ──────────────────────────────────────────────────────────────────────────── */

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    balance: number;
    demoBalance: number;
    bonus: number;
    isDemo: boolean;
    isVip: boolean;
    verified: boolean;
    country: string;
  };
  token: string;
  ws2Session?: string;
}

interface ActiveAsset {
  symbol: string;
  name?: string;
  payout?: number;
  minAmount?: number;
  maxAmount?: number;
  active?: boolean;
  category?: string;
}

interface TradeResponse {
  id: string;
  status: string;
  message?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PumaBrokerAdapter
 * ──────────────────────────────────────────────────────────────────────────── */

export class PumaBrokerAdapter implements IBroker {
  static _nextId = 1;
  readonly instanceId: number;
  readonly name = "Puma Broker";

  private _connected = false;
  private _connecting = false;
  private _token: string | null = null;
  private _ws2Session: string | null = null;
  private _userId: string | null = null;
  private _userEmail: string | null = null;
  private _userName: string | null = null;
  private _isDemo = true;
  private _balance = 0;
  private _demoBalance = 10000;
  private _assets: BrokerAsset[] = [];
  private _error: string | null = null;

  // Callbacks
  private _onPriceCallbacks: Array<(price: MarketPrice) => void> = [];
  private _onCandleCloseCallbacks: Array<(candle: Candle) => void> = [];

  // Trade result via PumaSocketClient (tradeUpdate)
  private _pendingTradeResults = new Map<
    string,
    {
      resolve: (status: OrderStatus) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  // Binance WebSocket para dados de mercado (candles gratuitos, sem auth)
  private _binanceWs: BinanceWsClient;

  // Market Session Manager
  private _sessionManager: MarketSessionManager;
  private _sessionUnsub: (() => void) | null = null;

  // PumaMarketDataService — Socket.IO ÚNICO
  private _marketDataService: PumaMarketDataService | null = null;

  // PumaWs2Client — WebSocket puro para candles históricos de híbridos
  private _ws2Client: PumaWs2Client | null = null;

  // Critical auth error callback (set externally by React component)
  private _onCriticalAuthError:
    | ((error: { message: string; source: string; originalError: string }) => void)
    | null = null;

  // Cache REST de candles (chave: "asset:resolution", TTL: 15s)
  private _restCandleCache = new Map<string, { candles: Candle[]; expiresAt: number }>();

  private _subscribedSymbols = new Set<string>([
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "BTCUSD",
    "ETHUSD",
    "BETHUSDT",
    "XAUUSD",
    "USDCAD",
    "NZDUSD",
    "BTSOLUSDT",
    "MAPEUSDT",
    "XRDOGUSDT",
    "XRPSOLUSDT",
  ]);

  private readonly _INTERVAL_MAP: Record<string, string> = {
    M1: "1",
    M5: "5",
    M15: "15",
    M30: "30",
    H1: "60",
  };

  constructor() {
    this.instanceId = PumaBrokerAdapter._nextId++;
    this._binanceWs = new BinanceWsClient((symbol: string, candle: Candle, isHistory?: boolean) => {
      if (this._marketDataService) {
        this._marketDataService.addCandleFromExternal(symbol, candle, isHistory);
      }
    }, this._onCandleCloseCallbacks);
    this._sessionManager = new MarketSessionManager();
    console.log(`[PumaBrokerAdapter] 🆕 NOVA INSTÂNCIA #${this.instanceId}`);
  }

  setCriticalAuthErrorHandler(
    handler: ((error: { message: string; source: string; originalError: string }) => void) | null,
  ): void {
    this._onCriticalAuthError = handler;
  }

  getSessionManager(): MarketSessionManager {
    return this._sessionManager;
  }

  getSessionInfo(): MarketSessionInfo {
    return this._sessionManager.getCurrentSession();
  }

  get connected(): boolean {
    return this._connected;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get error(): string | null {
    return this._error;
  }

  get email(): string | null {
    return this._userEmail;
  }

  get userId(): string | null {
    return this._userId;
  }

  get userName(): string | null {
    return this._userName;
  }

  get isDemo(): boolean {
    return this._isDemo;
  }

  getConnectionStatus(): {
    socketIO: string;
    binance: boolean;
    session: string;
    namespaces: { trades: boolean; otc: boolean };
    subscribedAssets: string[];
  } {
    return {
      socketIO: this._marketDataService?.state ?? "disabled",
      binance: this._binanceWs["connected"] ?? false,
      session: this._sessionManager.getCurrentSession().currentSession,
      namespaces: {
        trades: this._marketDataService?.tradesConnected ?? false,
        otc: this._marketDataService?.otcConnected ?? false,
      },
      subscribedAssets: this._marketDataService?.subscribedAssets ?? [],
    };
  }

  /* ── Conexão / Autenticação ─────────────────────────────────────────────── */

  async connect(): Promise<void> {
    throw new Error("Use connectWithCredentials(email, password, accountType)");
  }

  async connectWithCredentials(
    email: string,
    password: string,
    accountType: "real" | "demo",
  ): Promise<void> {
    // Guard: evita conexões concorrentes ou duplicadas
    if (this._connected) {
      engineLogger.info("PumaBroker", "connectWithCredentials: já conectado — ignorando");
      return;
    }
    if (this._connecting) {
      engineLogger.warn("PumaBroker", "connectWithCredentials: conexão em andamento — ignorando");
      return;
    }
    this._connecting = true;
    this._error = null;

    try {
      // 1. Login real — JWT obtido EXCLUSIVAMENTE do login atual
      const loginData = await this._login(email, password);
      this._token = loginData.token;
      this._ws2Session = loginData.ws2Session ?? null;
      this._userId = loginData.user.id;
      this._userEmail = loginData.user.email;
      this._userName = loginData.user.name || loginData.user.firstName;
      this._isDemo = accountType === "demo";

      // Log detalhado do usuário autenticado
      const tokenInfo = getTokenInfo(this._token);
      const ws2Preview = this._ws2Session
        ? `${this._ws2Session.slice(0, 20)}... (len=${this._ws2Session.length})`
        : "N/D";
      engineLogger.info("PumaBroker", "═══════════════════════════════════════════════════", {});
      engineLogger.info("PumaBroker", "═══ LOGIN REALIZADO COM SUCESSO ═══", {});
      engineLogger.info("PumaBroker", `  Usuário autenticado: ${this._userName}`, {});
      engineLogger.info("PumaBroker", `  Email: ${this._userEmail}`, {});
      engineLogger.info("PumaBroker", `  ID do usuário: ${this._userId}`, {});
      engineLogger.info("PumaBroker", `  Token JWT obtido do login (accessToken)`, {});
      engineLogger.info("PumaBroker", `  Token sub: ${tokenInfo?.sub ?? "unknown"}`, {});
      engineLogger.info("PumaBroker", `  Token expira em: ${tokenInfo?.exp ?? "unknown"}`, {});
      engineLogger.info(
        "PumaBroker",
        `  Token tempo restante: ${tokenInfo?.expiresIn ?? "unknown"}`,
        {},
      );
      engineLogger.info("PumaBroker", `  Conta: ${this._isDemo ? "DEMO" : "REAL"}`, {});
      engineLogger.info("PumaBroker", `  WS2 session cookie: ${ws2Preview}`, {});
      engineLogger.info("PumaBroker", "═══════════════════════════════════════════════════", {});

      // 2. Buscar saldo real
      await this._fetchBalance();

      // 3. Buscar ativos reais
      await this._fetchAssets();

      // 4. Inicializar MarketDataService (Socket.IO ÚNICO via socket.io-client)
      this._initMarketDataService();

      // 5. Conectar Binance para dados de mercado (candles gratuitos, sem auth)
      this._sessionManager.startAutoDetection();
      const sessionInfo = this._sessionManager.getCurrentSession();
      this._subscribedSymbols = new Set(sessionInfo.activeAssets);

      if (sessionInfo.dataSource === "binance") {
        const symbols = Array.from(this._subscribedSymbols);
        this._binanceWs.connect(symbols, "M1");
        engineLogger.info(
          "PumaBroker",
          `Binance conectado para ${symbols.length} ativos (Mercado Aberto)`,
          {},
        );
      } else {
        engineLogger.info(
          "PumaBroker",
          `Binance DESATIVADO — usando Puma Socket.IO (Mercado Fechado)`,
          { assets: sessionInfo.activeAssets.join(", ") },
        );
      }

      // 6. Iniciar escuta de mudanças de sessão
      this._sessionUnsub = this._sessionManager.onSessionChange((from, to, info) => {
        this._onSessionChange(from, to, info);
      });

      // 7. Conectar WS2 (wsmt5) para candles históricos de híbridos
      this._initWs2Client();

      // 8. Buscar histórico REST dos híbridos (não bloqueante)
      this._fetchHybridHistory();

      this._connected = true;
      this._connecting = false;

      engineLogger.info("PumaBroker", "═══ CONEXÃO COMPLETA ═══", {
        socketIO: this._marketDataService?.state ?? "disabled",
        binance: this._binanceWs["connected"] ?? false,
        namespaces: {
          trades: this._marketDataService?.tradesConnected ?? false,
          otc: this._marketDataService?.otcConnected ?? false,
        },
      });
    } catch (err) {
      this._connecting = false;
      this._error = err instanceof Error ? err.message : "Falha na conexão";
      this._connected = false;
      throw err;
    }
  }

  /**
   * Inicializa o MarketDataService — ÚNICO Socket.IO client.
   * Usa socket.io-client com auth: { token: JWT } em cada namespace.
   */
  private _initMarketDataService(): void {
    if (!this._token || !this._userId) {
      engineLogger.error("PumaBroker", "MarketDataService: token ou userId ausente", {});
      return;
    }

    // ⚠️ DESCONECTAR instância anterior se existir (evita múltiplas instâncias)
    if (this._marketDataService) {
      console.warn(
        `[PumaBrokerAdapter #${this.instanceId}] ⚠️ MarketDataService #${this._marketDataService.instanceId} já existe — desconectando antes de criar nova`,
      );
      this._marketDataService.disconnect();
      this._marketDataService = null;
    }

    const assets = Array.from(this._subscribedSymbols);

    console.log(`[PumaBrokerAdapter #${this.instanceId}] Criando PumaMarketDataService...`);
    this._marketDataService = new PumaMarketDataService({
      jwt: this._token,
      userId: this._userId,
      assets,
      interval: 60,
      bufferOptions: {
        maxSize: 500,
        minRequired: 70,
      },
      onRefreshJwt: () => this._refreshJwt(),
      onBufferReady: (symbol, count) => {
        engineLogger.info("PumaBroker", "═══════════════════════════════════════════════════", {});
        engineLogger.info("PumaBroker", `═══ BUFFER PRONTO PARA OPERAR: ${symbol} ═══`, {});
        engineLogger.info("PumaBroker", `  Candles carregados: ${count}`, {});
        engineLogger.info("PumaBroker", `  Mínimo necessário: 70`, {});
        engineLogger.info("PumaBroker", "═══════════════════════════════════════════════════", {});
      },
      onCandleUpdate: (symbol, candle) => {
        this._onCandleCloseCallbacks.forEach((cb) => {
          try {
            cb(candle);
          } catch (err) {
            engineLogger.error("PumaBroker", "Callback de candle fechado falhou", {
              error: String(err),
              symbol,
            });
          }
        });

        this._onPriceCallbacks.forEach((cb) => {
          cb({
            asset: symbol,
            bid: candle.close,
            ask: candle.close,
            spread: 0,
            timestamp: Date.now(),
          });
        });
      },
      onTick: (data: TickData) => {
        this._onPriceCallbacks.forEach((cb) => {
          cb({
            asset: data.symbol,
            bid: data.price,
            ask: data.price,
            spread: 0,
            timestamp: data.time,
          });
        });
      },
      onTradeUpdate: (data) => {
        this.handleTradeUpdate({ id: data.id, status: data.status });
      },
    });

    engineLogger.info(
      "PumaBroker",
      "MarketDataService inicializado (Socket.IO ÚNICO via socket.io-client)",
      {
        userId: this._userId,
        assets: assets.join(", "),
        minRequired: 70,
      },
    );

    this._marketDataService.connect();
  }

  /**
   * Inicializa o WS2 Client (wsmt5.pumabroker.com) para candles históricos.
   * Usado para pares híbridos (BETHUSDT, BTSOLUSDT, etc.) que não existem na Binance.
   */
  private _initWs2Client(): void {
    // WS2 precisa OBRIGATORIAMENTE do server_name_session cookie, NÃO do JWT
    // O daemon extrai isso do header Set-Cookie do login
    const ws2Token = this._ws2Session;
    const tokenPreview = ws2Token ? `${ws2Token.slice(0, 15)}... (len=${ws2Token.length})` : "NULL";
    engineLogger.info("PumaBroker", `═══ _initWs2Client: _ws2Session=${tokenPreview} ═══`, {});
    if (!ws2Token) {
      engineLogger.error(
        "PumaBroker",
        "WS2: server_name_session cookie AUSENTE — WS2 não conectará. Verifique se o login retornou ws2Session.",
        {},
      );
      this._error =
        "WS2: cookie server_name_session não disponível (login pode ter falhado em capturar cookie)";
      return;
    }

    // Pega apenas ativos híbridos
    const hybridAssets = ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"];
    const activeHybrids = hybridAssets.filter((a) => this._subscribedSymbols.has(a));

    if (activeHybrids.length === 0) {
      engineLogger.info("PumaBroker", "WS2: nenhum ativo híbrido ativo — ignorando", {});
      return;
    }

    // Desconecta instância anterior se existir
    if (this._ws2Client) {
      engineLogger.info("PumaBroker", "_initWs2Client: desconectando ws2Client anterior", {});
      this._ws2Client.disconnect();
      this._ws2Client = null;
    }

    this._ws2Client = new PumaWs2Client({
      sessionToken: ws2Token,
      assets: activeHybrids,
      interval: "1",
      debug: true,
      useProxy: true,
      onCandle: (symbol, candle) => {
        // Alimenta o MarketDataService com os candles do WS2
        if (this._marketDataService) {
          this._marketDataService.addCandleFromExternal(symbol, candle);
        }
      },
      onBufferReady: (symbol, count) => {
        engineLogger.info(
          "PumaBroker",
          `═══ WS2 BUFFER PRONTO: ${symbol} (${count} candles) ═══`,
          {},
        );
      },
      onAuthError: (message) => {
        this._error = message;
        engineLogger.error("PumaBroker", `═══ ERRO DE AUTENTICAÇÃO WS2 (visível na UI) ═══`, {
          error: message,
        });
        // Trigger critical auth error handler if set (will stop robot and show modal)
        this._onCriticalAuthError?.({
          message: "Robô parado — falha de autenticação com a Puma Broker",
          source: "puma-ws2-client.ts:onAuthError",
          originalError: message,
        });
      },
      onRefreshToken: async () => {
        engineLogger.info("PumaBroker", "═══ REFRESH WS2 TOKEN: chamando daemon /ws2-session?force=1 ═══", {
          currentTokenPreview: this._ws2Session
            ? `${this._ws2Session.slice(0, 15)}... (len=${this._ws2Session.length})`
            : "NULL",
        });
        const res = await fetch(`${DAEMON_URL}/ws2-session?force=1`, {
          headers: { Authorization: `Bearer ${this._token}` },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 503 || res.status === 429) {
            throw new Error(
              `DAEMON_CIRCUIT_BREAKER: daemon bloqueou refresh (HTTP ${res.status}) — ${body}`,
            );
          }
          throw new Error(`DAEMON_REFRESH_FAILED: HTTP ${res.status} — ${body}`);
        }
        const data = await res.json();
        const newToken = data.session ?? null;
        const newTokenPreview = newToken
          ? `${newToken.slice(0, 15)}... (len=${newToken.length})`
          : "NULL";
        engineLogger.info("PumaBroker", `═══ REFRESH WS2 TOKEN: daemon retornou session=${newTokenPreview} ═══`, {});
        if (newToken && newToken !== this._ws2Session) {
          engineLogger.info(
            "PumaBroker",
            "WS2 token renovado via daemon (force refresh): %s → %s",
            { de: this._ws2Session ? `${this._ws2Session.slice(0, 15)}...` : "NULL", para: newTokenPreview },
          );
          this._ws2Session = newToken;
        } else if (newToken && newToken === this._ws2Session) {
          engineLogger.warn("PumaBroker", "WS2 token refresh: daemon retornou o MESMO token — pode estar obsoleto", {});
        }
        if (!newToken) {
          throw new Error("DAEMON_REFRESH_FAILED: daemon retornou session vazio");
        }
        return newToken;
      },
    });

    this._ws2Client.connect();

    engineLogger.info("PumaBroker", `═══ WS2 CONECTANDO PARA HÍBRIDOS ═══`, {
      assets: activeHybrids.join(", "),
      mode: this._ws2Client["_options"]?.useProxy ? "proxy" : "direto",
      hasWs2Session: !!this._ws2Session,
      sessionPreview: tokenPreview,
    });
  }

  /**
   * Busca candles históricos via REST da Puma para ativos híbridos/OTC.
   * Endpoint: GET /api/v1/tradingview/history
   *   ?symbol=BETHUSDT&resolution=1&from=...&to=...
   * Response: {"s":"ok","t":[...],"o":[...],"h":[...],"l":[...],"c":[...],"v":[...]}
   */
  private async _fetchHybridHistory(): Promise<void> {
    const hybridAssets = ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"];
    const activeHybrids = hybridAssets.filter((a) => this._subscribedSymbols.has(a));
    if (activeHybrids.length === 0 || !this._token) {
      engineLogger.info(
        "PumaBroker",
        "_fetchHybridHistory: SKIP — nenhum híbrido ativo ou sem token",
        {
          activeHybrids,
          hasToken: !!this._token,
          subscribedCount: this._subscribedSymbols.size,
          subscribedAssets: Array.from(this._subscribedSymbols),
        },
      );
      return;
    }

    const resolution = 1; // minutos: 1, 5, 15, 30, 60
    const count = 200;
    const to = Math.floor(Date.now() / 1000);
    const from = to - count * resolution * 60;

    engineLogger.info("PumaBroker", "═══ BUSCANDO HISTÓRICO REST PARA HÍBRIDOS ═══", {
      assets: activeHybrids.join(", "),
      endpoint: "/api/v1/tradingview/history",
    });

    for (const symbol of activeHybrids) {
      try {
        const url = `${DAEMON_URL}/history?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`;
        engineLogger.info("PumaBroker", `_fetchHybridHistory: chamando ${symbol}`, {
          url,
          from: new Date(from * 1000).toISOString(),
          to: new Date(to * 1000).toISOString(),
        });

        const res = await fetch(url, { headers: { Authorization: `Bearer ${this._token}` } });

        if (!res.ok) {
          engineLogger.warn("PumaBroker", `Histórico REST falhou: ${symbol}`, {
            status: res.status,
          });
          continue;
        }

        const data = await res.json();

        // TradingView format confirmado: {"s":"ok","t":[],"o":[],"h":[],"l":[],"c":[],"v":[]}
        if (data.s !== "ok" || !Array.isArray(data.t)) {
          engineLogger.warn("PumaBroker", `Histórico REST formato inválido: ${symbol}`, {});
          continue;
        }

        const times = data.t as number[];
        const opens = (data.o ?? []) as number[];
        const highs = (data.h ?? []) as number[];
        const lows = (data.l ?? []) as number[];
        const closes = (data.c ?? []) as number[];
        const volumes = (data.v ?? []) as number[];

        const candles: Candle[] = [];
        for (let i = 0; i < times.length; i++) {
          const time = times[i];
          const close = closes[i];
          if (!time || !close) continue;
          candles.push({
            time: time < 1e12 ? time * 1000 : time,
            open: opens[i] ?? 0,
            high: highs[i] ?? 0,
            low: lows[i] ?? 0,
            close,
            volume: volumes[i] ?? 0,
            asset: symbol,
          });
        }

        engineLogger.info("PumaBroker", `═══ HISTÓRICO REST: ${symbol} ═══`, {
          candles: candles.length,
          resolution: `${resolution}min`,
          from: new Date(from * 1000).toISOString(),
          to: new Date(to * 1000).toISOString(),
        });

        // Alimenta o buffer
        let fed = 0;
        for (const candle of candles) {
          if (this._marketDataService) {
            this._marketDataService.addCandleFromExternal(symbol, candle, true);
            fed++;
          }
        }
        engineLogger.info(
          "PumaBroker",
          `_fetchHybridHistory: ${symbol} — ${fed} candles alimentados no buffer`,
          {},
        );
      } catch (err) {
        engineLogger.error("PumaBroker", `Falha ao buscar histórico REST: ${symbol}`, {
          error: String(err),
        });
      }
    }
  }

  /**
   * Busca candles históricos via REST para qualquer ativo/resolução.
   * Usado internamente por getCandles() quando o timeframe não é M1.
   */
  private async _fetchHistoryREST(
    symbol: string,
    resolution: number,
    count: number,
  ): Promise<Candle[]> {
    const cacheKey = `${symbol}:${resolution}`;
    const cached = this._restCandleCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.candles;
    }

    if (!this._token) {
      engineLogger.warn("PumaBroker", "_fetchHistoryREST: SKIP — sem token", {
        symbol,
        resolution,
      });
      return [];
    }
    const to = Math.floor(Date.now() / 1000);
    const from = to - count * resolution * 60;
    const url = `${DAEMON_URL}/history?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this._token}` } });
      if (!res.ok) {
        engineLogger.warn("PumaBroker", `_fetchHistoryREST falhou: ${symbol}`, {
          resolution,
          status: res.status,
        });
        return [];
      }
      const data = await res.json();
      if (data.s !== "ok" || !Array.isArray(data.t)) return [];
      const times = data.t as number[];
      const opens = (data.o ?? []) as number[];
      const highs = (data.h ?? []) as number[];
      const lows = (data.l ?? []) as number[];
      const closes = (data.c ?? []) as number[];
      const volumes = (data.v ?? []) as number[];
      const candles: Candle[] = [];
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const close = closes[i];
        if (!time || !close) continue;
        candles.push({
          time: time < 1e12 ? time * 1000 : time,
          open: opens[i] ?? 0,
          high: highs[i] ?? 0,
          low: lows[i] ?? 0,
          close,
          volume: volumes[i] ?? 0,
          asset: symbol,
        });
      }
      this._restCandleCache.set(cacheKey, { candles, expiresAt: Date.now() + 15000 });
      return candles;
    } catch (err) {
      engineLogger.error("PumaBroker", `_fetchHistoryREST erro: ${symbol}`, {
        resolution,
        error: String(err),
      });
      return [];
    }
  }

  /**
   * Renova o JWT fazendo re-login.
   * Chamado pelo PumaSocketClient quando o token está próximo da expiração.
   */
  private async _refreshJwt(): Promise<string> {
    if (!this._userEmail) {
      throw new Error("Não há email para re-login");
    }
    // Não temos a senha em memória — usa o token atual para fazer refresh via daemon
    // Se o daemon não suporta refresh, o usuário precisará fazer login novamente
    engineLogger.info("PumaBroker", "🔄 Renovando JWT via re-login...", {});

    // Tenta buscar um novo token via /balance (que faz ensure_token no daemon)
    try {
      const res = await fetch(`${DAEMON_URL}/balance`, {
        headers: { Authorization: `Bearer ${this._token}` },
      });
      if (res.status === 401) {
        throw new Error("Token expirado — re-login necessário");
      }
    } catch {
      throw new Error("Falha ao renovar JWT — re-login necessário");
    }

    return this._token ?? "";
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this._token = null;
    this._ws2Session = null;
    this._userId = null;
    this._userEmail = null;
    this._userName = null;
    this._balance = 0;
    this._demoBalance = 10000;
    this._assets = [];
    this._error = null;

    // Desconecta MarketDataService (Socket.IO ÚNICO)
    if (this._marketDataService) {
      this._marketDataService.disconnect();
      this._marketDataService = null;
    }

    // Desconecta WS2 (wsmt5 — candles históricos híbridos)
    if (this._ws2Client) {
      this._ws2Client.disconnect();
      this._ws2Client = null;
    }

    // Desconecta Binance
    this._binanceWs.disconnect();

    // Para detecção de sessão
    this._sessionManager.stopAutoDetection();
    if (this._sessionUnsub) {
      this._sessionUnsub();
      this._sessionUnsub = null;
    }

    // Limpa pendências de trade
    this._pendingTradeResults.forEach(({ timer }) => clearTimeout(timer));
    this._pendingTradeResults.clear();
  }

  /* ── REST API ────────────────────────────────────────────────────────────── */

  private async _login(email: string, password: string): Promise<LoginResponse> {
    let res: Response;
    try {
      res = await fetch(`${DAEMON_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(
        "Daemon offline. Execute 'python proxy_daemon.py' no diretório pumabroker-api",
      );
    }

    if (res.status === 401) throw new Error("Email ou senha inválidos");
    if (res.status === 403) throw new Error("Conta bloqueada");
    if (!res.ok) throw new Error(`Erro no login: HTTP ${res.status}`);

    const data: LoginResponse = await res.json();
    if (!data.token) throw new Error("Resposta inesperada do login: token ausente");

    return data;
  }

  private async _fetchBalance(): Promise<void> {
    if (!this._token) throw new Error("Não autenticado");

    const res = await fetch(`${DAEMON_URL}/balance`, {
      headers: { Authorization: `Bearer ${this._token}` },
    });

    if (res.status === 401) throw new Error("Sessão expirada");
    if (!res.ok) throw new Error(`Erro ao obter saldo: HTTP ${res.status}`);

    const data = await res.json();
    this._balance = data.balance ?? 0;
    this._demoBalance = data.demoBalance ?? 0;
  }

  private async _fetchAssets(): Promise<void> {
    if (!this._token) throw new Error("Não autenticado");

    const res = await fetch(`${DAEMON_URL}/active`, {
      headers: { Authorization: `Bearer ${this._token}` },
    });

    if (res.status === 401) throw new Error("Sessão expirada");
    if (!res.ok) throw new Error(`Erro ao obter ativos: HTTP ${res.status}`);

    const data: ActiveAsset[] = await res.json();
    this._assets = (data ?? []).map((a) => ({
      symbol: a.symbol,
      name: a.name ?? a.symbol,
      category: a.category ?? "forex",
      payout: a.payout ?? 0.85,
      active: a.active ?? true,
      minAmount: a.minAmount ?? 1,
      maxAmount: a.maxAmount ?? 1000,
    }));
  }

  /* ── Session Change Handler ──────────────────────────────────────────────── */

  private _onSessionChange(from: MarketSession, to: MarketSession, info: MarketSessionInfo): void {
    engineLogger.info("PumaBroker", "═══ TROCA DE SESSÃO ═══", {
      from: from === "open" ? "Mercado Aberto" : "Mercado Fechado",
      to: to === "open" ? "Mercado Aberto" : "Mercado Fechado",
      dataSource: info.dataSource,
      assetsCount: info.assetsCount,
      assets: info.activeAssets.join(", "),
    });

    this._subscribedSymbols = new Set(info.activeAssets);

    if (to === "open") {
      this._binanceWs.disconnect();
      const symbols = Array.from(this._subscribedSymbols);
      this._binanceWs.connect(symbols, "M1");
      engineLogger.info(
        "PumaBroker",
        `Binance reconectado para ${symbols.length} ativos (Mercado Aberto)`,
        {},
      );
    } else {
      this._binanceWs.disconnect();
      engineLogger.info(
        "PumaBroker",
        "Binance desconectado — usando Puma Socket.IO (Mercado Fechado)",
        { assets: info.activeAssets.join(", ") },
      );
    }

    // Atualiza ativos no MarketDataService (Socket.IO)
    if (this._marketDataService) {
      this._marketDataService.updateAssets(info.activeAssets);
    }
  }

  /* ── IBroker implementation ──────────────────────────────────────────────── */

  async getCandles(asset: string, timeframe: string, limit = 50): Promise<Candle[]> {
    // Para M1, tenta o buffer em tempo real (alimentado por WS2)
    if (timeframe === "M1") {
      if (this._marketDataService?.connected) {
        const mdsCandles = this._marketDataService.getCandles(asset, limit);
        if (mdsCandles.length > 0) {
          return mdsCandles;
        }
      }
      engineLogger.warn("PumaBroker", `getCandles M1 VAZIO: ${asset}`, {
        mdsConnected: this._marketDataService?.connected ?? false,
        mdsState: this._marketDataService?.state ?? "disabled",
      });
      return [];
    }

    // Para M5/M15, busca via REST com a resolução correta
    const resolution = parseInt(timeframe.replace("M", "").replace("H", ""), 10);
    if (isNaN(resolution) || resolution < 1) {
      engineLogger.warn("PumaBroker", `getCandles: timeframe inválido`, { asset, timeframe });
      return [];
    }

    engineLogger.info("PumaBroker", `getCandles REST: ${asset} ${timeframe}`, {
      resolution,
      count: limit,
    });

    return this._fetchHistoryREST(asset, resolution, limit);
  }

  getBufferStatus(): { key: string; count: number; lastTime: string; lastClose: number }[] {
    if (this._marketDataService) {
      return this._marketDataService.getBufferStatus().map((item) => ({
        key: item.symbol,
        count: item.count,
        lastTime: item.lastTime,
        lastClose: item.lastClose,
      }));
    }
    return [];
  }

  clearCandleBuffer(): void {
    if (this._marketDataService) {
      this._marketDataService.clearBuffer();
    }
  }

  async getAssets(): Promise<BrokerAsset[]> {
    if (this._assets.length === 0) {
      await this._fetchAssets();
    }
    return [...this._assets];
  }

  async getPayout(asset: string): Promise<number> {
    const assets = await this.getAssets();
    return assets.find((a) => a.symbol === asset)?.payout ?? 0.85;
  }

  async buyCall(params: OrderParams): Promise<OrderResult> {
    return this._placeOrder(params, "CALL");
  }

  async buyPut(params: OrderParams): Promise<OrderResult> {
    return this._placeOrder(params, "PUT");
  }

  private async _placeOrder(params: OrderParams, direction: "CALL" | "PUT"): Promise<OrderResult> {
    if (!this._token || !this._userId) {
      throw new Error("Não autenticado. Faça login primeiro.");
    }

    const payout = await this.getPayout(params.asset);
    const timeframe = params.timeframe ?? "M1";

    let res: Response;
    try {
      res = await fetchWithRetry(`${DAEMON_URL}/trades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._token}`,
        },
        body: JSON.stringify({
          asset: params.asset,
          direction,
          amount: params.amount,
          expiration: params.expiration,
          entryPrice: params.entryPrice ?? 0,
          payout,
          timeframe,
          isDemo: this._isDemo,
        }),
      });
    } catch {
      throw new Error(
        "Daemon offline. Execute 'python proxy_daemon.py' no diretório pumabroker-api",
      );
    }

    if (res.status === 401) throw new Error("Sessão expirada. Refaça o login.");
    if (res.status === 403) throw new Error("Limite diário de operações atingido (conta demo).");
    if (!res.ok) {
      const body = await res.text().catch(() => "(sem corpo)");
      throw new Error(`Erro ao enviar ordem: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }

    const data: TradeResponse = await res.json();
    return {
      orderId: data.id,
      status: data.status === "ACTIVE" ? "accepted" : "rejected",
      message: data.message,
    };
  }

  async getResult(orderId: string): Promise<OrderStatus> {
    if (!this._token) throw new Error("Não autenticado");

    let res: Response;
    try {
      res = await fetchWithRetry(`${DAEMON_URL}/trades/${orderId}`, {
        headers: { Authorization: `Bearer ${this._token}` },
      });
    } catch {
      throw new Error(
        "Daemon offline. Execute 'python proxy_daemon.py' no diretório pumabroker-api",
      );
    }

    if (!res.ok) throw new Error(`Erro ao consultar ordem: HTTP ${res.status}`);

    const data = await res.json();
    return this._normalizeStatus(data.status ?? "ACTIVE");
  }

  waitForTradeResult(orderId: string, timeoutMs = 30000): Promise<OrderStatus> {
    console.log(
      `[DEBUG-TRADE] ⏱ waitForTradeResult START: orderId=${orderId}, timeoutMs=${timeoutMs}, now=${Date.now()}`,
    );
    return new Promise<OrderStatus>((resolve) => {
      const timer = setTimeout(async () => {
        console.log(`[DEBUG-TRADE] ⏱ TIMEOUT FIRED: orderId=${orderId}, now=${Date.now()}`);
        const pending = this._pendingTradeResults.get(orderId);
        if (!pending) {
          console.log(
            `[DEBUG-TRADE] ⏱ TIMEOUT: order ${orderId} already resolved/removed, skipping REST fallback`,
          );
          return;
        }
        this._pendingTradeResults.delete(orderId);
        try {
          const status = await this.getResult(orderId);
          console.log(`[DEBUG-TRADE] ⏱ REST FALLBACK RESULT: orderId=${orderId}, status=${status}`);
          resolve(status);
        } catch (err) {
          console.log(`[DEBUG-TRADE] ⏱ REST FALLBACK FAILED: orderId=${orderId}, error=${err}`);
          engineLogger.error("PumaBroker", "Timeout + REST falhou — assumindo ACTIVE", {
            orderId,
            error: String(err),
          });
          resolve("ACTIVE");
        }
      }, timeoutMs);

      this._pendingTradeResults.set(orderId, { resolve, timer });
      console.log(
        `[DEBUG-TRADE] ⏱ PENDING REGISTERED: orderId=${orderId}, pendingCount=${this._pendingTradeResults.size}`,
      );
    });
  }

  handleTradeUpdate(data: { id: string; status: string }): void {
    console.log(
      `[DEBUG-TRADE] 📊 handleTradeUpdate RECEIVED: id=${data.id}, status=${data.status}, now=${Date.now()}`,
    );
    const pending = this._pendingTradeResults.get(data.id);
    if (pending) {
      console.log(
        `[DEBUG-TRADE] 📊 handleTradeUpdate: PENDING FOUND, resolving with normalized status`,
      );
      clearTimeout(pending.timer);
      this._pendingTradeResults.delete(data.id);
      const normalized = this._normalizeStatus(data.status);
      console.log(`[DEBUG-TRADE] 📊 handleTradeUpdate: normalized ${data.status} -> ${normalized}`);
      pending.resolve(normalized);
    } else {
      console.log(
        `[DEBUG-TRADE] 📊 handleTradeUpdate: NO PENDING for ${data.id} (already resolved or not tracked)`,
      );
    }
  }

  subscribeAsset(symbol: string): void {
    if (this._subscribedSymbols.has(symbol)) return;
    this._subscribedSymbols.add(symbol);
    if (this._marketDataService) {
      this._marketDataService.updateAssets(Array.from(this._subscribedSymbols));
    }
    this._binanceWs.subscribeAsset(symbol);
  }

  subscribePrices(assets: string[], onPrice: (price: MarketPrice) => void): () => void {
    this._onPriceCallbacks.push(onPrice);
    return () => {
      this._onPriceCallbacks = this._onPriceCallbacks.filter((cb) => cb !== onPrice);
    };
  }

  subscribeCandleClose(onCandleClose: (candle: Candle) => void): () => void {
    this._onCandleCloseCallbacks.push(onCandleClose);
    return () => {
      this._onCandleCloseCallbacks = this._onCandleCloseCallbacks.filter(
        (cb) => cb !== onCandleClose,
      );
    };
  }

  async getBalance(): Promise<AccountBalance> {
    await this._fetchBalance();
    return {
      balance: this._balance,
      demoBalance: this._demoBalance,
      currency: "BRL",
    };
  }

  /* ── Helpers ─────────────────────────────────────────────────────────────── */

  private _normalizeStatus(raw: string): OrderStatus {
    const upper = raw.toUpperCase();
    if (
      upper === "WIN" ||
      upper === "LOSS" ||
      upper === "DRAW" ||
      upper === "ACTIVE" ||
      upper === "EXPIRED" ||
      upper === "CANCELED"
    ) {
      return upper as OrderStatus;
    }
    return "ACTIVE";
  }

  private _expirationToTimeframe(seconds: number): string {
    if (seconds <= 60) return "M1";
    if (seconds <= 300) return "M5";
    if (seconds <= 900) return "M15";
    if (seconds <= 1800) return "M30";
    return "H1";
  }
}
