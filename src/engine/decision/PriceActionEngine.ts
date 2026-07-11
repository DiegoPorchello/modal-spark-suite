/**
 * engine/decision/PriceActionEngine.ts
 * Detecta padrões de candlestick reais e avalia força direcional.
 * Score máximo: 15 pontos.
 * Mínimo de candles: 5.
 */

import type { Candle } from "../../market/types";

export interface PriceActionResult {
  pattern: string | null;
  direction: "bullish" | "bearish" | "neutral";
  strength: "strong" | "moderate" | "weak";
  confirmation: boolean;
  consecutive: number;
  bodyRatio: number;
  wickRatio: number;
  score: number;
  passed: boolean;
  details: string[];
}

export class PriceActionEngine {
  private static readonly MIN_CANDLES = 5;
  private static readonly MAX_SCORE = 15;

  analyze(candles: Candle[]): PriceActionResult {
    if (candles.length < PriceActionEngine.MIN_CANDLES) {
      return this.buildResult({
        pattern: null,
        direction: "neutral",
        strength: "weak",
        confirmation: false,
        consecutive: 0,
        bodyRatio: 0,
        wickRatio: 0,
        score: 0,
        passed: false,
        details: [
          `Dados insuficientes: ${candles.length}/${PriceActionEngine.MIN_CANDLES} candles`,
        ],
      });
    }

    const details: string[] = [];
    let score = 0;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low;
    const bodyRatio = range > 0 ? body / range : 0;
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const wickRatio = range > 0 ? (upperWick + lowerWick) / range : 0;

    const isBullish = last.close > last.open;
    const isBearish = last.close < last.open;

    // ── 1. Detecção de padrões (0-8 pts) ──
    const patterns: { name: string; dir: "bullish" | "bearish" | "neutral"; pts: number }[] = [];

    // Engulfing
    if (isBullish && prev.close < prev.open && last.close > prev.open && last.open < prev.close) {
      patterns.push({ name: "engulfing_bull", dir: "bullish", pts: 6 });
      details.push(`✔ Engulfing de alta`);
    }
    if (isBearish && prev.close > prev.open && last.close < prev.open && last.open > prev.close) {
      patterns.push({ name: "engulfing_bear", dir: "bearish", pts: 6 });
      details.push(`✔ Engulfing de baixa`);
    }

    // Pinbar / Hammer / Shooting Star
    const bodySize = Math.abs(last.close - last.open);
    const upperW = last.high - Math.max(last.open, last.close);
    const lowerW = Math.min(last.open, last.close) - last.low;
    const totalRange = last.high - last.low;

    if (totalRange > 0) {
      if (lowerW > bodySize * 2 && upperW < bodySize * 0.5) {
        patterns.push({ name: "hammer", dir: "bullish", pts: 5 });
        details.push(`✔ Hammer — Rejeição de baixa`);
      }
      if (upperW > bodySize * 2 && lowerW < bodySize * 0.5) {
        patterns.push({ name: "shooting_star", dir: "bearish", pts: 5 });
        details.push(`✔ Shooting Star — Rejeição de alta`);
      }
    }

    // Doji
    if (bodyRatio < 0.1 && range > 0) {
      patterns.push({ name: "doji", dir: "neutral", pts: 2 });
      details.push(`◐ Doji — Indecisão`);
    }

    // Inside Bar
    if (last.high < prev.high && last.low > prev.low) {
      patterns.push({ name: "inside_bar", dir: "neutral", pts: 3 });
      details.push(`◐ Inside Bar — Consolidação`);
    }

    // Marubozu
    if (bodyRatio > 0.8 && totalRange > 0) {
      if (isBullish) {
        patterns.push({ name: "marubozu_bull", dir: "bullish", pts: 7 });
        details.push(`✔ Marubozu de alta — Domínio comprador`);
      } else {
        patterns.push({ name: "marubozu_bear", dir: "bearish", pts: 7 });
        details.push(`✔ Marubozu de baixa — Domínio vendedor`);
      }
    }

    // Three White Soldiers / Three Black Crows
    if (candles.length >= 3) {
      const last3 = candles.slice(-3);
      const allBull = last3.every((c) => c.close > c.open);
      const allBear = last3.every((c) => c.close < c.open);
      const rising = last3[2].close > last3[1].close && last3[1].close > last3[0].close;
      const falling = last3[2].close < last3[1].close && last3[1].close < last3[0].close;
      if (allBull && rising) {
        patterns.push({ name: "three_white_soldiers", dir: "bullish", pts: 8 });
        details.push(`✔ Three White Soldiers — Forte momentum de alta`);
      }
      if (allBear && falling) {
        patterns.push({ name: "three_black_crows", dir: "bearish", pts: 8 });
        details.push(`✔ Three Black Crows — Forte momentum de baixa`);
      }
    }

    // ── 2. Consecutivos (0-3 pts) ──
    let consecutive = 0;
    if (isBullish) {
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].close > candles[i].open) consecutive++;
        else break;
      }
    } else if (isBearish) {
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].close < candles[i].open) consecutive++;
        else break;
      }
    }

    if (consecutive >= 3) {
      score += 3;
      details.push(`✔ ${consecutive} candles consecutivos na mesma direção`);
    } else if (consecutive >= 2) {
      score += 1;
      details.push(`◐ ${consecutive} candles consecutivos`);
    }

    // ── 3. Confirmação do candle anterior (0-2 pts) ──
    const prevIsBull = prev.close > prev.open;
    const prevIsBear = prev.close < prev.open;
    let confirmation = false;
    if (isBullish && prevIsBull) {
      confirmation = true;
      score += 2;
      details.push(`✔ Confirmação: candle anterior bullish`);
    } else if (isBearish && prevIsBear) {
      confirmation = true;
      score += 2;
      details.push(`✔ Confirmação: candle anterior bearish`);
    } else {
      details.push(`✖ Sem confirmação do candle anterior`);
    }

    // ── 4. Força do corpo (0-2 pts) ──
    if (bodyRatio > 0.7) {
      score += 2;
      details.push(`✔ Corpo forte (${(bodyRatio * 100).toFixed(0)}% do range)`);
    } else if (bodyRatio > 0.4) {
      score += 1;
      details.push(`◐ Corpo moderado (${(bodyRatio * 100).toFixed(0)}% do range)`);
    } else {
      details.push(`✖ Corpo fraco (${(bodyRatio * 100).toFixed(0)}% do range)`);
    }

    // ── Direção e padrão final ──
    let direction: PriceActionResult["direction"] = "neutral";
    let pattern: string | null = null;
    let strength: PriceActionResult["strength"] = "weak";

    const bullPatterns = patterns.filter((p) => p.dir === "bullish");
    const bearPatterns = patterns.filter((p) => p.dir === "bearish");

    if (bullPatterns.length > bearPatterns.length && bullPatterns.length > 0) {
      direction = "bullish";
      pattern = bullPatterns.map((p) => p.name).join("+");
      score += bullPatterns.reduce((s, p) => Math.min(p.pts, 8), 0);
    } else if (bearPatterns.length > bullPatterns.length && bearPatterns.length > 0) {
      direction = "bearish";
      pattern = bearPatterns.map((p) => p.name).join("+");
      score += bearPatterns.reduce((s, p) => Math.min(p.pts, 8), 0);
    } else if (patterns.length > 0) {
      pattern = patterns.map((p) => p.name).join("+");
      score += 1;
    }

    if (score >= 12) strength = "strong";
    else if (score >= 7) strength = "moderate";

    const finalScore = Math.min(PriceActionEngine.MAX_SCORE, score);
    const passed = finalScore >= 6;

    return this.buildResult({
      pattern,
      direction,
      strength,
      confirmation,
      consecutive,
      bodyRatio,
      wickRatio,
      score: finalScore,
      passed,
      details,
    });
  }

  private buildResult(r: PriceActionResult): PriceActionResult {
    return r;
  }
}
