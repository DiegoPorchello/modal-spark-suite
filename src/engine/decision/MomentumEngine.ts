/**
 * engine/decision/MomentumEngine.ts
 * Calcula RSI, MACD, ADX, ATR e volume a partir de OHLCV.
 * Score máximo: 15 pontos.
 * Mínimo de candles: 30.
 */

import type { Candle } from "../../market/types";

export interface MomentumResult {
  rsi: number;
  rsiZone: "oversold" | "overbought" | "neutral";
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  macdTrend: "bullish" | "bearish" | "neutral";
  adx: number;
  adxStrength: "strong" | "moderate" | "weak";
  atr: number;
  atrPercent: number;
  volumeAboveAverage: boolean;
  volumeTrend: "increasing" | "decreasing" | "stable";
  score: number;
  passed: boolean;
  details: string[];
}

export class MomentumEngine {
  private static readonly MIN_CANDLES = 30;
  private static readonly MAX_SCORE = 15;

  analyze(candles: Candle[]): MomentumResult {
    if (candles.length < MomentumEngine.MIN_CANDLES) {
      return this.buildResult({
        rsi: 50,
        rsiZone: "neutral",
        macdValue: 0,
        macdSignal: 0,
        macdHistogram: 0,
        macdTrend: "neutral",
        adx: 0,
        adxStrength: "weak",
        atr: 0,
        atrPercent: 0,
        volumeAboveAverage: false,
        volumeTrend: "stable",
        score: 0,
        passed: false,
        details: [`Dados insuficientes: ${candles.length}/${MomentumEngine.MIN_CANDLES} candles`],
      });
    }

    const details: string[] = [];
    let score = 0;
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    // ── 1. RSI (0-3 pts) ──
    const rsi = this.calcRSI(closes, 14);
    let rsiZone: MomentumResult["rsiZone"] = "neutral";
    if (rsi < 30) {
      rsiZone = "oversold";
      score += 3;
      details.push(`✔ RSI ${rsi.toFixed(1)} — Sobrevendido (zona de compra)`);
    } else if (rsi > 70) {
      rsiZone = "overbought";
      score += 3;
      details.push(`✔ RSI ${rsi.toFixed(1)} — Sobrecomprado (zona de venda)`);
    } else if (rsi < 40) {
      score += 2;
      details.push(`◐ RSI ${rsi.toFixed(1)} — Próximo ao sobrevendido`);
    } else if (rsi > 60) {
      score += 2;
      details.push(`◐ RSI ${rsi.toFixed(1)} — Próximo ao sobrecomprado`);
    } else {
      details.push(`✖ RSI ${rsi.toFixed(1)} — Neutro`);
    }

    // ── 2. MACD (0-4 pts) ──
    const macdResult = this.calcMACD(closes);
    let macdTrend: MomentumResult["macdTrend"] = "neutral";
    if (macdResult.histogram > 0 && macdResult.value > macdResult.signal) {
      macdTrend = "bullish";
      score += 4;
      details.push(
        `✔ MACD bullish: ${macdResult.value.toFixed(4)} > Signal ${macdResult.signal.toFixed(4)}`,
      );
    } else if (macdResult.histogram < 0 && macdResult.value < macdResult.signal) {
      macdTrend = "bearish";
      score += 4;
      details.push(
        `✔ MACD bearish: ${macdResult.value.toFixed(4)} < Signal ${macdResult.signal.toFixed(4)}`,
      );
    } else if (macdResult.histogram > 0) {
      macdTrend = "bullish";
      score += 2;
      details.push(`◐ MACD histogram positivo — Momentum crescente`);
    } else if (macdResult.histogram < 0) {
      macdTrend = "bearish";
      score += 2;
      details.push(`◐ MACD histogram negativo — Momentum decrescente`);
    } else {
      details.push(`✖ MACD neutro`);
    }

    // ── 3. ADX (0-3 pts) ──
    const adx = this.calcADX(candles, 14);
    let adxStrength: MomentumResult["adxStrength"] = "weak";
    if (adx > 25) {
      adxStrength = "strong";
      score += 3;
      details.push(`✔ ADX ${adx.toFixed(1)} — Tendência forte`);
    } else if (adx > 15) {
      adxStrength = "moderate";
      score += 2;
      details.push(`◐ ADX ${adx.toFixed(1)} — Tendência moderada`);
    } else {
      details.push(`✖ ADX ${adx.toFixed(1)} — Mercado lateral`);
    }

    // ── 4. ATR (0-2 pts) ──
    const atr = this.calcATR(candles, 14);
    const lastPrice = closes[closes.length - 1];
    const atrPercent = lastPrice > 0 ? (atr / lastPrice) * 100 : 0;
    if (atrPercent > 0.3) {
      score += 2;
      details.push(`✔ ATR ${atr.toFixed(4)} (${atrPercent.toFixed(2)}%) — Volatilidade adequada`);
    } else if (atrPercent > 0.1) {
      score += 1;
      details.push(`◐ ATR ${atr.toFixed(4)} (${atrPercent.toFixed(2)}%) — Volatilidade baixa`);
    } else {
      details.push(
        `✖ ATR ${atr.toFixed(4)} (${atrPercent.toFixed(2)}%) — Volatilidade muito baixa`,
      );
    }

    // ── 5. Volume (0-3 pts) ──
    const avgVolume = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volumes.length);
    const lastVolume = volumes[volumes.length - 1];
    const volumeAboveAverage = lastVolume > avgVolume;

    const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const prevVol = volumes.slice(-10, -5).reduce((s, v) => s + v, 0) / 5;
    let volumeTrend: MomentumResult["volumeTrend"] = "stable";
    if (recentVol > prevVol * 1.2) volumeTrend = "increasing";
    else if (recentVol < prevVol * 0.8) volumeTrend = "decreasing";

    if (volumeAboveAverage && volumeTrend === "increasing") {
      score += 3;
      details.push(`✔ Volume acima da média e crescendo — Confirmação`);
    } else if (volumeAboveAverage) {
      score += 2;
      details.push(`◐ Volume acima da média`);
    } else if (volumeTrend === "increasing") {
      score += 1;
      details.push(`◐ Volume crescendo`);
    } else {
      details.push(`✖ Volume abaixo da média`);
    }

    const finalScore = Math.min(MomentumEngine.MAX_SCORE, score);
    const passed = finalScore >= 7;

    return this.buildResult({
      rsi,
      rsiZone,
      macdValue: macdResult.value,
      macdSignal: macdResult.signal,
      macdHistogram: macdResult.histogram,
      macdTrend,
      adx,
      adxStrength,
      atr,
      atrPercent,
      volumeAboveAverage,
      volumeTrend,
      score: finalScore,
      passed,
      details,
    });
  }

  private calcRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gainSum += diff;
      else lossSum += Math.abs(diff);
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calcMACD(closes: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calcEMA(closes, 12);
    const ema26 = this.calcEMA(closes, 26);
    const macdLine: number[] = [];
    const offset = ema26.length - ema12.length;
    for (let i = 0; i < ema12.length; i++) {
      macdLine.push(ema12[i] - ema26[i + offset]);
    }
    const signal = this.calcEMA(macdLine, 9);
    const lastMacd = macdLine[macdLine.length - 1] ?? 0;
    const lastSignal = signal[signal.length - 1] ?? 0;
    return { value: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
  }

  private calcADX(candles: Candle[], period: number): number {
    if (candles.length < period * 2) return 0;
    const trs: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const prevHigh = candles[i - 1].high;
      const low = candles[i].low;
      const prevLow = candles[i - 1].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
      const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }
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

  private calcATR(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
    let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < trs.length; i++) {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    return atr;
  }

  private calcEMA(data: number[], period: number): number[] {
    if (data.length < period) return data.slice();
    const k = 2 / (period + 1);
    const ema: number[] = [data.slice(0, period).reduce((s, v) => s + v, 0) / period];
    for (let i = period; i < data.length; i++) {
      ema.push(data[i] * k + ema[ema.length - 1] * (1 - k));
    }
    return ema;
  }

  private buildResult(r: MomentumResult): MomentumResult {
    return r;
  }
}
