/**
 * engine/continuity-detector.ts
 * Detecta continuidade — sequência de candles no mesmo sentido.
 *
 * Estratégia v2:
 * - CALL: vela anterior verde + vela atual verde → entra na terceira
 * - PUT:  vela anterior vermelha + vela atual vermelha → entra na terceira
 * - Não exige candles fortes, apenas mesma cor consecutiva
 *
 * Retorna direção e força da continuidade (0-100).
 */

import type { Candle } from "../market/types";

export interface ContinuityResult {
  hasContinuity: boolean;
  direction: "CALL" | "PUT" | null;
  strength: number;
  consecutiveCandles: number;
}

export function detectContinuity(candles: Candle[]): ContinuityResult {
  if (candles.length < 3) {
    return { hasContinuity: false, direction: null, strength: 0, consecutiveCandles: 0 };
  }

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  const prevGreen = prev.close > prev.open;
  const currGreen = current.close > current.open;

  let direction: "CALL" | "PUT" | null = null;
  let hasContinuity = false;
  let consecutiveCandles = 0;

  // CALL: dois candles verdes consecutivos (qualquer tamanho)
  if (prevGreen && currGreen) {
    hasContinuity = true;
    direction = "CALL";
  }
  // PUT: dois candles vermelhos consecutivos (qualquer tamanho)
  else if (!prevGreen && !currGreen) {
    hasContinuity = true;
    direction = "PUT";
  }

  if (hasContinuity) {
    // Conta quantos candles consecutivos na mesma direção
    const lookback = candles.slice(0, -1).reverse();
    consecutiveCandles = 2;
    for (const c of lookback) {
      if (direction === "CALL" && c.close > c.open) {
        consecutiveCandles++;
      } else if (direction === "PUT" && c.close < c.open) {
        consecutiveCandles++;
      } else {
        break;
      }
    }
  }

  // Força: quanto mais candles consecutivos, maior a continuidade
  const strength = hasContinuity ? Math.min(100, 50 + consecutiveCandles * 12.5) : 0;

  return { hasContinuity, direction, strength, consecutiveCandles };
}

export function detectDominance(candles: Candle[]): number {
  if (candles.length < 5) return 0;

  const lookback = candles.slice(-10);
  let greenCount = 0;
  let redCount = 0;

  for (const c of lookback) {
    if (c.close > c.open) greenCount++;
    else if (c.close < c.open) redCount++;
  }

  const total = greenCount + redCount;
  if (total === 0) return 0;

  const dominance = Math.abs(greenCount - redCount) / total;
  const direction = greenCount > redCount ? 1 : -1;

  return dominance * 100 * direction;
}
