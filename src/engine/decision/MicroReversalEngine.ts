import type { Candle } from "../../market/types";

export interface MicroReversalResult {
  probability: number;
  passed: boolean;
  details: string[];
}

export class MicroReversalEngine {
  private static readonly MIN_CANDLES = 5;
  private static readonly MAX_PROBABILITY = 100;
  static readonly BLOCK_THRESHOLD = 70;

  analyze(candles: Candle[]): MicroReversalResult {
    if (candles.length < MicroReversalEngine.MIN_CANDLES) {
      return {
        probability: 0,
        passed: true,
        details: [`Dados insuficientes: ${candles.length}/${MicroReversalEngine.MIN_CANDLES} candles`],
      };
    }

    const details: string[] = [];
    let total = 0;

    const closes = candles.map((c) => c.close);
    const lastPrice = closes[closes.length - 1];
    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : null;

    const ema20 = this.calcEMA(closes, 20);
    const ema50 = this.calcEMA(closes, 50);
    const atr = this.calcATR(candles, 14);

    // ── 1. Consecutive candles ──
    {
      const cons = this.countConsecutive(candles);
      if (cons >= 8) { total += 15; details.push(`✔ ${cons} candles consecutivos (+15)`); }
      else if (cons >= 7) { total += 13; details.push(`✔ ${cons} candles consecutivos (+13)`); }
      else if (cons >= 6) { total += 11; details.push(`✔ ${cons} candles consecutivos (+11)`); }
      else if (cons >= 5) { total += 9; details.push(`✔ ${cons} candles consecutivos (+9)`); }
      else if (cons >= 4) { total += 7; details.push(`✔ ${cons} candles consecutivos (+7)`); }
      else if (cons >= 3) { total += 5; details.push(`✔ ${cons} candles consecutivos (+5)`); }
      else if (cons >= 2) { total += 3; details.push(`✔ ${cons} candles consecutivos (+3)`); }
    }

    // ── 2 + 3. Proximidade do suporte / resistência ──
    {
      const { support, resistance } = this.findSR(candles);
      const distToSupport = support != null ? Math.abs(lastPrice - support) / lastPrice : null;
      const distToResistance = resistance != null ? Math.abs(resistance - lastPrice) / lastPrice : null;

      if (distToSupport != null && distToSupport < 0.001) {
        total += 15; details.push(`✔ Muito próximo do suporte (+15)`);
      } else if (distToSupport != null && distToSupport < 0.003) {
        total += 8; details.push(`✔ Próximo do suporte (+8)`);
      } else if (distToSupport != null && distToSupport < 0.005) {
        total += 4; details.push(`◐ Relativamente próximo do suporte (+4)`);
      }

      if (distToResistance != null && distToResistance < 0.001) {
        total += 15; details.push(`✔ Muito próximo da resistência (+15)`);
      } else if (distToResistance != null && distToResistance < 0.003) {
        total += 8; details.push(`✔ Próximo da resistência (+8)`);
      } else if (distToResistance != null && distToResistance < 0.005) {
        total += 4; details.push(`◐ Relativamente próximo da resistência (+4)`);
      }

      if (distToSupport == null && distToResistance == null) {
        details.push(`✖ Nenhum nível S/R detectado`);
      }
    }

    // ── 4. Força do candle atual (body % range) ──
    {
      const range = lastCandle.high - lastCandle.low;
      const body = Math.abs(lastCandle.close - lastCandle.open);
      if (range > 0) {
        const bodyRatio = body / range;
        if (bodyRatio >= 0.9) { total += 10; details.push(`✔ Corpo muito grande (${(bodyRatio * 100).toFixed(0)}% do range) (+10)`); }
        else if (bodyRatio >= 0.7) { total += 6; details.push(`✔ Corpo grande (${(bodyRatio * 100).toFixed(0)}% do range) (+6)`); }
        else if (bodyRatio >= 0.5) { total += 3; details.push(`◐ Corpo moderado (${(bodyRatio * 100).toFixed(0)}% do range) (+3)`); }
      }
    }

    // ── 5. Velocidade (aceleração últimos 5 candles) ──
    {
      if (candles.length >= 10) {
        const recent5 = candles.slice(-5);
        const prior5 = candles.slice(-10, -5);
        const recentRange = Math.max(...recent5.map((c) => c.high)) - Math.min(...recent5.map((c) => c.low));
        const priorRange = Math.max(...prior5.map((c) => c.high)) - Math.min(...prior5.map((c) => c.low));
        if (priorRange > 0 && recentRange / priorRange > 1.5) {
          total += 8; details.push(`✔ Movimento acelerando (range recente ${(recentRange / priorRange).toFixed(1)}× maior) (+8)`);
        } else {
          details.push(`✖ Sem aceleração significativa`);
        }
      }
    }

    // ── 6. ATR stretch ──
    {
      if (atr > 0) {
        const candleMove = Math.abs(lastCandle.close - lastCandle.open);
        if (lastCandle.high - lastCandle.low > 0) {
          if (candleMove > atr * 2) { total += 10; details.push(`✔ Movimento muito esticado (>2× ATR) (+10)`); }
          else if (candleMove > atr * 1.5) { total += 6; details.push(`✔ Movimento esticado (>1.5× ATR) (+6)`); }
          else if (candleMove > atr * 1.2) { total += 3; details.push(`◐ Movimento levemente esticado (>1.2× ATR) (+3)`); }
          else { details.push(`✖ ATR normal (${(candleMove / atr).toFixed(1)}× ATR)`); }
        }
      }
    }

    // ── 7 + 8. Distância da EMA20 / EMA50 ──
    {
      if (ema20 > 0) {
        const dist20 = Math.abs(lastPrice - ema20) / lastPrice;
        if (dist20 > 0.02) { total += 10; details.push(`✔ Muito distante da EMA20 (${(dist20 * 100).toFixed(2)}%) (+10)`); }
        else if (dist20 > 0.01) { total += 6; details.push(`✔ Distante da EMA20 (${(dist20 * 100).toFixed(2)}%) (+6)`); }
        else if (dist20 > 0.005) { total += 3; details.push(`◐ Levemente distante da EMA20 (${(dist20 * 100).toFixed(2)}%) (+3)`); }
        else { details.push(`✖ Próximo da EMA20 (${(dist20 * 100).toFixed(2)}%)`); }
      }
      if (ema50 > 0) {
        const dist50 = Math.abs(lastPrice - ema50) / lastPrice;
        if (dist50 > 0.03) { total += 8; details.push(`✔ Muito distante da EMA50 (${(dist50 * 100).toFixed(2)}%) (+8)`); }
        else if (dist50 > 0.015) { total += 5; details.push(`✔ Distante da EMA50 (${(dist50 * 100).toFixed(2)}%) (+5)`); }
        else if (dist50 > 0.008) { total += 2; details.push(`◐ Levemente distante da EMA50 (${(dist50 * 100).toFixed(2)}%) (+2)`); }
      }
    }

    // ── 9. Sombras ──
    {
      const range = lastCandle.high - lastCandle.low;
      if (range > 0) {
        const upperShadow = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
        const lowerShadow = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
        const shadowRatio = upperShadow > 0 && lowerShadow > 0
          ? Math.max(upperShadow, lowerShadow) / Math.min(upperShadow, lowerShadow)
          : 0;

        if (upperShadow / range > 0.5) {
          total += 8; details.push(`✔ Longa sombra superior (${(upperShadow / range * 100).toFixed(0)}% do range) (+8)`);
        } else if (upperShadow / range > 0.3) {
          total += 4; details.push(`◐ Sombra superior significativa (${(upperShadow / range * 100).toFixed(0)}% do range) (+4)`);
        }
        if (lowerShadow / range > 0.5) {
          total += 8; details.push(`✔ Longa sombra inferior (${(lowerShadow / range * 100).toFixed(0)}% do range) (+8)`);
        } else if (lowerShadow / range > 0.3) {
          total += 4; details.push(`◐ Sombra inferior significativa (${(lowerShadow / range * 100).toFixed(0)}% do range) (+4)`);
        }
        if (shadowRatio > 3 && upperShadow > 0 && lowerShadow > 0) {
          total += 3; details.push(`✔ Shadow Ratio elevado (${shadowRatio.toFixed(1)}×) (+3)`);
        }
        if (upperShadow / range <= 0.3 && lowerShadow / range <= 0.3) {
          details.push(`✖ Sem rejeição significativa`);
        }
      }
    }

    // ── 10. Pin Bar ──
    {
      if (this.detectPinBar(lastCandle)) {
        total += 25; details.push(`✔ Pin Bar detectado (+25)`);
      }
    }

    // ── 11. Doji ──
    {
      if (this.detectDoji(lastCandle)) {
        total += 25; details.push(`✔ Doji detectado (+25)`);
      }
    }

    // ── 12. Spinning Top ──
    {
      if (this.detectSpinningTop(lastCandle)) {
        total += 10; details.push(`✔ Spinning Top detectado (+10)`);
      }
    }

    // ── 13. Inside Bar ──
    {
      if (prevCandle && this.detectInsideBar(lastCandle, prevCandle)) {
        total += 10; details.push(`✔ Inside Bar detectado (+10)`);
      }
    }

    // ── 14. Engolfo contrário ──
    {
      if (prevCandle && this.detectEngolfoContrario(lastCandle, prevCandle)) {
        total += 30; details.push(`✔ Engolfo contrário detectado (+30)`);
      }
    }

    // ── 15. Micro Pullback ──
    {
      if (this.detectMicroPullback(candles)) {
        total += 10; details.push(`✔ Micro Pullback detectado (perda de força) (+10)`);
      }
    }

    // ── 16. Perda de Momentum ──
    {
      if (candles.length >= 6) {
        const loss = this.detectMomentumLoss(candles.slice(-6));
        if (loss > 0) {
          total += Math.min(10, loss);
          details.push(`✔ Perda de momentum nos últimos candles (+${Math.min(10, loss)})`);
        } else {
          details.push(`✖ Momentum preservado`);
        }
      }
    }

    // ── RSI Overbought/Oversold como fator de reversão ──
    {
      if (candles.length >= 14) {
        const gains: number[] = [];
        const losses: number[] = [];
        for (let i = 1; i < candles.length; i++) {
          const diff = candles[i].close - candles[i - 1].close;
          gains.push(diff > 0 ? diff : 0);
          losses.push(diff < 0 ? -diff : 0);
        }
        const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
        const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
        const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
        const rsi = 100 - 100 / (1 + rs);

        if (rsi > 70) {
          const add = Math.min(20, Math.round((rsi - 70) / 30 * 20));
          total += add;
          details.push(`✔ RSI sobrecomprado (${rsi.toFixed(1)}) — indica reversão baixista (+${add})`);
        } else if (rsi < 30) {
          const add = Math.min(20, Math.round((30 - rsi) / 30 * 20));
          total += add;
          details.push(`✔ RSI sobrevendido (${rsi.toFixed(1)}) — indica reversão altista (+${add})`);
        } else if (rsi > 65 || rsi < 35) {
          details.push(`◐ RSI em zona de atenção (${rsi.toFixed(1)})`);
        } else {
          details.push(`✖ RSI neutro (${rsi.toFixed(1)}) — sem sinal de reversão`);
        }
      }
    }

    // ── 17. Catálogo (histórico estatístico) ──
    {
      const catalogScore = this.catalogLookup(candles);
      if (catalogScore > 0) {
        total += catalogScore;
        details.push(`✔ Catálogo: ${catalogScore}% de reversão em casos similares (+${Math.round(catalogScore / 4)})`);
      }
    }

    const probability = Math.min(MicroReversalEngine.MAX_PROBABILITY, total);
    const passed = probability < MicroReversalEngine.BLOCK_THRESHOLD;

    details.push(`───`);
    details.push(`Probabilidade: ${probability}%`);
    if (passed) {
      details.push(`Status: Fluxo saudável — entrada liberada`);
    } else {
      details.push(`Status: ⚠ Alta probabilidade de reversão — entrada bloqueada`);
    }

    return { probability, passed, details };
  }

  private countConsecutive(candles: Candle[]): number {
    const lastDir = candles[candles.length - 1].close >= candles[candles.length - 1].open ? "up" : "down";
    let count = 1;
    for (let i = candles.length - 2; i >= 0; i--) {
      const dir = candles[i].close >= candles[i].open ? "up" : "down";
      if (dir === lastDir) count++;
      else break;
    }
    return count;
  }

  private calcEMA(values: number[], period: number): number {
    if (values.length < period) return 0;
    const k = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calcATR(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 0;
    const trs: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trs.push(tr);
    }
    if (trs.length < period) return 0;
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  private findSR(candles: Candle[]): { support: number | null; resistance: number | null } {
    const levels = 3;
    const pivots: number[] = [];

    for (let i = 2; i < candles.length - 2; i++) {
      if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i - 2].high &&
          candles[i].high > candles[i + 1].high && candles[i].high > candles[i + 2].high) {
        pivots.push(candles[i].high);
      }
      if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i - 2].low &&
          candles[i].low < candles[i + 1].low && candles[i].low < candles[i + 2].low) {
        pivots.push(candles[i].low);
      }
    }

    if (pivots.length < 2) return { support: null, resistance: null };

    const sorted = [...new Set(pivots)].sort((a, b) => a - b);
    const lastPrice = candles[candles.length - 1].close;

    let support: number | null = null;
    let resistance: number | null = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] < lastPrice) {
        support = sorted[i];
        break;
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] > lastPrice) {
        resistance = sorted[i];
        break;
      }
    }

    return { support, resistance };
  }

  private detectPinBar(candle: Candle): boolean {
    const range = candle.high - candle.low;
    if (range === 0) return false;
    const body = Math.abs(candle.close - candle.open);
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const bodyRatio = body / range;

    if (bodyRatio > 0.4) return false;

    const longShadow = Math.max(upperShadow, lowerShadow);
    const shortShadow = Math.min(upperShadow, lowerShadow);

    return longShadow / range > 0.6 && shortShadow / range < 0.15;
  }

  private detectDoji(candle: Candle): boolean {
    const range = candle.high - candle.low;
    if (range === 0) return false;
    const body = Math.abs(candle.close - candle.open);
    return body / range < 0.1;
  }

  private detectSpinningTop(candle: Candle): boolean {
    const range = candle.high - candle.low;
    if (range === 0) return false;
    const body = Math.abs(candle.close - candle.open);
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const bodyRatio = body / range;

    return bodyRatio > 0.1 && bodyRatio < 0.4 &&
           upperShadow / range > 0.2 && lowerShadow / range > 0.2;
  }

  private detectInsideBar(candle: Candle, prev: Candle): boolean {
    return candle.high <= prev.high && candle.low >= prev.low &&
           (candle.high < prev.high || candle.low > prev.low);
  }

  private detectEngolfoContrario(candle: Candle, prev: Candle): boolean {
    const prevBull = prev.close > prev.open;
    const currBear = candle.close < candle.open;
    const prevBear = prev.close < prev.open;
    const currBull = candle.close > candle.open;

    if (prevBull && currBear) {
      return candle.open >= prev.close && candle.close <= prev.open &&
             (candle.close - candle.open) < (prev.close - prev.open) * 0.5;
    }
    if (prevBear && currBull) {
      return candle.open <= prev.close && candle.close >= prev.open &&
             (candle.close - candle.open) > Math.abs(prev.close - prev.open) * 0.5;
    }
    return false;
  }

  private detectMicroPullback(candles: Candle[]): boolean {
    if (candles.length < 4) return false;
    const last3 = candles.slice(-3);
    const bodySizes = last3.map((c) => Math.abs(c.close - c.open));
    const ranges = last3.map((c) => c.high - c.low);

    for (let i = 1; i < bodySizes.length; i++) {
      if (ranges[i] > 0 && bodySizes[i] / ranges[i] < bodySizes[i - 1] / ranges[i - 1] * 0.7) {
        return true;
      }
    }
    return false;
  }

  private detectMomentumLoss(candles: Candle[]): number {
    if (candles.length < 3) return 0;
    let loss = 0;
    for (let i = candles.length - 3; i < candles.length - 1; i++) {
      const prevMove = Math.abs(candles[i].close - candles[i].open);
      const currMove = Math.abs(candles[i + 1].close - candles[i + 1].open);
      if (prevMove > 0 && currMove / prevMove < 0.6) {
        loss += 5;
      } else if (prevMove > 0 && currMove / prevMove < 0.8) {
        loss += 2;
      }
    }
    return loss;
  }

  private catalogLookup(candles: Candle[]): number {
    if (candles.length < 3) return 0;

    const consecutive = this.countConsecutive(candles);
    if (consecutive < 3) return 0;

    const lastCandle = candles[candles.length - 1];
    const range = lastCandle.high - lastCandle.low;
    const body = Math.abs(lastCandle.close - lastCandle.open);
    const upperShadow = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    const lowerShadow = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

    const hasPinBar = this.detectPinBar(lastCandle);
    const hasDoji = this.detectDoji(lastCandle);

    let probability = 0;
    if (consecutive >= 5) probability += 25;
    else if (consecutive >= 4) probability += 15;
    else if (consecutive >= 3) probability += 8;

    if (hasPinBar) probability += 35;
    if (hasDoji) probability += 30;

    if (range > 0) {
      const shadowRatio = Math.max(upperShadow, lowerShadow) / range;
      if (shadowRatio > 0.4) probability += 15;
    }

    const bodyRatio = range > 0 ? body / range : 0;
    if (bodyRatio > 0.7) probability += 10;

    if (consecutive >= 4) {
      const avgBodyBefore = candles.slice(-consecutive - 1, -1)
        .map((c) => Math.abs(c.close - c.open))
        .reduce((a, b) => a + b, 0) / consecutive;
      if (body < avgBodyBefore * 0.6) probability += 15;
    }

    return Math.min(80, Math.round(probability / 4));
  }
}
