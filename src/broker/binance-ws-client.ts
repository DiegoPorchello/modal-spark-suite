/**
 * broker/binance-ws-client.ts
 * Cliente WebSocket Binance para dados de mercado (klines/candles).
 *
 * Binance: sem autenticação, dados gratuitos e públicos.
 * Alimenta o mesmo _candleBuffer do PumaBrokerAdapter.
 *
 * Fluxo:
 *   1. Conecta em wss://stream.binance.com:9443/stream?streams=...
 *   2. Recebe klines em tempo real
 *   3. Quando kline fecha (k.x=true) → adiciona no buffer + notifica callbacks
 */

import type { Candle } from "../market/types";
import { engineLogger } from "../engine/logger";

const BINANCE_PROXY_URL = "http://127.0.0.1:3001/binance-klines";

// ── Mapeamento de símbolos Puma → Binance ──
// NOTA: Pares híbridos (BETHUSDT, BTSOLUSDT, MAPEUSDT, XRDOGUSDT, XRPSOLUSDT)
// NÃO existem na Binance — são sintéticos da Puma. São ignorados no subscribe.
export const SYMBOL_MAP: Record<string, string> = {
  EURUSD: "eurusdt",
  GBPUSD: "gbpusdt",
  USDJPY: "usdjpy",
  AUDUSD: "audusdt",
  USDCAD: "usdcad",
  NZDUSD: "nzdusdt",
  BTCUSD: "btcusdt",
  ETHUSD: "ethusdt",
  XAUUSD: "xauusdt",
};

const HYBRID_SYMBOLS = new Set(["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"]);

// ── Mapeamento de intervalos ──
const INTERVAL_MAP: Record<string, string> = {
  M1: "1m",
  M5: "5m",
  M15: "15m",
  M30: "30m",
  H1: "1h",
};

export type BinanceCandleCallback = (candle: Candle) => void;

export class BinanceWsClient {
  private ws: WebSocket | null = null;
  private _onCandleCloseCallbacks: BinanceCandleCallback[] = [];
  private _onCandle: (symbol: string, candle: Candle, isHistory?: boolean) => void;
  private _subscribedSymbols: Set<string> = new Set();
  private _interval: string = "1m";
  private _connected = false;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _BUFFER_MAX = 210;

  constructor(
    onCandle: (symbol: string, candle: Candle, isHistory?: boolean) => void,
    onCandleCloseCallbacks: BinanceCandleCallback[],
  ) {
    this._onCandle = onCandle;
    this._onCandleCloseCallbacks = onCandleCloseCallbacks;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(symbols: string[], interval: string = "M1"): void {
    this._interval = INTERVAL_MAP[interval] ?? "1m";
    this._subscribedSymbols = new Set(symbols.map((s) => s.toUpperCase()));

    // Conecta limpo — subscribe via mensagem JSON (mais confiável que URL longa)
    const url = "wss://stream.binance.com:9443/ws";

    engineLogger.info("BinanceWs", `Conectando`, {
      url,
      symbols: symbols.length,
      interval: this._interval,
    });

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this._connected = true;

        // Filtra pares híbridos (não existem na Binance)
        const validSymbols = symbols.filter((s) => !HYBRID_SYMBOLS.has(s.toUpperCase()));
        console.log(`[BinanceWs] ✅ CONECTADO — inscrevendo ${validSymbols.length} ativos (ignorados ${symbols.length - validSymbols.length} híbridos)`);

        // Inscreve via SUBSCRIBE message
        const streams = validSymbols.map((s) => {
          const binanceSymbol = SYMBOL_MAP[s.toUpperCase()] ?? s.toLowerCase();
          return `${binanceSymbol}@kline_${this._interval}`;
        });

        this.ws?.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: streams,
            id: Date.now(),
          }),
        );

        console.log(`[BinanceWs] SUBSCRIBE enviado: ${streams.join(", ")}`);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Resposta ao SUBSCRIBE
          if (msg.result === null || msg.id) {
            console.log(`[BinanceWs] Resposta: ${JSON.stringify(msg)}`);
            return;
          }

          // Combined stream: { stream: "...", data: { ... } }
          // Raw stream: { e: "kline", k: { ... } }
          const data = msg.data ?? msg;

          if (data.e === "kline") {
            this._handleKline(data);
          }
        } catch (err) {
          engineLogger.error("BinanceWs", `Erro ao processar mensagem`, {
            error: String(err),
          });
        }
      };

      this.ws.onerror = () => {
        engineLogger.error("BinanceWs", `❌ ERRO na conexão`);
        this._connected = false;
      };

      this.ws.onclose = () => {
        engineLogger.warn("BinanceWs", `⚠️ FECHADO — reconectando em 3s`);
        this._connected = false;
        this._scheduleReconnect();
      };

      // Busca histórico inicial para preencher o buffer
      this._fetchHistory(symbols);

    } catch (err) {
      engineLogger.error("BinanceWs", `Falha ao criar WebSocket`, { error: String(err) });
      this._scheduleReconnect();
    }
  }

  private async _fetchHistory(symbols: string[]): Promise<void> {
    const validSymbols = symbols.filter((s) => !HYBRID_SYMBOLS.has(s.toUpperCase()));
    for (const symbol of validSymbols) {
      try {
        const binanceSymbol = (SYMBOL_MAP[symbol.toUpperCase()] ?? symbol).toUpperCase();
        const url = `${BINANCE_PROXY_URL}?symbol=${binanceSymbol}&interval=${this._interval}&limit=100`;
        const res = await fetch(url);
        
        if (!res.ok) {
          engineLogger.warn("BinanceWs", `Falha ao buscar histórico REST: ${symbol}`, { status: res.status });
          continue;
        }

        const data = await res.json();
        const pumaInterval = this._reverseIntervalMap(this._interval) ?? "1";
        const key = `${symbol.toUpperCase()}:${pumaInterval}`;

        let fed = 0;
        for (const k of data) {
          const candle: Candle = {
            time: k[0] as number,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            asset: symbol.toUpperCase(),
          };
          // true indica que é histórico (evita processamento desnecessário como real-time)
          this._onCandle(symbol.toUpperCase(), candle, true);
          fed++;
        }

        engineLogger.info("BinanceWs", `Histórico REST Binance: ${symbol} — ${fed} candles carregados`, { key });
      } catch (err) {
        engineLogger.error("BinanceWs", `Erro ao buscar histórico REST para ${symbol}`, {
          error: String(err),
        });
      }
    }
  }

  disconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  subscribeAsset(symbol: string): void {
    this._subscribedSymbols.add(symbol.toUpperCase());
    // Reconecta com os novos symbols
    if (this._connected) {
      this.disconnect();
      this.connect(Array.from(this._subscribedSymbols), this._interval);
    }
  }

  private _handleKline(data: { s: string; k: Record<string, unknown> }): void {
    const k = data.k;
    const symbol = (k.s as string) ?? data.s;
    const interval = (k.i as string) ?? this._interval;
    const isClosed = k.x as boolean;

    // Encontra o nome Puma original pelo mapeamento reverso
    const pumaSymbol = this._reverseSymbolMap(symbol) ?? symbol.toUpperCase();

    // Converte intervalo Binance → Puma
    const pumaInterval = this._reverseIntervalMap(interval) ?? "1";

    const key = `${pumaSymbol}:${pumaInterval}`;

    const candle: Candle = {
      time: k.t as number,
      open: parseFloat(k.o as string),
      high: parseFloat(k.h as string),
      low: parseFloat(k.l as string),
      close: parseFloat(k.c as string),
      volume: parseFloat(k.v as string),
      asset: pumaSymbol,
    };

    // Repassa o candle para o buffer principal do sistema
    this._onCandle(pumaSymbol, candle);

    // Quando o candle FECHA → notifica callbacks
    if (isClosed) {
      engineLogger.info("BinanceWs", `🔔 Candle FECHADO: ${pumaSymbol}`, {
        key,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        time: new Date(candle.time).toISOString(),
      });

      for (const cb of this._onCandleCloseCallbacks) {
        try {
          cb(candle);
        } catch (err) {
          engineLogger.error("BinanceWs", `Callback de candle fechado falhou`, {
            error: String(err),
            symbol: pumaSymbol,
          });
        }
      }
    }
  }



  private _reverseSymbolMap(binanceSymbol: string): string | null {
    const upper = binanceSymbol.toUpperCase();
    for (const [puma, binance] of Object.entries(SYMBOL_MAP)) {
      if (binance.toUpperCase() === upper) return puma;
    }
    return null;
  }

  private _reverseIntervalMap(binanceInterval: string): string | null {
    for (const [puma, binance] of Object.entries(INTERVAL_MAP)) {
      if (binance === binanceInterval) return puma;
    }
    return null;
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      if (this._subscribedSymbols.size > 0) {
        this.connect(Array.from(this._subscribedSymbols), this._interval);
      }
    }, 3000);
  }
}
