/**
 * hybrid-probability.indicators.ts
 *
 * Indicadores usados pelo filtro do Hybrid Probability.
 *
 * Estratégia base: 2 candles da mesma cor → entrar no 3º na mesma direção.
 * Os filtros abaixo evitam operar em contexto errado (lateralização):
 *   1. ADX        → mercado com força (ADX > 25) libera; < 20 bloqueia.
 *   2. EMA 200    → direção apenas a favor da tendência de longo prazo.
 *   3. ATR        → volatilidade suficiente (acima da média das últimas 20 velas).
 *   4. Flow Index → mede o próprio comportamento das velas (continuidade x alternância).
 *
 * As fórmulas de ADX/ATR são idênticas às do MomentumEngine para manter coerência.
 */

import type { Candle } from "../../../../market/types";

export type CandleColor = "GREEN" | "RED";

export function candleColor(candle: Candle): CandleColor {
  return candle.close >= candle.open ? "GREEN" : "RED";
}

/** EMA de fechamentos. Retorna o array completo (último = valor atual). */
export function calcEMA(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [closes.slice(0, period).reduce((s, v) => s + v, 0) / period];
  for (let i = period; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

/** Valor atual da EMA para um período (ex.: 200). null se sem dados suficientes. */
export function emaValue(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const ema = calcEMA(closes, period);
  return ema[ema.length - 1];
}

export function calcADX(candles: Candle[], period = 14): number {
  if (!candles || candles.length < period * 2) return 0;
  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const prevHigh = candles[i - 1].high;
    const low = candles[i].low;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    if (high == null || low == null || prevHigh == null || prevLow == null || prevClose == null) continue;
    if (isNaN(high) || isNaN(low) || isNaN(prevHigh) || isNaN(prevLow) || isNaN(prevClose)) continue;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
    const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
    const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }
  if (trs.length < period * 2) return 0;
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let plusDM = plusDMs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let minusDM = minusDMs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const dxs: number[] = [];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    plusDM = (plusDM * (period - 1) + plusDMs[i]) / period;
    minusDM = (minusDM * (period - 1) + minusDMs[i]) / period;
    const plusDI = atr > 0 ? (plusDM / atr) * 100 : 0;
    const minusDI = atr > 0 ? (minusDM / atr) * 100 : 0;
    const diSum = plusDI + minusDI;
    dxs.push(diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);
  }
  if (dxs.length < period) return dxs.length > 0 ? dxs[dxs.length - 1] : 0;
  let adx = dxs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < dxs.length; i++) {
    adx = (adx * (period - 1) + dxs[i]) / period;
  }
  return adx;
}

export function calcATR(candles: Candle[], period = 14): number {
  if (!candles || candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    if (h == null || l == null || pc == null) continue;
    if (isNaN(h) || isNaN(l) || isNaN(pc)) continue;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return 0;
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

export interface FlowIndexResult {
  /** 0..1 — fração de passos de continuação (mesma cor) vs alternância. */
  flowIndex: number;
  continuations: number;
  alternations: number;
  /** true se há predomínio de continuidade (mercado em fluxo). */
  inFlow: boolean;
}

/**
 * Flow Index — filtro coerente com a estratégia de sequência de velas.
 * Nas últimas `lookback` velas, conta quantos passos mantiveram a cor
 * (continuação) vs quantos alternaram (verde/vermelho/verde...).
 * Predomínio de continuação → mercado em fluxo → operar.
 * Predomínio de alternância  → mercado lateral    → não operar.
 */
export function calcFlowIndex(candles: Candle[], lookback = 20): FlowIndexResult {
  const slice = candles.slice(-lookback);
  let continuations = 0;
  let alternations = 0;

  for (let i = 1; i < slice.length; i++) {
    const prev = candleColor(slice[i - 1]);
    const curr = candleColor(slice[i]);
    if (curr === prev) continuations++;
    else alternations++;
  }

  const total = continuations + alternations;
  const flowIndex = total > 0 ? continuations / total : 0;

  return {
    flowIndex,
    continuations,
    alternations,
    inFlow: flowIndex >= 0.55,
  };
}

/** Média simples do True Range das últimas `period` velas (baseline de volatilidade). */
export function atrBaseline(candles: Candle[], period = 20): number {
  if (candles.length < period + 1) {
    return calcATR(candles, Math.max(2, candles.length - 1));
  }
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return trs.reduce((s, v) => s + v, 0) / trs.length;
}

/** Detecta a configuração "2 candles da mesma cor" e a direção candidata. */
export interface ContinuationSetup {
  detected: boolean;
  color: CandleColor | null;
  direction: "CALL" | "PUT" | null;
}

export function detectContinuation(candles: Candle[]): ContinuationSetup {
  if (candles.length < 2) {
    return { detected: false, color: null, direction: null };
  }
  const last = candleColor(candles[candles.length - 1]);
  const prev = candleColor(candles[candles.length - 2]);
  if (last === prev) {
    return {
      detected: true,
      color: last,
      direction: last === "GREEN" ? "CALL" : "PUT",
    };
  }
  return { detected: false, color: null, direction: null };
}
