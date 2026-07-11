/**
 * market/types.ts
 * Tipos do módulo de Mercado.
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  asset: string;
  verify?: string;
}

export interface CandleAnalysis {
  bodyPercent: number;
  wickTopPercent: number;
  wickBottomPercent: number;
  range: number;
  direction: "CALL" | "PUT" | "NEUTRAL";
  strength: number;
  expansion: number;
  acceleration: number;
}

export interface MarketState {
  asset: string;
  timeframe: string;
  candles: Candle[];
  lastPrice: number;
  timestamp: number;
}

export type Timeframe = "M1" | "M5" | "M15";
