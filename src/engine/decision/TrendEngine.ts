/**
 * engine/decision/TrendEngine.ts
 * Calcula tendência via EMAs (9/21/50) + estrutura HH/HL/LH/LL.
 * Score máximo: 20 pontos.
 * Mínimo de candles: 60 (para EMA50 ter dados suficientes).
 */

import type { Candle } from "../../market/types";

export type TrendDirection = "UPTREND" | "DOWNTREND" | "SIDEWAYS";

export interface TrendResult {
  direction: TrendDirection;
  ema9: number;
  ema21: number;
  ema50: number;
  emaAlignment: "bullish" | "bearish" | "mixed";
  structure: "HH_HL" | "LH_LL" | "mixed";
  priceVsEma50: "above" | "below";
  ema9Slope: "up" | "down" | "flat";
  score: number;
  passed: boolean;
  details: string[];
}

export class TrendEngine {
  private static readonly MIN_CANDLES = 60;
  private static readonly MAX_SCORE = 20;

  analyze(candles: Candle[]): TrendResult {
    if (candles.length < TrendEngine.MIN_CANDLES) {
      return this.buildResult({
        direction: "SIDEWAYS",
        ema9: 0,
        ema21: 0,
        ema50: 0,
        emaAlignment: "mixed",
        structure: "mixed",
        priceVsEma50: "above",
        ema9Slope: "flat",
        score: 0,
        passed: false,
        details: [`Dados insuficientes: ${candles.length}/${TrendEngine.MIN_CANDLES} candles`],
      });
    }

    const closes = candles.map((c) => c.close);
    const ema9 = this.calcEMA(closes, 9);
    const ema21 = this.calcEMA(closes, 21);
    const ema50 = this.calcEMA(closes, 50);

    const lastEma9 = ema9[ema9.length - 1];
    const lastEma21 = ema21[ema21.length - 1];
    const lastEma50 = ema50[ema50.length - 1];
    const lastClose = closes[closes.length - 1];

    const details: string[] = [];
    let score = 0;

    // ── 1. EMA Alignment (0-8 pts) ──
    let emaAlignment: TrendResult["emaAlignment"] = "mixed";
    if (lastEma9 > lastEma21 && lastEma21 > lastEma50) {
      emaAlignment = "bullish";
      score += 8;
      details.push(
        `✔ EMA9(${lastEma9.toFixed(2)}) > EMA21(${lastEma21.toFixed(2)}) > EMA50(${lastEma50.toFixed(2)}) — Alta`,
      );
    } else if (lastEma9 < lastEma21 && lastEma21 < lastEma50) {
      emaAlignment = "bearish";
      score += 8;
      details.push(
        `✔ EMA9(${lastEma9.toFixed(2)}) < EMA21(${lastEma21.toFixed(2)}) < EMA50(${lastEma50.toFixed(2)}) — Baixa`,
      );
    } else if (lastEma9 > lastEma21) {
      emaAlignment = "bullish";
      score += 4;
      details.push(`◐ EMA9 > EMA21 mas sem alinhamento completo — Parcial`);
    } else if (lastEma9 < lastEma21) {
      emaAlignment = "bearish";
      score += 4;
      details.push(`◐ EMA9 < EMA21 mas sem alinhamento completo — Parcial`);
    } else {
      details.push(`✖ EMAs cruzadas — Sem direção`);
    }

    // ── 2. Preço vs EMA50 (0-4 pts) ──
    const priceVsEma50 = lastClose > lastEma50 ? "above" : "below";
    if (priceVsEma50 === "above" && emaAlignment === "bullish") {
      score += 4;
      details.push(`✔ Preço acima da EMA50 — Confirma alta`);
    } else if (priceVsEma50 === "below" && emaAlignment === "bearish") {
      score += 4;
      details.push(`✔ Preço abaixo da EMA50 — Confirma baixa`);
    } else if (priceVsEma50 === "above") {
      score += 2;
      details.push(`◐ Preço acima da EMA50 mas EMA não alinhada`);
    } else {
      score += 2;
      details.push(`◐ Preço abaixo da EMA50 mas EMA não alinhada`);
    }

    // ── 3. Inclinação EMA9 (0-4 pts) ──
    const ema9Prev = ema9[ema9.length - 5] ?? lastEma9;
    const ema9SlopeVal = lastEma9 - ema9Prev;
    const ema9Slope = ema9SlopeVal > 0.0001 ? "up" : ema9SlopeVal < -0.0001 ? "down" : "flat";
    if (ema9Slope === "up" && emaAlignment === "bullish") {
      score += 4;
      details.push(`✔ EMA9 inclinacao positiva — Momentum de alta`);
    } else if (ema9Slope === "down" && emaAlignment === "bearish") {
      score += 4;
      details.push(`✔ EMA9 inclinacao negativa — Momentum de baixa`);
    } else if (ema9Slope !== "flat") {
      score += 2;
      details.push(`◐ EMA9 inclinacao ${ema9Slope === "up" ? "positiva" : "negativa"} — Parcial`);
    } else {
      details.push(`✖ EMA9 plana`);
    }

    // ── 4. Estrutura HH/HL/LH/LL (0-4 pts) ──
    const structure = this.detectSwingStructure(closes.slice(-30));
    if (structure === "HH_HL" && emaAlignment === "bullish") {
      score += 4;
      details.push(`✔ Estrutura HH/HL — Tendencia de alta confirmada`);
    } else if (structure === "LH_LL" && emaAlignment === "bearish") {
      score += 4;
      details.push(`✔ Estrutura LH_LL — Tendencia de baixa confirmada`);
    } else if (structure !== "mixed") {
      score += 2;
      details.push(`◐ Estrutura ${structure} — Parcial`);
    } else {
      details.push(`✖ Estrutura mista`);
    }

    // ── Direção final ──
    let direction: TrendDirection = "SIDEWAYS";
    if (score >= 14) {
      direction = emaAlignment === "bullish" ? "UPTREND" : "DOWNTREND";
    } else if (score >= 8) {
      direction =
        emaAlignment === "bullish"
          ? "UPTREND"
          : emaAlignment === "bearish"
            ? "DOWNTREND"
            : "SIDEWAYS";
    }

    const finalScore = Math.min(TrendEngine.MAX_SCORE, score);
    const passed = finalScore >= 10;

    return this.buildResult({
      direction,
      ema9: lastEma9,
      ema21: lastEma21,
      ema50: lastEma50,
      emaAlignment,
      structure,
      priceVsEma50,
      ema9Slope,
      score: finalScore,
      passed,
      details,
    });
  }

  private detectSwingStructure(closes: number[]): "HH_HL" | "LH_LL" | "mixed" {
    const pivots = this.findPivots(closes, 3);
    if (pivots.length < 4) return "mixed";
    const highs = pivots.filter((p) => p.type === "high").map((p) => p.value);
    const lows = pivots.filter((p) => p.type === "low").map((p) => p.value);
    if (highs.length >= 2 && lows.length >= 2) {
      const hh = highs[highs.length - 1] > highs[highs.length - 2];
      const hl = lows[lows.length - 1] > lows[lows.length - 2];
      const lh = highs[highs.length - 1] < highs[highs.length - 2];
      const ll = lows[lows.length - 1] < lows[lows.length - 2];
      if (hh && hl) return "HH_HL";
      if (lh && ll) return "LH_LL";
    }
    return "mixed";
  }

  private findPivots(
    data: number[],
    lookback: number,
  ): { index: number; type: "high" | "low"; value: number }[] {
    const pivots: { index: number; type: "high" | "low"; value: number }[] = [];
    for (let i = lookback; i < data.length - lookback; i++) {
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (data[i] <= data[i - j] || data[i] <= data[i + j]) isHigh = false;
        if (data[i] >= data[i - j] || data[i] >= data[i + j]) isLow = false;
      }
      if (isHigh) pivots.push({ index: i, type: "high", value: data[i] });
      if (isLow) pivots.push({ index: i, type: "low", value: data[i] });
    }
    return pivots;
  }

  private calcEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [data.slice(0, period).reduce((s, v) => s + v, 0) / period];
    for (let i = period; i < data.length; i++) {
      ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
    }
    return ema;
  }

  private buildResult(r: TrendResult): TrendResult {
    return r;
  }
}
