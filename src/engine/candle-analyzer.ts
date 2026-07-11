/**
 * engine/candle-analyzer.ts
 * Análise individual de candles — calcula métricas por vela:
 * - Body% (tamanho do corpo relativo ao range total)
 * - Wick% (pavio superior e inferior)
 * - Direction (CALL/PUT/NEUTRAL)
 * - Range absoluto
 */

import type { Candle, CandleAnalysis } from "../market/types";

export function analyzeCandle(candle: Candle): CandleAnalysis {
  const range = candle.high - candle.low;
  if (range === 0) {
    return {
      bodyPercent: 0,
      wickTopPercent: 0,
      wickBottomPercent: 0,
      range: 0,
      direction: "NEUTRAL",
      strength: 0,
      expansion: 0,
      acceleration: 0,
    };
  }

  const body = Math.abs(candle.close - candle.open);
  const isGreen = candle.close > candle.open;

  const wickTop = candle.high - Math.max(candle.open, candle.close);
  const wickBottom = Math.min(candle.open, candle.close) - candle.low;

  const bodyPercent = (body / range) * 100;
  const wickTopPercent = (wickTop / range) * 100;
  const wickBottomPercent = (wickBottom / range) * 100;

  let direction: "CALL" | "PUT" | "NEUTRAL" = "NEUTRAL";
  if (body > 0) {
    direction = isGreen ? "CALL" : "PUT";
  }

  return {
    bodyPercent,
    wickTopPercent,
    wickBottomPercent,
    range,
    direction,
    strength: bodyPercent,
    expansion: 0,
    acceleration: 0,
  };
}

export function meetsBodyThreshold(candle: Candle, threshold = 60): boolean {
  const analysis = analyzeCandle(candle);
  return analysis.bodyPercent >= threshold;
}

export function meetsWickThreshold(candle: Candle, maxWickPercent = 30): boolean {
  const analysis = analyzeCandle(candle);
  return analysis.wickTopPercent < maxWickPercent || analysis.wickBottomPercent < maxWickPercent;
}

export function isStrongCandle(candle: Candle): boolean {
  const a = analyzeCandle(candle);
  return a.bodyPercent >= 60 && a.wickTopPercent <= 30 && a.wickBottomPercent <= 30;
}
