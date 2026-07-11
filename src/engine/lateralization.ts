/**
 * engine/lateralization.ts
 * Detecta lateralização (range estreito) para bloquear entradas.
 *
 * Critérios:
 * - Range estreito: amplitude dos últimos candles < threshold
 * - Topo repetido: preço bate no mesmo nível várias vezes
 * - Fundo repetido: preço bate no mesmo nível várias vezes
 *
 * Quando detectado, bloqueia entradas para evitar whipsaw.
 */

import type { Candle } from "../market/types";

export interface LateralizationResult {
  isLateralized: boolean;
  rangePercent: number;
  repeatedTop: boolean;
  repeatedBottom: boolean;
  reason: string | null;
}

export function detectLateralization(candles: Candle[], lookback = 10): LateralizationResult {
  if (candles.length < lookback) {
    return {
      isLateralized: false,
      rangePercent: 0,
      repeatedTop: false,
      repeatedBottom: false,
      reason: null,
    };
  }

  const recent = candles.slice(-lookback);
  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const closes = recent.map((c) => c.close);

  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const avgClose = closes.reduce((s, v) => s + v, 0) / closes.length;

  // Range percentual
  const rangePercent = avgClose > 0 ? ((maxHigh - minLow) / avgClose) * 100 : 0;

  // Range estreito: < 0.3% do preço médio
  const isNarrowRange = rangePercent < 0.3;

  // Topo repetido: high se aproxima do mesmo nível 3+ vezes
  const topProximity = 0.001; // 0.1%
  let topTouches = 0;
  for (let i = 0; i < highs.length; i++) {
    if (Math.abs(highs[i] - maxHigh) / maxHigh < topProximity) {
      topTouches++;
    }
  }
  const repeatedTop = topTouches >= 3;

  // Fundo repetido: low se aproxima do mesmo nível 3+ vezes
  let bottomTouches = 0;
  for (let i = 0; i < lows.length; i++) {
    if (Math.abs(lows[i] - minLow) / minLow < topProximity) {
      bottomTouches++;
    }
  }
  const repeatedBottom = bottomTouches >= 3;

  const isLateralized = isNarrowRange || (repeatedTop && repeatedBottom);

  let reason: string | null = null;
  if (isLateralized) {
    const reasons: string[] = [];
    if (isNarrowRange) reasons.push(`Range estreito: ${rangePercent.toFixed(2)}%`);
    if (repeatedTop) reasons.push(`Topo repetido ${topTouches}x`);
    if (repeatedBottom) reasons.push(`Fundo repetido ${bottomTouches}x`);
    reason = reasons.join(" | ");
  }

  return { isLateralized, rangePercent, repeatedTop, repeatedBottom, reason };
}
