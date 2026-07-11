/**
 * engine/decision/ScoreEngine.ts
 * Score Engine — sistema de pontuação que substitui a lógica AND.
 *
 * Cada filtro soma ou subtrai pontos. Nenhum filtro bloqueia entrada.
 * Score final determina a faixa de operação.
 *
 * FAIXAS:
 *   0–39   = Não operar
 *   40–59  = Mercado fraco
 *   60–69  = Mercado observação
 *   70–84  = Entrada permitida
 *   85–100 = Entrada forte
 */

import type { TrendResult } from "./TrendEngine";
import type { StructureResult } from "./StructureEngine";
import type { PriceActionResult } from "./PriceActionEngine";
import type { SmartMoneyResult } from "./SmartMoneyEngine";
import type { MomentumResult } from "./MomentumEngine";

export type ScoreBand =
  | "NAO_OPERAR"
  | "FRACO"
  | "OBSERVACAO"
  | "ENTRADA_PERMITIDA"
  | "ENTRADA_FORTE";

export interface ScoreFilterItem {
  name: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface ScoreBreakdownResult {
  total: number;
  band: ScoreBand;
  bandLabel: string;
  filters: ScoreFilterItem[];
  entryReason: string | null;
  refusalReason: string | null;
  strategy: string;
  logLines: string[];
}

export class ScoreEngine {
  // ── Pesos dos filtros (pontos máximos) — mutável para recalibração ──
  static WEIGHTS: Record<string, number> = {
    tendencia: 20,
    lta_ltb: 15,
    suporte_resistencia: 10,
    orderBlock: 20,
    liquidez: 10,
    pullback: 15,
    retracao: 10,
    forcaVela: 15,
    continuidade: 10,
    novaAltaBaixa: 15,
    smartMoney: 20,
    volume: 10,
    padraoCandle: 10,
  };

  // ── Histórico de performance dos filtros (feedback loop) ──
  private static filterPerformance: Record<string, { wins: number; losses: number; total: number }> = {};
  private static readonly MIN_TRADES_FOR_RECALIB = 20;
  private static readonly WEIGHT_ADJUST_STEP = 2;
  private static readonly WEIGHT_MIN = 5;
  private static readonly WEIGHT_MAX = 30;

  static recordResult(filterPoints: { name: string; points: number; maxPoints: number }[], wasWin: boolean): void {
    for (const f of filterPoints) {
      const key = f.name;
      if (!ScoreEngine.filterPerformance[key]) {
        ScoreEngine.filterPerformance[key] = { wins: 0, losses: 0, total: 0 };
      }
      if (f.points >= f.maxPoints * 0.5) {
        ScoreEngine.filterPerformance[key].total++;
        if (wasWin) {
          ScoreEngine.filterPerformance[key].wins++;
        } else {
          ScoreEngine.filterPerformance[key].losses++;
        }
      }
    }
  }

  private static readonly FILTER_NAME_MAP: Record<string, string> = {
    "Tendência": "tendencia",
    "LTA/LTB": "lta_ltb",
    "Suporte/Resistência": "suporte_resistencia",
    "Order Block": "orderBlock",
    "Liquidez": "liquidez",
    "Pullback": "pullback",
    "Retração": "retracao",
    "Força da vela": "forcaVela",
    "Continuidade": "continuidade",
    "Nova Alta/Baixa": "novaAltaBaixa",
    "Smart Money": "smartMoney",
    "Volume": "volume",
    "Padrão de Candle": "padraoCandle",
  };

  static recalibrateWeights(): { changes: Record<string, { old: number; new: number }> } {
    const changes: Record<string, { old: number; new: number }> = {};
    for (const [key, perf] of Object.entries(ScoreEngine.filterPerformance)) {
      if (perf.total < ScoreEngine.MIN_TRADES_FOR_RECALIB) continue;
      const winRate = perf.wins / perf.total;
      const weightKey = ScoreEngine.FILTER_NAME_MAP[key];
      if (!weightKey) continue;
      const oldWeight = ScoreEngine.WEIGHTS[weightKey] ?? 10;
      let newWeight = oldWeight;
      if (winRate > 0.65) {
        newWeight = Math.min(ScoreEngine.WEIGHT_MAX, oldWeight + ScoreEngine.WEIGHT_ADJUST_STEP);
      } else if (winRate < 0.45) {
        newWeight = Math.max(ScoreEngine.WEIGHT_MIN, oldWeight - ScoreEngine.WEIGHT_ADJUST_STEP);
      }
      if (newWeight !== oldWeight) {
        ScoreEngine.WEIGHTS[weightKey] = newWeight;
        changes[key] = { old: oldWeight, new: newWeight };
      }
    }
    return { changes };
  }

  static getFilterPerformance(): Record<string, { wins: number; losses: number; total: number; winRate: number }> {
    const result: Record<string, { wins: number; losses: number; total: number; winRate: number }> = {};
    for (const [key, perf] of Object.entries(ScoreEngine.filterPerformance)) {
      result[key] = { ...perf, winRate: perf.total > 0 ? perf.wins / perf.total : 0 };
    }
    return result;
  }

  // ── Penalidades ──
  static readonly PENALTIES = {
    doji: -10,
    insideBar: -5,
  } as const;

  // ── Faixas de score ──
  static readonly BANDS: { min: number; max: number; band: ScoreBand; label: string }[] = [
    { min: 0, max: 39, band: "NAO_OPERAR", label: "Não Operar" },
    { min: 40, max: 59, band: "FRACO", label: "Mercado Fraco" },
    { min: 60, max: 69, band: "OBSERVACAO", label: "Mercado Observação" },
    { min: 70, max: 84, band: "ENTRADA_PERMITIDA", label: "Entrada Permitida" },
    { min: 85, max: 100, band: "ENTRADA_FORTE", label: "Entrada Forte" },
  ];

  calculate(
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
  ): ScoreBreakdownResult {
    const filters: ScoreFilterItem[] = [];
    const logLines: string[] = [];
    let total = 0;

    // ══ 1. Tendência (0–20 pts) ══
    const tendenciaPts = this.scoreTendencia(trend);
    total += tendenciaPts.points;
    filters.push(tendenciaPts);
    logLines.push(`Tendência ${tendenciaPts.points >= 0 ? "+" : ""}${tendenciaPts.points}`);

    // ══ 2. LTA/LTB (0–15 pts) ══
    const ltaLtbPts = this.scoreLtaLtb(trend, structure);
    total += ltaLtbPts.points;
    filters.push(ltaLtbPts);
    logLines.push(`LTA/LTB ${ltaLtbPts.points >= 0 ? "+" : ""}${ltaLtbPts.points}`);

    // ══ 3. Suporte/Resistência (0–10 pts) ══
    const srPts = this.scoreSuporteResistencia(structure);
    total += srPts.points;
    filters.push(srPts);
    logLines.push(`Suporte/Resistência ${srPts.points >= 0 ? "+" : ""}${srPts.points}`);

    // ══ 4. Order Block (0–20 pts) ══
    const obPts = this.scoreOrderBlock(smartMoney);
    total += obPts.points;
    filters.push(obPts);
    logLines.push(`Order Block ${obPts.points >= 0 ? "+" : ""}${obPts.points}`);

    // ══ 5. Liquidez (0–10 pts) ══
    const liqPts = this.scoreLiquidez(smartMoney);
    total += liqPts.points;
    filters.push(liqPts);
    logLines.push(`Liquidez ${liqPts.points >= 0 ? "+" : ""}${liqPts.points}`);

    // ══ 6. Pullback (0–15 pts) ══
    const pbPts = this.scorePullback(structure);
    total += pbPts.points;
    filters.push(pbPts);
    logLines.push(`Pullback ${pbPts.points >= 0 ? "+" : ""}${pbPts.points}`);

    // ══ 7. Retração (0–10 pts) ══
    const retPts = this.scoreRetracao(structure, momentum);
    total += retPts.points;
    filters.push(retPts);
    logLines.push(`Retração ${retPts.points >= 0 ? "+" : ""}${retPts.points}`);

    // ══ 8. Força da vela (0–15 pts) ══
    const forcaPts = this.scoreForcaVela(priceAction, momentum);
    total += forcaPts.points;
    filters.push(forcaPts);
    logLines.push(`Força da vela ${forcaPts.points >= 0 ? "+" : ""}${forcaPts.points}`);

    // ══ 9. Continuidade (0–10 pts) ══
    const contPts = this.scoreContinuidade(trend, momentum);
    total += contPts.points;
    filters.push(contPts);
    logLines.push(`Continuidade ${contPts.points >= 0 ? "+" : ""}${contPts.points}`);

    // ══ 10. Nova Alta/Baixa (0–15 pts) ══
    const novaPts = this.scoreNovaAltaBaixa(trend, structure);
    total += novaPts.points;
    filters.push(novaPts);
    logLines.push(`Nova Alta/Baixa ${novaPts.points >= 0 ? "+" : ""}${novaPts.points}`);

    // ══ 11. Smart Money (0–20 pts) ══
    const smPts = this.scoreSmartMoney(smartMoney);
    total += smPts.points;
    filters.push(smPts);
    logLines.push(`Smart Money ${smPts.points >= 0 ? "+" : ""}${smPts.points}`);

    // ══ 12. Volume (0–10 pts) ══
    const volPts = this.scoreVolume(momentum);
    total += volPts.points;
    filters.push(volPts);
    logLines.push(`Volume ${volPts.points >= 0 ? "+" : ""}${volPts.points}`);

    // ══ 13. Padrão de Candle (0–10 pts ou penalidade) ══
    const candlePts = this.scorePadraoCandle(priceAction);
    total += candlePts.points;
    filters.push(candlePts);
    logLines.push(`Padrão de Candle ${candlePts.points >= 0 ? "+" : ""}${candlePts.points}`);

    // ══ Penalidades ══
    const penaltyPts = this.scorePenalidades(priceAction);
    total += penaltyPts.points;
    filters.push(penaltyPts);
    if (penaltyPts.points !== 0) {
      logLines.push(`Penalidades ${penaltyPts.points >= 0 ? "+" : ""}${penaltyPts.points}`);
    }

    // Clamp total 0-100
    total = Math.max(0, Math.min(100, total));

    // ── Classificação por faixa ──
    const bandInfo = this.getBand(total);

    // ── Motivo da entrada / recusa ──
    const entryReason = this.buildEntryReason(
      total,
      bandInfo.band,
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
    );
    const refusalReason =
      bandInfo.band === "NAO_OPERAR"
        ? `Score ${total}/100 — abaixo de 40. ${this.buildMissingList(filters)}`
        : null;

    // ── Estratégia selecionada ──
    const strategy = this.selectStrategy(
      total,
      bandInfo.band,
      trend,
      structure,
      priceAction,
      smartMoney,
    );

    logLines.push(`Score = ${total}`);
    if (total >= 70) {
      logLines.push(`Entrada ${total >= 85 ? "FORTE" : "autorizada"}.`);
    }

    return {
      total,
      band: bandInfo.band,
      bandLabel: bandInfo.label,
      filters,
      entryReason,
      refusalReason,
      strategy,
      logLines,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FILTROS INDIVIDUAIS
  // ═══════════════════════════════════════════════════════════════

  private scoreTendencia(trend: TrendResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.tendencia;

    if (trend.direction === "UPTREND" || trend.direction === "DOWNTREND") {
      // Tendência definida: proporcional ao score original
      pts = Math.round((trend.score / 20) * max);
    } else if (trend.emaAlignment === "bullish" || trend.emaAlignment === "bearish") {
      // Alinhamento parcial
      pts = Math.round((trend.score / 20) * max * 0.6);
    } else {
      pts = 0;
    }

    return {
      name: "Tendência",
      points: pts,
      maxPoints: max,
      detail: `${trend.direction} (${trend.emaAlignment}) — ${pts}/${max}`,
    };
  }

  private scoreLtaLtb(trend: TrendResult, structure: StructureResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.lta_ltb;

    // LTA = Higher Highs + Higher Lows (uptrend com HH/HL)
    // LTB = Lower Highs + Lower Lows (downtrend com LH/LL)
    const isLTA = trend.direction === "UPTREND" && trend.structure === "HH_HL";
    const isLTB = trend.direction === "DOWNTREND" && trend.structure === "LH_LL";

    if (isLTA || isLTB) {
      pts = max;
    } else if (trend.structure !== "mixed") {
      pts = Math.round(max * 0.5);
    } else if (trend.emaAlignment === "bullish" || trend.emaAlignment === "bearish") {
      pts = Math.round(max * 0.3);
    }

    return {
      name: "LTA/LTB",
      points: pts,
      maxPoints: max,
      detail: `Estrutura: ${trend.structure} — ${pts}/${max}`,
    };
  }

  private scoreSuporteResistencia(structure: StructureResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.suporte_resistencia;

    if (structure.support > 0 && structure.resistance < Infinity) {
      pts = max;
    } else if (structure.support > 0 || structure.resistance < Infinity) {
      pts = Math.round(max * 0.5);
    }

    return {
      name: "Suporte/Resistência",
      points: pts,
      maxPoints: max,
      detail: `S: ${structure.support.toFixed(4)} R: ${structure.resistance === Infinity ? "∞" : structure.resistance.toFixed(4)} — ${pts}/${max}`,
    };
  }

  private scoreOrderBlock(smartMoney: SmartMoneyResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.orderBlock;

    const untested = smartMoney.orderBlocks.filter((ob) => !ob.tested);
    if (untested.length > 0) {
      pts = Math.min(max, Math.round(untested.length * (max / 3)));
    }

    return {
      name: "Order Block",
      points: pts,
      maxPoints: max,
      detail: `OB: ${smartMoney.orderBlocks.length} (${untested.length} não testados) — ${pts}/${max}`,
    };
  }

  private scoreLiquidez(smartMoney: SmartMoneyResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.liquidez;

    if (smartMoney.liquiditySweep) {
      pts = max;
    } else if (smartMoney.displacement) {
      pts = Math.round(max * 0.5);
    }

    return {
      name: "Liquidez",
      points: pts,
      maxPoints: max,
      detail: `Sweep: ${smartMoney.liquiditySweep ?? "nenhum"} — ${pts}/${max}`,
    };
  }

  private scorePullback(structure: StructureResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.pullback;

    if (structure.pullbackZone) {
      pts = max;
    } else if (structure.nearestLevel) {
      // Preço próximo a um nível =潜在的 pullback
      pts = Math.round(max * 0.3);
    }

    return {
      name: "Pullback",
      points: pts,
      maxPoints: max,
      detail: `Zona: ${structure.pullbackZone ? "SIM" : "não"} — ${pts}/${max}`,
    };
  }

  private scoreRetracao(structure: StructureResult, momentum: MomentumResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.retracao;

    // Retração = preço em zona de pullback E momentum confirma
    if (structure.pullbackZone && momentum.rsiZone !== "neutral") {
      pts = max;
    } else if (structure.pullbackZone) {
      pts = Math.round(max * 0.6);
    } else if (momentum.rsiZone !== "neutral") {
      pts = Math.round(max * 0.3);
    }

    return {
      name: "Retração",
      points: pts,
      maxPoints: max,
      detail: `Pullback: ${structure.pullbackZone} RSI: ${momentum.rsiZone} — ${pts}/${max}`,
    };
  }

  private scoreForcaVela(
    priceAction: PriceActionResult,
    momentum: MomentumResult,
  ): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.forcaVela;

    if (priceAction.strength === "strong") {
      pts = max;
    } else if (priceAction.strength === "moderate") {
      pts = Math.round(max * 0.6);
    } else if (priceAction.bodyRatio > 0.5) {
      pts = Math.round(max * 0.3);
    }

    // Bônus: ATR confirma volatilidade
    if (momentum.atrPercent > 0.3 && pts > 0) {
      pts = Math.min(max, pts + Math.round(max * 0.15));
    }

    return {
      name: "Força da vela",
      points: pts,
      maxPoints: max,
      detail: `Força: ${priceAction.strength} Corpo: ${(priceAction.bodyRatio * 100).toFixed(0)}% — ${pts}/${max}`,
    };
  }

  private scoreContinuidade(trend: TrendResult, momentum: MomentumResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.continuidade;

    // Continuidade = tendência forte + momentum confirmando
    const trendStrong =
      (trend.direction === "UPTREND" || trend.direction === "DOWNTREND") && trend.score >= 12;
    const momentumConfirms =
      (trend.direction === "UPTREND" && momentum.macdTrend === "bullish") ||
      (trend.direction === "DOWNTREND" && momentum.macdTrend === "bearish");

    if (trendStrong && momentumConfirms) {
      pts = max;
    } else if (trendStrong || momentumConfirms) {
      pts = Math.round(max * 0.5);
    }

    return {
      name: "Continuidade",
      points: pts,
      maxPoints: max,
      detail: `Trend forte: ${trendStrong} MACD confirma: ${momentumConfirms} — ${pts}/${max}`,
    };
  }

  private scoreNovaAltaBaixa(trend: TrendResult, structure: StructureResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.novaAltaBaixa;

    // BOS bullish = nova alta, BOS bearish = nova baixa
    if (structure.bos === "bullish" || structure.bos === "bearish") {
      pts = max;
    } else if (structure.choch === "bullish" || structure.choch === "bearish") {
      pts = Math.round(max * 0.7);
    } else if (trend.structure === "HH_HL" || trend.structure === "LH_LL") {
      pts = Math.round(max * 0.4);
    }

    return {
      name: "Nova Alta/Baixa",
      points: pts,
      maxPoints: max,
      detail: `BOS: ${structure.bos ?? "nenhum"} CHoCH: ${structure.choch ?? "nenhum"} — ${pts}/${max}`,
    };
  }

  private scoreSmartMoney(smartMoney: SmartMoneyResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.smartMoney;

    let smScore = 0;
    if (smartMoney.orderBlocks.length > 0) smScore += 4;
    if (smartMoney.fvg) smScore += 3;
    if (smartMoney.liquiditySweep) smScore += 2;
    if (smartMoney.displacement) smScore += 1;

    // Normalizar para 0-max (score máximo possível: 10)
    pts = Math.round((smScore / 10) * max);

    return {
      name: "Smart Money",
      points: pts,
      maxPoints: max,
      detail: `OB: ${smartMoney.orderBlocks.length} FVG: ${smartMoney.fvg?.type ?? "nenhum"} Sweep: ${smartMoney.liquiditySweep ?? "nenhum"} — ${pts}/${max}`,
    };
  }

  private scoreVolume(momentum: MomentumResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.volume;

    if (momentum.volumeAboveAverage) {
      if (momentum.volumeTrend === "increasing") {
        pts = max;
      } else {
        pts = Math.round(max * 0.7);
      }
    } else {
      pts = 0;
    }

    return {
      name: "Volume",
      points: pts,
      maxPoints: max,
      detail: `Acima da média: ${momentum.volumeAboveAverage} Tendência: ${momentum.volumeTrend} — ${pts}/${max}`,
    };
  }

  private scorePadraoCandle(priceAction: PriceActionResult): ScoreFilterItem {
    let pts = 0;
    const max = ScoreEngine.WEIGHTS.padraoCandle;

    // Doji e Inside Bar já são tratados como penalidades
    if (priceAction.pattern === "doji" || priceAction.pattern === "inside_bar") {
      return {
        name: "Padrão de Candle",
        points: 0,
        maxPoints: max,
        detail: `Padrão neutro: ${priceAction.pattern} — 0/${max}`,
      };
    }

    if (priceAction.pattern && priceAction.direction !== "neutral") {
      if (priceAction.strength === "strong") {
        pts = max;
      } else if (priceAction.strength === "moderate") {
        pts = Math.round(max * 0.6);
      } else {
        pts = Math.round(max * 0.3);
      }
    }

    return {
      name: "Padrão de Candle",
      points: pts,
      maxPoints: max,
      detail: `Padrão: ${priceAction.pattern ?? "nenhum"} (${priceAction.direction}) — ${pts}/${max}`,
    };
  }

  private scorePenalidades(priceAction: PriceActionResult): ScoreFilterItem {
    let pts = 0;

    if (priceAction.pattern === "doji") {
      pts += ScoreEngine.PENALTIES.doji;
    }
    if (priceAction.pattern === "inside_bar") {
      pts += ScoreEngine.PENALTIES.insideBar;
    }

    return {
      name: "Penalidades",
      points: pts,
      maxPoints: 0,
      detail: pts === 0 ? "Nenhuma penalidade" : `Penalidade: ${pts}`,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  private getBand(score: number): { band: ScoreBand; label: string } {
    for (const b of ScoreEngine.BANDS) {
      if (score >= b.min && score <= b.max) {
        return { band: b.band, label: b.label };
      }
    }
    return { band: "NAO_OPERAR", label: "Não Operar" };
  }

  private buildEntryReason(
    total: number,
    band: ScoreBand,
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
  ): string | null {
    if (band === "NAO_OPERAR" || band === "FRACO") return null;

    const reasons: string[] = [];
    reasons.push(
      `Score ${total}/100 (${band === "ENTRADA_FORTE" ? "Entrada Forte" : "Entrada Permitida"})`,
    );

    if (trend.direction !== "SIDEWAYS") {
      reasons.push(`Tendência: ${trend.direction}`);
    }
    if (structure.bos) {
      reasons.push(`BOS ${structure.bos}`);
    }
    if (priceAction.pattern) {
      reasons.push(`Padrão: ${priceAction.pattern}`);
    }
    if (smartMoney.orderBlocks.length > 0) {
      reasons.push(`${smartMoney.orderBlocks.length} OB`);
    }
    if (momentum.macdTrend !== "neutral") {
      reasons.push(`MACD ${momentum.macdTrend}`);
    }

    return reasons.join(" | ");
  }

  private buildMissingList(filters: ScoreFilterItem[]): string {
    const zeros = filters.filter((f) => f.points === 0 && f.maxPoints > 0);
    if (zeros.length === 0) return "";
    return `Sem pontos: ${zeros.map((f) => f.name).join(", ")}`;
  }

  private selectStrategy(
    total: number,
    band: ScoreBand,
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
  ): string {
    if (band === "NAO_OPERAR") return "Aguardar";
    if (band === "FRACO") return "Observar mercado";

    // Estratégia baseada nos filtros mais fortes
    const strategies: string[] = [];

    if (smartMoney.orderBlocks.length > 0 && smartMoney.fvg) {
      strategies.push("Smart Money Confluence");
    }
    if (structure.pullbackZone) {
      strategies.push("Pullback Entry");
    }
    if (priceAction.strength === "strong") {
      strategies.push("Price Action Strong");
    }
    if (trend.score >= 15) {
      strategies.push("Trend Following");
    }

    if (strategies.length === 0) {
      strategies.push("Score-Based Entry");
    }

    return strategies[0];
  }
}
