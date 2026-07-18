/**
 * market/index.ts
 * Módulo de Mercado — obtenção e gerenciamento de dados de mercado.
 */

import type { IBroker } from "../broker/types";
import type { Candle, MarketState, Timeframe } from "./types";

export type { Candle, CandleAnalysis, MarketState, Timeframe } from "./types";
export { CandleBuffer } from "./candle-buffer";
export type { BufferState, BufferStateInfo, CandleBufferOptions, CandleAddResult } from "./candle-buffer";
export { PumaMarketDataService } from "./market-data-service";
export type { PumaMarketDataServiceOptions } from "./market-data-service";

export class MarketDataService {
  private broker: IBroker;
  private cache: Map<string, { candles: Candle[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3000;

  constructor(broker: IBroker) {
    this.broker = broker;
  }

  async getCandles(asset: string, timeframe: Timeframe, limit = 50): Promise<Candle[]> {
    const key = `${asset}_${timeframe}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.candles;
    }
    const candles = await this.broker.getCandles(asset, timeframe, limit);
    this.cache.set(key, { candles, timestamp: Date.now() });
    return candles;
  }

  getState(asset: string, timeframe: Timeframe, candles: Candle[]): MarketState {
    return {
      asset,
      timeframe,
      candles,
      lastPrice: candles[candles.length - 1]?.close ?? 0,
      timestamp: Date.now(),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
