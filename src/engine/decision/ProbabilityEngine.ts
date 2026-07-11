/**
 * engine/decision/ProbabilityEngine.ts
 * Combina scores de todos os engines em probabilidade final 0-100.
 *
 * Distribuição máxima:
 *   Trend: 20, Structure: 15, PriceAction: 15, SmartMoney: 10, Momentum: 15
 *   Base total: 75. Bônus de alinhamento/confluência até +25 = 100.
 */

import type { TrendResult } from "./TrendEngine";
import type { StructureResult } from "./StructureEngine";
import type { PriceActionResult } from "./PriceActionEngine";
import type { SmartMoneyResult } from "./SmartMoneyEngine";
import type { MomentumResult } from "./MomentumEngine";

export type ProbabilityLevel = "IGNORE" | "WEAK" | "MODERATE" | "EXCELLENT" | "PREMIUM";

export interface ProbabilityResult {
  total: number;
  level: ProbabilityLevel;
  trendScore: number;
  structureScore: number;
  priceActionScore: number;
  smartMoneyScore: number;
  momentumScore: number;
  breakdown: {
    trend: { score: number; max: number; label: string };
    structure: { score: number; max: number; label: string };
    priceAction: { score: number; max: number; label: string };
    smartMoney: { score: number; max: number; label: string };
    momentum: { score: number; max: number; label: string };
    bonuses: { score: number; max: number; label: string };
  };
  canOperate: boolean;
  details: string[];
}

export class ProbabilityEngine {
  private static readonly MIN_SCORE = 75;

  calculate(
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
  ): ProbabilityResult {
    const details: string[] = [];

    const tScore = trend.score;
    const sScore = structure.score;
    const paScore = priceAction.score;
    const smScore = smartMoney.score;
    const mScore = momentum.score;

    const baseTotal = tScore + sScore + paScore + smScore + mScore;

    // ── Bônus de alinhamento (0-10 pts) ──
    let alignmentBonus = 0;

    // Trend + Structure concordam
    if (
      trend.direction === "UPTREND" &&
      (structure.bos === "bullish" || structure.choch === "bullish")
    ) {
      alignmentBonus += 4;
      details.push("✔ Alinhamento: Tendência + Estrutura bullish");
    } else if (
      trend.direction === "DOWNTREND" &&
      (structure.bos === "bearish" || structure.choch === "bearish")
    ) {
      alignmentBonus += 4;
      details.push("✔ Alinhamento: Tendência + Estrutura bearish");
    }

    // Trend + PriceAction concordam
    if (trend.direction === "UPTREND" && priceAction.direction === "bullish") {
      alignmentBonus += 3;
      details.push("✔ Alinhamento: Tendência + Price Action bullish");
    } else if (trend.direction === "DOWNTREND" && priceAction.direction === "bearish") {
      alignmentBonus += 3;
      details.push("✔ Alinhamento: Tendência + Price Action bearish");
    }

    // Momentum confirma
    if (trend.direction === "UPTREND" && momentum.macdTrend === "bullish") {
      alignmentBonus += 3;
      details.push("✔ Momentum confirma bullish (MACD)");
    } else if (trend.direction === "DOWNTREND" && momentum.macdTrend === "bearish") {
      alignmentBonus += 3;
      details.push("✔ Momentum confirma bearish (MACD)");
    }

    // ── Bônus Smart Money confluência (0-5 pts) ──
    let smBonus = 0;
    if (smartMoney.orderBlocks.length > 0 && smartMoney.fvg) {
      smBonus += 3;
      details.push("✔ Confluência Smart Money: OB + FVG");
    }
    if (smartMoney.liquiditySweep) {
      smBonus += 2;
      details.push("✔ Liquidity sweep detectado");
    }

    // ── Bônus RSI (0-3 pts) ──
    let rsiBonus = 0;
    if (momentum.rsiZone === "oversold" && trend.direction === "UPTREND") {
      rsiBonus = 2;
      details.push("✔ RSI oversold confirma compra em uptrend");
    } else if (momentum.rsiZone === "overbought" && trend.direction === "DOWNTREND") {
      rsiBonus = 2;
      details.push("✔ RSI overbought confirma venda em downtrend");
    }

    // ── Bônus Pullback (0-2 pts) ──
    let pullbackBonus = 0;
    if (structure.pullbackZone) {
      pullbackBonus = 2;
      details.push("✔ Preço na zona de pullback");
    }

    const totalBonuses = Math.min(25, alignmentBonus + smBonus + rsiBonus + pullbackBonus);
    const finalTotal = Math.min(100, baseTotal + totalBonuses);

    // ── Classificação ──
    let level: ProbabilityLevel = "IGNORE";
    if (finalTotal >= 90) level = "PREMIUM";
    else if (finalTotal >= 80) level = "EXCELLENT";
    else if (finalTotal >= 70) level = "MODERATE";
    else if (finalTotal >= 50) level = "WEAK";

    const canOperate = finalTotal >= ProbabilityEngine.MIN_SCORE;

    // ── Diagnóstico do que falta ──
    if (!canOperate) {
      const missing: string[] = [];
      if (trend.direction === "SIDEWAYS") missing.push("tendência");
      if (trend.score < 10) missing.push(`tendência (${trend.score}/20)`);
      if (!structure.bos && !structure.choch) missing.push("estrutura (BOS/CHoCH)");
      if (structure.score < 6) missing.push(`estrutura (${structure.score}/15)`);
      if (!priceAction.pattern) missing.push("padrão de vela");
      if (priceAction.score < 5) missing.push(`price action (${priceAction.score}/15)`);
      if (smartMoney.orderBlocks.length === 0 && !smartMoney.fvg) missing.push("smart money");
      if (momentum.adx < 15) missing.push(`ADX fraco (${momentum.adx.toFixed(1)})`);
      if (momentum.score < 6) missing.push(`momentum (${momentum.score}/15)`);
      if (missing.length > 0) {
        details.push(`Faltam: ${missing.join(", ")}`);
      }
    }

    return {
      total: finalTotal,
      level,
      trendScore: tScore,
      structureScore: sScore,
      priceActionScore: paScore,
      smartMoneyScore: smScore,
      momentumScore: mScore,
      breakdown: {
        trend: { score: tScore, max: 20, label: "Tendência" },
        structure: { score: sScore, max: 15, label: "Estrutura" },
        priceAction: { score: paScore, max: 15, label: "Price Action" },
        smartMoney: { score: smScore, max: 10, label: "Smart Money" },
        momentum: { score: mScore, max: 15, label: "Momentum" },
        bonuses: { score: totalBonuses, max: 25, label: "Bônus Confluência" },
      },
      canOperate,
      details,
    };
  }
}
