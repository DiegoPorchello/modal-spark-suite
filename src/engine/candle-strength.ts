/**
 * engine/candle-strength.ts
 * Cálculo da força de um candle (0-100).
 *
 * Componentes:
 * - Body% (0-40 pts): corpo > 60% = 40pts, corpo < 20% = 0pts
 * - Wick% (0-20 pts): pavio contrário < 10% = 20pts, > 50% = 0pts
 * - Range (0-20 pts): range maior que a média = mais pontos
 * - Expansão (0-10 pts): candle maior que o anterior
 * - Aceleração (0-10 pts): aceleração na tendência
 */

import type { Candle } from "../market/types";

export interface CandleStrengthResult {
  total: number; // 0-100
  bodyScore: number; // 0-40
  wickScore: number; // 0-20
  rangeScore: number; // 0-20
  expansionScore: number; // 0-10
  accelerationScore: number; // 0-10
}

export function calculateCandleStrength(
  current: Candle,
  previous?: Candle,
  meanRange?: number,
): CandleStrengthResult {
  const range = current.high - current.low;
  const body = Math.abs(current.close - current.open);
  const wickTop = current.high - Math.max(current.open, current.close);
  const wickBottom = Math.min(current.open, current.close) - current.low;

  // Body% (0-40 pts)
  const bodyPercent = range > 0 ? (body / range) * 100 : 0;
  const bodyScore = clamp(mapRange(bodyPercent, 20, 60, 0, 40), 0, 40);

  // Wick% (0-20 pts) — menor pavio contrário = melhor
  // Para CALL: wickTop é o contrário; para PUT: wickBottom
  const isGreen = current.close > current.open;
  const oppositeWick = isGreen ? wickTop : wickBottom;
  const wickPercent = range > 0 ? (oppositeWick / range) * 100 : 0;
  const wickScore = clamp(mapRange(wickPercent, 50, 10, 0, 20), 0, 20);

  // Range (0-20 pts) — comparado à média
  const mr = meanRange ?? range;
  const rangeRatio = mr > 0 ? range / mr : 1;
  const rangeScore = clamp(mapRange(rangeRatio, 0.3, 1.5, 0, 20), 0, 20);

  // Expansão (0-10 pts) — candle atual maior que o anterior
  let expansionScore = 5;
  if (previous) {
    const prevRange = previous.high - previous.low;
    if (prevRange > 0) {
      const expansion = range / prevRange;
      expansionScore = clamp(mapRange(expansion, 0.5, 2, 0, 10), 0, 10);
    }
  }

  // Aceleração (0-10 pts) — aumento progressivo no range
  let accelerationScore = 5;
  if (previous) {
    const prevBody = Math.abs(previous.close - previous.open);
    if (prevBody > 0) {
      const accel = body / prevBody;
      accelerationScore = clamp(mapRange(accel, 0.5, 2, 0, 10), 0, 10);
    }
  }

  const total = bodyScore + wickScore + rangeScore + expansionScore + accelerationScore;

  return {
    total: clamp(total, 0, 100),
    bodyScore,
    wickScore,
    rangeScore,
    expansionScore,
    accelerationScore,
  };
}

function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMin === inMax) return outMin;
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
