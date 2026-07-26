/**
 * Hybrid Probability Advisor — Advisor for HYBRID_PROBABILITY market.
 *
 * Estratégia base (probabilística, sem Smart Money):
 *   2 candles da mesma cor → entrar no 3º na mesma direção.
 *
 * Filtros de contexto (evitam operar no lado errado do mercado):
 *   1. ADX     → ADX > adxMin libera; ADX < adxBlock bloqueia (lateral).
 *   2. EMA 200 → CALL somente se preço > EMA200; PUT somente se preço < EMA200.
 *   3. ATR     → exige volatilidade acima da média das últimas 20 velas.
 *   4. Flow Index → mercado em fluxo (continuidade de velas) libera; lateral bloqueia.
 *
 * Fluxo final:
 *   Catálogo (>=60) → 2 velas iguais → ADX > 25 ? → EMA200 confirma ? → ATR ok ? → Flow Index ok ? → ENTRAR.
 */

import type { Candle } from "../../../../market/types";
import {
  calcADX,
  calcATR,
  atrBaseline,
  emaValue,
  calcFlowIndex,
  detectContinuation,
  candleColor,
  type CandleColor,
} from "./hybrid-probability.indicators";

export interface HybridProbabilityThresholds {
  /** ADX acima disso libera operações. */
  adxMin: number;
  /** ADX abaixo disso bloqueia (mercado lateral). */
  adxBlock: number;
  /** Usar EMA 200 como filtro de direção. */
  ema200Enabled: boolean;
  /** Usar ATR como filtro de volatilidade. */
  atrEnabled: boolean;
  /** Flow Index mínimo para considerar mercado em fluxo. */
  flowIndexMin: number;
}

export const DEFAULT_THRESHOLDS: HybridProbabilityThresholds = {
  adxMin: 25,
  adxBlock: 20,
  ema200Enabled: true,
  atrEnabled: true,
  flowIndexMin: 0.55,
};

export interface HybridProbabilityContext {
  candles?: Candle[];
  lastPrice?: number;
  catalog?: Array<{ time: number; color: CandleColor; result?: "WIN" | "LOSS" }>;
  thresholds?: Partial<HybridProbabilityThresholds>;
}

export interface ProbabilityFilterResult {
  id: string;
  name: string;
  passed: boolean;
  applied: boolean;
  detail: string;
}

export interface ProbabilityAdvisorResult {
  recommendation: "CALL" | "PUT" | null;
  confidence: number;
  reason: string;
  probability: number | null;
  nextColorProbability?: CandleColor | null;
  sequence?: string;
  // Novos campos do filtro de contexto
  setup?: { detected: boolean; color: CandleColor | null; direction: "CALL" | "PUT" | null };
  filters: ProbabilityFilterResult[];
  blockedReasons: string[];
  indicators: {
    adx: number;
    ema200: number | null;
    atr: number;
    atrBaseline: number;
    flowIndex: number;
  };
}

export const HYBRID_PROBABILITY_ADVISOR = {
  id: "hybrid-probability-advisor",
  name: "Probability Advisor",
  description: "Recomendações baseadas em probabilidade estatística + filtros de contexto (ADX, EMA200, ATR, Flow Index) para perfil HYBRID_PROBABILITY",

  generateRecommendations: async (context: HybridProbabilityContext): Promise<ProbabilityAdvisorResult> => {
    const thresholds: HybridProbabilityThresholds = { ...DEFAULT_THRESHOLDS, ...(context.thresholds ?? {}) };
    const candles = context.candles ?? [];

    // Fallback: sem candles disponíveis, usar lógica antiga baseada em catálogo.
    if (candles.length < 2) {
      return legacyRecommendation(context);
    }

    const setup = detectContinuation(candles);
    const closes = candles.map((c) => c.close);
    const lastPrice = context.lastPrice ?? closes[closes.length - 1];

    const adx = calcADX(candles, 14);
    const ema200 = emaValue(closes, 200);
    const atr = calcATR(candles, 14);
    const atrBase = atrBaseline(candles, 20);
    const flow = calcFlowIndex(candles, 20);

    const filters: ProbabilityFilterResult[] = [];
    const blockedReasons: string[] = [];

    // ── Filtro 1: ADX ──
    const adxApplied = true;
    let adxPassed = true;
    if (adx < thresholds.adxBlock) {
      adxPassed = false;
      blockedReasons.push(`ADX ${adx.toFixed(1)} < ${thresholds.adxBlock} — mercado lateral (sem força)`);
      filters.push({ id: "adx", name: "ADX (força)", passed: false, applied: adxApplied, detail: `ADX ${adx.toFixed(1)} < ${thresholds.adxBlock} → bloqueia` });
    } else if (adx < thresholds.adxMin) {
      adxPassed = true; // permite, mas reduz confiança
      filters.push({ id: "adx", name: "ADX (força)", passed: true, applied: adxApplied, detail: `ADX ${adx.toFixed(1)} (entre ${thresholds.adxBlock} e ${thresholds.adxMin} → marginal)` });
    } else {
      filters.push({ id: "adx", name: "ADX (força)", passed: true, applied: adxApplied, detail: `ADX ${adx.toFixed(1)} >= ${thresholds.adxMin} → mercado com força` });
    }

    // ── Filtro 2: EMA 200 (direção) ──
    let ema200Passed = true;
    if (thresholds.ema200Enabled && ema200 !== null) {
      const priceAbove = lastPrice > ema200;
      if (setup.direction === "CALL" && !priceAbove) {
        ema200Passed = false;
        blockedReasons.push(`Preço ${lastPrice.toFixed(4)} abaixo da EMA200 ${ema200.toFixed(4)} → CALL contra a tendência`);
      } else if (setup.direction === "PUT" && priceAbove) {
        ema200Passed = false;
        blockedReasons.push(`Preço ${lastPrice.toFixed(4)} acima da EMA200 ${ema200.toFixed(4)} → PUT contra a tendência`);
      }
      filters.push({
        id: "ema200",
        name: "EMA 200 (direção)",
        passed: ema200Passed,
        applied: true,
        detail: priceAbove
          ? `Preço ${lastPrice.toFixed(4)} > EMA200 ${ema200.toFixed(4)} → favorece CALL`
          : `Preço ${lastPrice.toFixed(4)} < EMA200 ${ema200.toFixed(4)} → favorece PUT`,
      });
    } else {
      filters.push({ id: "ema200", name: "EMA 200 (direção)", passed: true, applied: false, detail: ema200 === null ? "Sem dados suficientes (>=200 velas)" : "Desativado" });
    }

    // ── Filtro 3: ATR (volatilidade) ──
    let atrPassed = true;
    if (thresholds.atrEnabled) {
      atrPassed = atr >= atrBase;
      if (!atrPassed) {
        blockedReasons.push(`ATR ${atr.toFixed(4)} abaixo da média ${atrBase.toFixed(4)} → volatilidade insuficiente`);
      }
      filters.push({
        id: "atr",
        name: "ATR (volatilidade)",
        passed: atrPassed,
        applied: true,
        detail: `ATR ${atr.toFixed(4)} vs média ${atrBase.toFixed(4)} → ${atrPassed ? "ok" : "baixa"}`,
      });
    } else {
      filters.push({ id: "atr", name: "ATR (volatilidade)", passed: true, applied: false, detail: "Desativado" });
    }

    // ── Filtro 4: Flow Index ──
    const flowPassed = flow.inFlow;
    if (!flowPassed) {
      blockedReasons.push(`Flow Index ${flow.flowIndex.toFixed(2)} < ${thresholds.flowIndexMin} → mercado lateral (alternância de cores)`);
    }
    filters.push({
      id: "flow-index",
      name: "Flow Index (fluidez)",
      passed: flowPassed,
      applied: true,
      detail: `Continuidade ${flow.continuations} / Alternância ${flow.alternations} → Flow ${flow.flowIndex.toFixed(2)} ${flowPassed ? "(fluxo)" : "(lateral)"}`,
    });

    // ── Decisão ──
    const allPassed = adxPassed && ema200Passed && atrPassed && flowPassed;

    if (!setup.detected) {
      return {
        recommendation: null,
        confidence: 0,
        reason: "Aguardando 2 candles consecutivos da mesma cor (setup 2C não detectado).",
        probability: null,
        setup,
        filters,
        blockedReasons,
        indicators: { adx, ema200, atr, atrBaseline: atrBase, flowIndex: flow.flowIndex },
      };
    }

    if (!allPassed) {
      return {
        recommendation: null,
        confidence: 0,
        reason: `Setup 2C (${setup.color}) detectado, mas bloqueado por filtro de contexto: ${blockedReasons.join("; ")}.`,
        probability: null,
        setup,
        filters,
        blockedReasons,
        indicators: { adx, ema200, atr, atrBaseline: atrBase, flowIndex: flow.flowIndex },
      };
    }

    // Confiança ponderada pela qualidade dos filtros
    let confidence = 75;
    if (adx >= thresholds.adxMin) confidence += 10;
    if (flow.flowIndex >= 0.7) confidence += 10;
    if (ema200 !== null) confidence += 5;
    confidence = Math.min(95, confidence);

    return {
      recommendation: setup.direction,
      confidence,
      reason: `Setup 2C (${setup.color}) confirmado em fluxo: ADX ${adx.toFixed(1)}, EMA200 ${ema200 !== null ? (lastPrice > ema200 ? "favorece CALL" : "favorece PUT") : "n/a"}, ATR ok, Flow ${flow.flowIndex.toFixed(2)} → ${setup.direction}.`,
      probability: setup.color === "GREEN" ? 0.6 : 0.6,
      nextColorProbability: setup.color,
      sequence: `${setup.color}${setup.color}`,
      setup,
      filters,
      blockedReasons: [],
      indicators: { adx, ema200, atr, atrBaseline: atrBase, flowIndex: flow.flowIndex },
    };
  },

  generateAlerts: async (context: HybridProbabilityContext): Promise<any[]> => {
    const alerts: any[] = [];
    const catalog = context.catalog || [];

    if (catalog.length === 0) return alerts;

    const winRate = calculateWinRate(catalog);
    if (winRate < 40) {
      alerts.push({
        id: "low-win-rate",
        title: "Taxa de acerto baixa",
        description: `Taxa de acerto atual: ${winRate}%. Considere reduzir exposição.`,
        priority: "HIGH" as const,
        severity: "WARNING" as const,
      });
    } else if (winRate > 70) {
      alerts.push({
        id: "high-win-rate",
        title: "Taxa de acerto alta",
        description: `Taxa de acerto atual: ${winRate}%. Bom momento para operar.`,
        priority: "LOW" as const,
        severity: "SUCCESS" as const,
      });
    }

    const sequences = getAllSequences(catalog);
    const worstSequence = sequences.reduce((worst, current) =>
      (current.winRate || 0) < (worst.winRate || 0) ? current : worst
    );

    if (worstSequence && (worstSequence.winRate || 0) < 30 && worstSequence.occurrences > 5) {
      alerts.push({
        id: "worst-sequence",
        title: `Evite sequência ${worstSequence.sequence}`,
        description: `Win rate: ${worstSequence.winRate}% em ${worstSequence.occurrences} ocorrências.`,
        priority: "MEDIUM" as const,
        severity: "WARNING" as const,
      });
    }

    return alerts;
  },

  generateOpportunities: async (context: HybridProbabilityContext): Promise<any[]> => {
    const opportunities: any[] = [];
    const catalog = context.catalog || [];

    if (catalog.length < 10) return opportunities;

    const sequences = getAllSequences(catalog);
    const bestSequence = sequences.reduce((best, current) =>
      (current.winRate || 0) > (best.winRate || 0) ? current : best
    );

    if (bestSequence && (bestSequence.winRate || 0) > 60) {
      opportunities.push({
        id: "best-sequence-opportunity",
        title: `Aproveite sequência ${bestSequence.sequence}`,
        description: `Win rate: ${bestSequence.winRate}% em ${bestSequence.occurrences} ocorrências. Esta é a melhor sequência atual.`,
        priority: "LOW" as const,
        expectedProfit: (bestSequence.winRate || 0) / 100 - 0.05,
      });
    }

    return opportunities;
  },

  overallStatus: async (context: HybridProbabilityContext): Promise<"EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL"> => {
    const catalog = context.catalog || [];
    const advisorResult = await HYBRID_PROBABILITY_ADVISOR.generateRecommendations(context);
    const winRate = calculateWinRate(catalog);

    let score = 0;

    if (advisorResult.recommendation) score += 30;

    if (winRate >= 70) score += 40;
    else if (winRate >= 60) score += 30;
    else if (winRate >= 50) score += 20;
    else score += 0;

    if (catalog.length >= 100) score += 30;
    else if (catalog.length >= 50) score += 20;
    else if (catalog.length >= 20) score += 10;
    else score += 0;

    if (score >= 80) return "EXCELLENT";
    if (score >= 60) return "GOOD";
    if (score >= 40) return "WARNING";
    return "CRITICAL";
  },
};

/**
 * Lógica legada (somente catálogo) — mantida para compatibilidade quando não
 * há candles disponíveis. Não aplica os filtros de contexto.
 */
function legacyRecommendation(context: HybridProbabilityContext): ProbabilityAdvisorResult {
  const catalog = context.catalog || [];
  const sequenceStats = calculateSequenceStats(catalog);

  const lastColor = catalog[catalog.length - 1]?.color;
  const secondLastColor = catalog[catalog.length - 2]?.color;
  const currentSequence = secondLastColor && lastColor ? `${secondLastColor}${lastColor}` : null;

  // calculateNextColorProbability retorna a probabilidade (0..1) do próximo candle ser VERDE.
  const nextColorProbability = calculateNextColorProbability(catalog, currentSequence);
  const greenProb = typeof nextColorProbability === "number" ? nextColorProbability : null;
  const nextColor: CandleColor | null = greenProb === null ? null : greenProb > 0.5 ? "GREEN" : "RED";

  let recommendation: "CALL" | "PUT" | null = null;
  let confidence = 0;
  let reason = "";

  if (currentSequence && greenProb !== null) {
    if (currentSequence === "VV" && nextColor === "GREEN") {
      recommendation = "CALL";
      confidence = 75;
      reason = "Sequência VV prevê próximo candle verde (CALL)";
    } else if (currentSequence === "RR" && nextColor === "RED") {
      recommendation = "PUT";
      confidence = 75;
      reason = "Sequência RR prevê próximo candle vermelho (PUT)";
    } else if (nextColor === "GREEN") {
      recommendation = "CALL";
      confidence = 60;
      reason = `Probabilidade de verde: ${(greenProb * 100).toFixed(0)}%`;
    } else {
      recommendation = "PUT";
      confidence = 60;
      reason = `Probabilidade de vermelho: ${((1 - greenProb) * 100).toFixed(0)}%`;
    }
  } else {
    recommendation = null;
    confidence = 10;
    reason = "Dados insuficientes para recomendação";
  }

  return {
    recommendation,
    confidence,
    reason,
    probability: greenProb === null ? null : (nextColor === "GREEN" ? greenProb : 1 - greenProb),
    nextColorProbability: nextColor,
    sequence: currentSequence ?? undefined,
    filters: [],
    blockedReasons: [],
    indicators: { adx: 0, ema200: null, atr: 0, atrBaseline: 0, flowIndex: 0 },
  };
}

/**
 * Helper functions for probability calculations.
 */
function calculateSequenceStats(catalog: any[]): Record<string, any> {
  const stats: Record<string, any> = {};

  for (let i = 0; i < catalog.length - 1; i++) {
    const color1 = catalog[i].color;
    const color2 = catalog[i + 1].color;

    if (color1 && color2) {
      const sequence = `${color1}${color2}`;
      if (!stats[sequence]) {
        stats[sequence] = { occurrences: 0, wins: 0, losses: 0, winRate: 0 };
      }

      stats[sequence].occurrences++;

      if (i + 2 < catalog.length) {
        const nextColor = catalog[i + 2].color;
        if (sequence === "VV" && nextColor === "GREEN") stats[sequence].wins++;
        else if (sequence === "RR" && nextColor === "RED") stats[sequence].wins++;
        else stats[sequence].losses++;
      } else {
        stats[sequence].losses++;
      }
    }
  }

  Object.values(stats).forEach((seqStats: any) => {
    const total = seqStats.wins + seqStats.losses;
    seqStats.winRate = total > 0 ? (seqStats.wins / total) * 100 : 0;
  });

  return stats;
}

function calculateNextColorProbability(
  catalog: any[],
  sequence?: string | null,
): number | null {
  if (!sequence || catalog.length < 2) return null;

  const lastIndex = catalog.map((_, idx) => idx).reverse().find(idx => {
    const color1 = catalog[idx]?.color;
    const color2 = catalog[idx + 1]?.color;
    return color1 && color2 && `${color1}${color2}` === sequence;
  });

  if (lastIndex === undefined) return null;

  const afterColor = catalog[lastIndex + 2]?.color;

  if (!afterColor) return null;

  const totalOccurrences = catalog.length - 2;
  const probability = (catalog.filter((_, idx) => idx >= lastIndex && idx < lastIndex + 2).length / totalOccurrences) * 100;

  return afterColor === "GREEN" ? probability / 100 : 1 - probability / 100;
}

function calculateWinRate(catalog: any[]): number {
  let wins = 0;
  let total = 0;

  for (let i = 0; i < catalog.length - 2; i++) {
    const color1 = catalog[i].color;
    const color2 = catalog[i + 1].color;
    const color3 = catalog[i + 2].color;

    if (color1 && color2 && color3) {
      total++;

      if ((color1 === "GREEN" && color2 === "GREEN" && color3 === "GREEN") ||
          (color1 === "RED" && color2 === "RED" && color3 === "RED")) {
        wins++;
      }
    }
  }

  return total > 0 ? (wins / total) * 100 : 0;
}

function getAllSequences(catalog: any[]): Array<{ sequence: string; winRate: number; occurrences: number }> {
  const stats = calculateSequenceStats(catalog);
  return Object.entries(stats).map(([sequence, data]) => ({ sequence, winRate: data.winRate, occurrences: data.occurrences }));
}
