/**
 * engine/decision/StructureEngine.ts
 * Calcula suporte/resistência via pivôs, BOS, CHoCH e zona de pullback.
 * Score máximo: 15 pontos.
 * Mínimo de candles: 30.
 */

import type { Candle } from "../../market/types";

export interface StructureResult {
  support: number;
  resistance: number;
  bos: "bullish" | "bearish" | null;
  choch: "bullish" | "bearish" | null;
  pullbackZone: boolean;
  pullbackTarget: number | null;
  nearestLevel: "support" | "resistance" | null;
  distanceToLevel: number;
  score: number;
  passed: boolean;
  details: string[];
}

export class StructureEngine {
  private static readonly MIN_CANDLES = 30;
  private static readonly MAX_SCORE = 15;

  analyze(candles: Candle[]): StructureResult {
    if (candles.length < StructureEngine.MIN_CANDLES) {
      return this.buildResult({
        support: 0,
        resistance: Infinity,
        bos: null,
        choch: null,
        pullbackZone: false,
        pullbackTarget: null,
        nearestLevel: null,
        distanceToLevel: 0,
        score: 0,
        passed: false,
        details: [`Dados insuficientes: ${candles.length}/${StructureEngine.MIN_CANDLES} candles`],
      });
    }

    const details: string[] = [];
    let score = 0;
    const lastPrice = candles[candles.length - 1].close;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    // ── 1. Suporte/Resistência via pivôs (0-5 pts) ──
    const pivots = this.findPivots(closes, 5);
    const support = this.findNearestSupport(pivots, lastPrice);
    const resistance = this.findNearestResistance(pivots, lastPrice);

    let nearestLevel: StructureResult["nearestLevel"] = null;
    let distanceToLevel = Infinity;

    if (support > 0) {
      const distSup = lastPrice - support;
      details.push(
        `✔ Suporte em ${support.toFixed(4)} (${((distSup / lastPrice) * 100).toFixed(3)}% abaixo)`,
      );
      score += 2;
      nearestLevel = "support";
      distanceToLevel = distSup;
    }
    if (resistance < Infinity) {
      const distRes = resistance - lastPrice;
      details.push(
        `✔ Resistência em ${resistance.toFixed(4)} (${((distRes / lastPrice) * 100).toFixed(3)}% acima)`,
      );
      score += 2;
      if (distRes < distanceToLevel) {
        nearestLevel = "resistance";
        distanceToLevel = distRes;
      }
    }
    if (support > 0 && resistance < Infinity) {
      score += 1;
      details.push(`✔ Range definido: ${(resistance - support).toFixed(4)}`);
    }

    // ── 2. BOS (Break of Structure) (0-4 pts) ──
    const bos = this.detectBOS(highs, lows, closes);
    if (bos === "bullish") {
      score += 4;
      details.push(`✔ BOS de alta detectado — Continuação`);
    } else if (bos === "bearish") {
      score += 4;
      details.push(`✔ BOS de baixa detectado — Continuação`);
    } else {
      details.push(`✖ Sem BOS detectado`);
    }

    // ── 3. CHoCH (Change of Character) (0-3 pts) ──
    const choch = this.detectCHoCH(highs, lows, closes);
    if (choch === "bullish") {
      score += 3;
      details.push(`✔ CHoCH de alta — Reversão potencial`);
    } else if (choch === "bearish") {
      score += 3;
      details.push(`✔ CHoCH de baixa — Reversão potencial`);
    } else {
      details.push(`✖ Sem CHoCH detectado`);
    }

    // ── 4. Zona de Pullback (0-3 pts) ──
    const pullbackInfo = this.detectPullback(closes, lows, highs, lastPrice);
    if (pullbackInfo.inZone) {
      score += 3;
      details.push(`✔ Pullback na zona ${pullbackInfo.level.toFixed(4)} — Entrada favorável`);
    } else if (pullbackInfo.nearZone) {
      score += 1;
      details.push(`◐ Pullback próximo à zona — Acompanhar`);
    } else {
      details.push(`✖ Fora da zona de pullback`);
    }

    const finalScore = Math.min(StructureEngine.MAX_SCORE, score);
    const passed = finalScore >= 8;

    return this.buildResult({
      support,
      resistance,
      bos,
      choch,
      pullbackZone: pullbackInfo.inZone,
      pullbackTarget: pullbackInfo.level,
      nearestLevel,
      distanceToLevel,
      score: finalScore,
      passed,
      details,
    });
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

  private findNearestSupport(
    pivots: { type: "high" | "low"; value: number }[],
    price: number,
  ): number {
    const lows = pivots
      .filter((p) => p.type === "low" && p.value < price)
      .sort((a, b) => b.value - a.value);
    return lows[0]?.value ?? 0;
  }

  private findNearestResistance(
    pivots: { type: "high" | "low"; value: number }[],
    price: number,
  ): number {
    const highs = pivots
      .filter((p) => p.type === "high" && p.value > price)
      .sort((a, b) => a.value - b.value);
    return highs[0]?.value ?? Infinity;
  }

  private detectBOS(
    highs: number[],
    lows: number[],
    closes: number[],
  ): "bullish" | "bearish" | null {
    if (closes.length < 10) return null;
    const recentHigh = Math.max(...highs.slice(-10));
    const prevHigh = Math.max(...highs.slice(-20, -10));
    const recentLow = Math.min(...lows.slice(-10));
    const prevLow = Math.min(...lows.slice(-20, -10));

    if (recentHigh > prevHigh && closes[closes.length - 1] > prevHigh) {
      return "bullish";
    }
    if (recentLow < prevLow && closes[closes.length - 1] < prevLow) {
      return "bearish";
    }
    return null;
  }

  private detectCHoCH(
    highs: number[],
    lows: number[],
    closes: number[],
  ): "bullish" | "bearish" | null {
    if (closes.length < 20) return null;
    const last = closes.length - 1;
    const midHigh = Math.max(...highs.slice(-10, -5));
    const midLow = Math.min(...lows.slice(-10, -5));

    if (closes[last - 10] < midHigh && closes[last] > midHigh) return "bullish";
    if (closes[last - 10] > midLow && closes[last] < midLow) return "bearish";
    return null;
  }

  private detectPullback(
    closes: number[],
    lows: number[],
    highs: number[],
    price: number,
  ): { inZone: boolean; nearZone: boolean; level: number } {
    if (closes.length < 20) return { inZone: false, nearZone: false, level: 0 };
    const recentHigh = Math.max(...highs.slice(-20));
    const recentLow = Math.min(...lows.slice(-20));
    const range = recentHigh - recentLow;
    if (range <= 0) return { inZone: false, nearZone: false, level: 0 };

    const fib382 = recentHigh - range * 0.382;
    const fib500 = recentHigh - range * 0.5;
    const fib618 = recentHigh - range * 0.618;
    const tolerance = range * 0.05;

    if (Math.abs(price - fib500) < tolerance)
      return { inZone: true, nearZone: false, level: fib500 };
    if (Math.abs(price - fib382) < tolerance)
      return { inZone: true, nearZone: false, level: fib382 };
    if (Math.abs(price - fib618) < tolerance)
      return { inZone: true, nearZone: false, level: fib618 };
    if (Math.abs(price - fib500) < range * 0.1)
      return { inZone: false, nearZone: true, level: fib500 };
    return { inZone: false, nearZone: false, level: fib500 };
  }

  private buildResult(r: StructureResult): StructureResult {
    return r;
  }
}
