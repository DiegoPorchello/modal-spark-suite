/**
 * market/market-data-service.ts
 * Serviço unificado de dados de mercado Puma.
 *
 * ÚNICO cliente Socket.IO ativo — orquestra PumaSocketClient e CandleBuffer.
 *
 * Arquitetura:
 *   PumaSocketClient → PumaMarketDataService → CandleBuffer → DecisionEngine
 *   Binance (externo) → addCandleFromExternal() → CandleBuffer
 *
 * Token JWT é obtido EXCLUSIVAMENTE do login atual (accessToken).
 * NUNCA utiliza tokens antigos ou persistidos.
 */

import type { Candle } from "./types";
import { CandleBuffer, type CandleBufferOptions, type CandleAddResult } from "./candle-buffer";
import {
  PumaSocketClient,
  type TickData,
  type CandleData,
  type TradeUpdateData,
  type TradeResultData,
} from "../broker/puma-socket-client";

export type {
  TickData,
  CandleData,
  TradeUpdateData,
  TradeResultData,
} from "../broker/puma-socket-client";
import { SYMBOL_MAP } from "../broker/binance-ws-client";

const BINANCE_PROXY_URL = "http://127.0.0.1:3001/binance-klines";
import { engineLogger } from "../engine/logger";

export interface PumaMarketDataServiceOptions {
  jwt: string;
  userId: string;
  assets: string[];
  interval?: number;
  bufferOptions?: CandleBufferOptions;
  onBufferReady?: (symbol: string, count: number) => void;
  onCandleUpdate?: (symbol: string, candle: Candle) => void;
  onCandleClosed?: (symbol: string, candle: Candle) => void;
  onTick?: (data: TickData) => void;
  onTradeUpdate?: (data: TradeUpdateData) => void;
  onTradeResult?: (data: TradeResultData) => void;
  onRefreshJwt?: () => Promise<string>;
}

export class PumaMarketDataService {
  static _nextId = 1;
  readonly instanceId: number;
  private _client: PumaSocketClient;
  private _buffer: CandleBuffer;
  private _options: PumaMarketDataServiceOptions;

  private _connected = false;
  private _bufferReadySymbols = new Set<string>();
  private _firstTickLogged = new Map<string, boolean>();
  private _firstCandleLogged = new Map<string, boolean>();
  /** Ativos sintéticos Puma — não existem na Binance, recebem candles via WS2/otc */
  private readonly HYBRID_THRESHOLD = 200;
  private _hybridAssets = new Set<string>([
    "BETHUSDT",
    "BTSOLUSDT",
    "MAPEUSDT",
    "XRDOGUSDT",
    "XRPSOLUSDT",
  ]);
  private _candleCounts = new Map<string, number>();
  private _prefilledAssets = new Set<string>();

  constructor(options: PumaMarketDataServiceOptions) {
    this.instanceId = PumaMarketDataService._nextId++;
    this._options = options;
    this._buffer = new CandleBuffer(options.bufferOptions);

    this._client = new PumaSocketClient({
      jwt: options.jwt,
      userId: options.userId,
      assets: options.assets,
      interval: options.interval ?? 60,
      onTick: (data) => this._handleTick(data),
      onCandle: (data) => this._handleCandle(data),
      onTradeUpdate: (data) => this._handleTradeUpdate(data),
      onTradeResult: (data) => this._handleTradeResult(data),
      onConnect: () => this._handleConnect(),
      onDisconnect: (reason) => this._handleDisconnect(reason),
      onError: (error) => this._handleError(error),
      onRefreshJwt: options.onRefreshJwt,
    });

    engineLogger.info("PumaMarketDataService", `Nova instância #${this.instanceId}`, {
      bufferId: this._buffer.instanceId,
      clientId: this._client.instanceId,
      assets: options.assets.join(", "),
    });
  }

  get connected(): boolean {
    return this._connected && this._client.connected;
  }

  get buffer(): CandleBuffer {
    return this._buffer;
  }

  get state(): string {
    return this._client.state;
  }

  get tradesConnected(): boolean {
    return this._client.tradesConnected;
  }

  get otcConnected(): boolean {
    return this._client.otcConnected;
  }

  get subscribedAssets(): string[] {
    return this._client.subscribedAssets;
  }

  /* ── Connection ──────────────────────────────────────────────────────────── */

  connect(): void {
    engineLogger.info("PumaMarketDataService", "Iniciando conexão Socket.IO...", {
      assets: this._options.assets.join(", "),
      interval: this._options.interval ?? 60,
      minRequired: this._buffer.minRequired,
    });
    this._client.connect();
  }

  disconnect(): void {
    this._client.disconnect();
    this._connected = false;
    this._bufferReadySymbols.clear();
    this._candleCounts.clear();
    this._prefilledAssets.clear();
  }

  /* ── External Candle Feed ────────────────────────────────────────────────── */

  /**
   * Alimenta o buffer com candles de fontes externas (Binance).
   * Usado pelo PumaBrokerAdapter para consolidar dados em um único buffer.
   */
  addCandleFromExternal(symbol: string, candle: Candle, isClosed: boolean = true): void {
    const result: CandleAddResult = this._buffer.addCandle(symbol, candle, isClosed, "history");
    // ... rest of existing code

    if (result === "added" || result === "closed") {
      const count = this._buffer.getBufferCount(symbol);
      this._candleCounts.set(symbol, count);

      // Log de monitoramento a cada 10 candles ou nos primeiros
      if (count <= 10 || count % 20 === 0 || count === 200) {
        engineLogger.info("PumaMarketDataService", `[MONITOR] addCandleFromExternal: ${symbol}`, {
          count,
          totalCandles: this._candleCounts.get(symbol),
          isClosed,
        });
      }

      // Verificar se atingiu mínimo
      const isHybrid = this._hybridAssets.has(symbol.toUpperCase());
      const minRequired = isHybrid ? this.HYBRID_THRESHOLD : this._buffer.minRequired;
      if (count >= minRequired && !this._bufferReadySymbols.has(symbol)) {
        this._bufferReadySymbols.add(symbol);

        // Marca LIVE para fontes externas que atingiram mínimo
        if (!this._prefilledAssets.has(symbol.toUpperCase())) {
          this._buffer.markAsLive(symbol);
        }

        engineLogger.info(
          "PumaMarketDataService",
          `═══ BUFFER PRONTO (externo): ${symbol} (${count} candles${isHybrid ? " híbrido" : ""}) ═══`,
          {},
        );
        this._options.onBufferReady?.(symbol, count);
      }

      // Notificar atualização (UI etc.)
      this._options.onCandleUpdate?.(symbol, candle);
    }
  }

  /* ── Handlers ────────────────────────────────────────────────────────────── */

  private _handleConnect(): void {
    this._connected = true;
    engineLogger.info("PumaMarketDataService", "═══ PUMA SOCKET.IO CONECTADO ═══", {
      assets: this._options.assets.join(", "),
      namespaces: "/trades + /otc",
    });

    this._prefillFromBinance();
  }

  /**
   * Pré-preenche o CandleBuffer com candles históricos do Binance.
   * Ativos híbridos Puma (HYBRID_ASSETS) são ignorados na Binance
   * porque não existem nessa exchange — seus dados vêm do Puma /otc.
   */
  private async _prefillFromBinance(): Promise<void> {
    engineLogger.info("PumaMarketDataService", "═══ PRÉ-PREENCHENDO BUFFER VIA BINANCE ═══", {});

    for (const asset of this._options.assets) {
      const upperAsset = asset.replace("/", "").toUpperCase();

      // Pula ativos híbridos — não existem na Binance (já estão em _hybridAssets)
      if (this._hybridAssets.has(upperAsset)) {
        engineLogger.info("PumaMarketDataService", `SKIP BINANCE (híbrido): ${upperAsset}`, {
          reason: `Par sintético Puma — dados chegam via WS2/otc (threshold=${this.HYBRID_THRESHOLD})`,
        });
        continue;
      }

      try {
        const interval = this._options.interval ?? 60;
        const binanceInterval =
          interval >= 3600 ? `${Math.floor(interval / 3600)}h` : `${Math.floor(interval / 60)}m`;
        const binanceSymbol = (SYMBOL_MAP[upperAsset] ?? upperAsset).toUpperCase();

        const url = `${BINANCE_PROXY_URL}?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=200`;
        const response = await fetch(url);

        if (!response.ok) {
          engineLogger.warn(
            "PumaMarketDataService",
            `Binance API erro ${response.status}: ${upperAsset}`,
            {},
          );
          continue;
        }

        const data: Array<Array<number | string>> = await response.json();

        let addedCount = 0;
        for (const k of data) {
          const candle: Candle = {
            time: k[0] as number,
            open: parseFloat(k[1] as string),
            high: parseFloat(k[2] as string),
            low: parseFloat(k[3] as string),
            close: parseFloat(k[4] as string),
            volume: parseFloat(k[5] as string),
            asset: upperAsset,
          };
          this._buffer.addCandle(upperAsset, candle, true, "history");
          addedCount++;
        }

        const total = this._buffer.getBufferCount(upperAsset);
        this._candleCounts.set(upperAsset, total);

        engineLogger.info("PumaMarketDataService", `═══ BUFFER PRÉ-PREENCHIDO: ${upperAsset} ═══`, {
          added: addedCount,
          total,
          source: "Binance",
          interval: binanceInterval,
        });

        // Pré-preenchimento completo → marca como LIVE (ativa proteção cronológica)
        this._buffer.markAsLive(upperAsset);
        this._prefilledAssets.add(upperAsset);

        if (total >= this._buffer.minRequired && !this._bufferReadySymbols.has(upperAsset)) {
          this._bufferReadySymbols.add(upperAsset);
          engineLogger.info(
            "PumaMarketDataService",
            `═══ BUFFER PRONTO (pré-preenchido): ${upperAsset} (${total} candles) ═══`,
            {},
          );
          this._options.onBufferReady?.(upperAsset, total);
        }
      } catch (err) {
        engineLogger.warn("PumaMarketDataService", `Falha ao pré-preencher buffer: ${asset}`, {
          error: String(err),
        });
      }
    }
  }

  private _handleDisconnect(reason: string): void {
    this._connected = false;
    engineLogger.warn("PumaMarketDataService", "Puma Socket.IO desconectado", { reason });
  }

  private _handleError(error: string): void {
    engineLogger.error("PumaMarketDataService", "Erro no Puma Socket.IO", { error });
  }

  private _handleTick(data: TickData): void {
    if (!this._firstTickLogged.get(data.symbol)) {
      this._firstTickLogged.set(data.symbol, true);
      engineLogger.info("PumaMarketDataService", `✅ Primeiro Tick: ${data.symbol}`, {
        price: data.price,
        time: new Date(data.time).toISOString(),
      });
    }

    this._options.onTick?.(data);
  }

  private _handleCandle(data: CandleData): void {
    const candle: Candle = {
      time: data.time,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume,
      asset: data.symbol,
      verify: data.verify,
    };

    console.log(
      `[TIMING] HANDLE_CANDLE symbol=${data.symbol} time=${data.time} open=${data.open} close=${data.close} tsDate=${Date.now()}`
    );

    if (!this._firstCandleLogged.get(data.symbol)) {
      this._firstCandleLogged.set(data.symbol, true);
      engineLogger.info("PumaMarketDataService", `Primeiro Candle: ${data.symbol}`, {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        time: new Date(candle.time).toISOString(),
      });
    }

    const result: CandleAddResult = this._buffer.addCandle(data.symbol, candle, true, "realtime");

    // Notificar UI sempre que o candle for atualizado
    if (result === "updated" || result === "closed" || result === "added") {
      this._options.onCandleUpdate?.(data.symbol, candle);
    }

    // Apenas candle adicionado ou fechado → verificar buffer
    if (result === "closed" || result === "added") {
      const count = this._buffer.getBufferCount(data.symbol);
      this._candleCounts.set(data.symbol, count);

      // Ativos híbridos usam threshold unificado (200)
      const isHybrid = this._hybridAssets.has(data.symbol.toUpperCase());
      const minRequired = isHybrid ? this.HYBRID_THRESHOLD : this._buffer.minRequired;

      if (count <= 10 || count % 20 === 0 || count === minRequired) {
        engineLogger.info("PumaMarketDataService", `Buffer: ${data.symbol}`, {
          count,
          minRequired,
          ready: count >= minRequired,
          isHybrid,
        });
      }

      if (count >= minRequired && !this._bufferReadySymbols.has(data.symbol)) {
        this._bufferReadySymbols.add(data.symbol);

        // Marca LIVE apenas se não veio do pré-preenchimento Binance
        // (híbridos ou ativos que atingiram mínimo via real-time)
        if (!this._prefilledAssets.has(data.symbol.toUpperCase())) {
          this._buffer.markAsLive(data.symbol);
        }

        engineLogger.info(
          "PumaMarketDataService",
          `═══ BUFFER PRONTO: ${data.symbol} (${count} candles${isHybrid ? " híbrido" : ""}) ═══`,
          {},
        );
        this._options.onBufferReady?.(data.symbol, count);
      }
    }

    // Candle fechado → notificar consumidores pesados (FlowRobot, Indicadores, IA, Executor, Recovery)
    if (result === "closed") {
      console.log(
        `[TIMING] CANDLE_CLOSED_CALLBACK symbol=${data.symbol} time=${candle.time} open=${candle.open} close=${candle.close} tsDate=${Date.now()}`
      );
      this._options.onCandleClosed?.(data.symbol, candle);
    }
  }

  private _handleTradeUpdate(data: TradeUpdateData): void {
    console.log("[DEBUG-TRADE] 📊 MarketDataService forwarding tradeUpdate:", {
      id: data.id,
      status: data.status,
      symbol: data.symbol,
    });
    this._options.onTradeUpdate?.(data);
  }

  private _handleTradeResult(data: TradeResultData): void {
    console.log("[DEBUG-TRADE] 🏁 MarketDataService forwarding tradeResult:", {
      id: data.id,
      status: data.status,
      profit: data.profit,
    });
    this._options.onTradeResult?.(data);
  }

  /* ── Queries ─────────────────────────────────────────────────────────────── */

  getCandles(symbol: string, limit?: number): Candle[] {
    return this._buffer.getCandles(symbol, limit);
  }

  getLastCandle(symbol: string): Candle | null {
    return this._buffer.getLastCandle(symbol);
  }

  hasMinimumData(symbol: string): boolean {
    const isHybrid = this._hybridAssets.has(symbol.toUpperCase());
    if (isHybrid) {
      return this._buffer.getBufferCount(symbol) >= this.HYBRID_THRESHOLD;
    }
    return this._buffer.hasMinimumData(symbol);
  }

  getBufferCount(symbol: string): number {
    return this._buffer.getBufferCount(symbol);
  }

  clearBuffer(): void {
    this._buffer.clear();
    this._bufferReadySymbols.clear();
    this._candleCounts.clear();
    this._prefilledAssets.clear();
    engineLogger.info("PumaMarketDataService", "═══ BUFFER LIMPO ═══", {});
  }

  getBufferStatus(): Array<{
    symbol: string;
    count: number;
    hasMinimum: boolean;
    lastTime: string;
    lastClose: number;
  }> {
    return this._buffer.getBufferStatus();
  }

  getConnectionStatus(): {
    connected: boolean;
    state: string;
    tradesConnected: boolean;
    otcConnected: boolean;
    bufferReady: string[];
    candleCounts: Record<string, number>;
  } {
    const counts: Record<string, number> = {};
    this._candleCounts.forEach((v, k) => {
      counts[k] = v;
    });

    return {
      connected: this._connected,
      state: this._client.state,
      tradesConnected: this._client.tradesConnected,
      otcConnected: this._client.otcConnected,
      bufferReady: Array.from(this._bufferReadySymbols),
      candleCounts: counts,
    };
  }

  /* ── Update Assets ───────────────────────────────────────────────────────── */

  updateAssets(assets: string[]): void {
    this._options.assets = [...assets];
    this._client.updateAssets(assets);
  }
}
