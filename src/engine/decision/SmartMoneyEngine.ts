/**
 * engine/decision/SmartMoneyEngine.ts
 * Detecta Order Blocks, Fair Value Gaps e Liquidity Sweeps a partir de OHLCV.
 * Score máximo: 10 pontos.
 * Mínimo de candles: 20.
 */

import type { Candle } from "../../market/types";

export interface SmartMoneyResult {
  orderBlocks: { type: "bullish" | "bearish"; high: number; low: number; tested: boolean }[];
  fvg: { type: "bullish" | "bearish"; high: number; low: number } | null;
  liquiditySweep: "high" | "low" | null;
  sweepLevel: number;
  displacement: boolean;
  score: number;
  passed: boolean;
  details: string[];
}

export class SmartMoneyEngine {
  private static readonly MIN_CANDLES = 20;
  private static readonly MAX_SCORE = 10;

  analyze(candles: Candle[]): SmartMoneyResult {
    if (candles.length < SmartMoneyEngine.MIN_CANDLES) {
      return this.buildResult({
        orderBlocks: [],
        fvg: null,
        liquiditySweep: null,
        sweepLevel: 0,
        displacement: false,
        score: 0,
        passed: false,
        details: [`Dados insuficientes: ${candles.length}/${SmartMoneyEngine.MIN_CANDLES} candles`],
      });
    }

    const details: string[] = [];
    let score = 0;

    // ── 1. Order Blocks (0-4 pts) ──
    const orderBlocks = this.detectOrderBlocks(candles);
    if (orderBlocks.length > 0) {
      const untested = orderBlocks.filter((ob) => !ob.tested);
      if (untested.length > 0) {
        score += Math.min(4, untested.length * 2);
        details.push(`✔ ${untested.length} Order Block(s) não testado(s)`);
      } else {
        score += 1;
        details.push(`◐ ${orderBlocks.length} Order Block(s) todos testados`);
      }
    } else {
      details.push(`✖ Nenhum Order Block detectado`);
    }

    // ── 2. Fair Value Gap (0-3 pts) ──
    const fvg = this.detectFVG(candles);
    if (fvg) {
      score += 3;
      details.push(
        `✔ FVG ${fvg.type === "bullish" ? "de alta" : "de baixa"}: ${fvg.low.toFixed(4)}-${fvg.high.toFixed(4)}`,
      );
    } else {
      details.push(`✖ Nenhum FVG detectado`);
    }

    // ── 3. Liquidity Sweep (0-3 pts) ──
    const sweep = this.detectLiquiditySweep(candles);
    if (sweep.sweep) {
      score += 3;
      details.push(
        `✔ Sweep de liquidez ${sweep.sweep === "high" ? "de alta" : "de baixa"} em ${sweep.level.toFixed(4)}`,
      );
    } else {
      details.push(`✖ Sem sweep de liquidez`);
    }

    // ── 4. Displacement (0-1 pt, bônus) ──
    const displacement = this.detectDisplacement(candles);
    if (displacement) {
      score += 1;
      details.push(`✔ Deslocamento detectado — Momentum institucional`);
    }

    const finalScore = Math.min(SmartMoneyEngine.MAX_SCORE, score);
    const passed = finalScore >= 4;

    return this.buildResult({
      orderBlocks,
      fvg,
      liquiditySweep: sweep.sweep,
      sweepLevel: sweep.level,
      displacement,
      score: finalScore,
      passed,
      details,
    });
  }

  private detectOrderBlocks(
    candles: Candle[],
  ): { type: "bullish" | "bearish"; high: number; low: number; tested: boolean }[] {
    const obs: { type: "bullish" | "bearish"; high: number; low: number; tested: boolean }[] = [];
    for (let i = 3; i < candles.length - 2; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      const next = candles[i + 1];
      const next2 = candles[i + 2];

      // Bullish OB: candle bearish seguido de forte movimento bullish
      if (prev.close < prev.open && next.close > next.open) {
        const move = next.close - prev.close;
        const prevRange = prev.high - prev.low;
        if (prevRange > 0 && move > prevRange * 1.5) {
          const tested = next2.low <= prev.high && next2.low >= prev.low;
          obs.push({ type: "bullish", high: prev.high, low: prev.low, tested });
        }
      }

      // Bearish OB: candle bullish seguido de forte movimento bearish
      if (prev.close > prev.open && next.close < next.open) {
        const move = prev.close - next.close;
        const prevRange = prev.high - prev.low;
        if (prevRange > 0 && move > prevRange * 1.5) {
          const tested = next2.high >= prev.low && next2.high <= prev.high;
          obs.push({ type: "bearish", high: prev.high, low: prev.low, tested });
        }
      }
    }
    return obs;
  }

  private detectFVG(
    candles: Candle[],
  ): { type: "bullish" | "bearish"; high: number; low: number } | null {
    for (let i = 2; i < candles.length; i++) {
      const c1 = candles[i - 2];
      const c3 = candles[i];

      // Bullish FVG: gap entre c1.high e c3.low
      if (c3.low > c1.high) {
        return { type: "bullish", high: c3.low, low: c1.high };
      }
      // Bearish FVG: gap entre c3.high e c1.low
      if (c3.high < c1.low) {
        return { type: "bearish", high: c1.low, low: c3.high };
      }
    }
    return null;
  }

  private detectLiquiditySweep(candles: Candle[]): { sweep: "high" | "low" | null; level: number } {
    if (candles.length < 10) return { sweep: null, level: 0 };
    const recent = candles.slice(-10);
    const last = candles[candles.length - 1];
    const prevHigh = Math.max(...recent.slice(0, -1).map((c) => c.high));
    const prevLow = Math.min(...recent.slice(0, -1).map((c) => c.low));

    // Sweep de alta: preço ultrapassa alta anterior e fecha abaixo
    if (last.high > prevHigh && last.close < prevHigh) {
      return { sweep: "high", level: prevHigh };
    }
    // Sweep de baixa: preço ultrapassa baixa anterior e fecha acima
    if (last.low < prevLow && last.close > prevLow) {
      return { sweep: "low", level: prevLow };
    }
    return { sweep: null, level: 0 };
  }

  private detectDisplacement(candles: Candle[]): boolean {
    if (candles.length < 5) return false;
    const last5 = candles.slice(-5);
    const bodies = last5.map((c) => Math.abs(c.close - c.open));
    const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;
    const lastBody = Math.abs(last5[last5.length - 1].close - last5[last5.length - 1].open);
    return lastBody > avgBody * 2;
  }

  private buildResult(r: SmartMoneyResult): SmartMoneyResult {
    return r;
  }
}
