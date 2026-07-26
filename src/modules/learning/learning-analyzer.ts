/**
 * Learning Analyzer
 *
 * Generates insights, rankings, and analytics from Market Memory data.
 * 100% observational — never modifies strategies.
 */

import type { MarketMemoryRecord } from "@/modules/market-memory/types/memory-types";
import type {
  LearningInsight,
  StrategyRanking,
  CoreRanking,
  ProfileRanking,
  SessionRanking,
  AssetRanking,
  IndicatorContribution,
  FilterEffectiveness,
  VolatilityStats,
  TrendStats,
  LearningAnalytics,
} from "./types/learning-types";

let insightCounter = 0;

export class LearningAnalyzer {
  /**
   * Generate full analytics from records.
   */
  analyze(records: MarketMemoryRecord[]): LearningAnalytics {
    const completed = records.filter(
      (r) => r.result === "WIN" || r.result === "LOSS" || r.result === "BREAK_EVEN",
    );

    return {
      totalOperations: completed.length,
      overallWinRate: this.calcWinRate(completed),
      overallAvgProfit: this.calcAvgProfit(completed),
      strategyRanking: this.rankByStrategy(completed),
      coreRanking: this.rankByCore(completed),
      profileRanking: this.rankByProfile(completed),
      sessionRanking: this.rankBySession(completed),
      assetRanking: this.rankByAsset(completed),
      indicatorContributions: this.calcIndicatorContributions(completed),
      filterEffectiveness: this.calcFilterEffectiveness(records),
      volatilityStats: this.calcVolatilityStats(completed),
      trendStats: this.calcTrendStats(completed),
    };
  }

  /**
   * Generate insights from analytics.
   */
  generateInsights(analytics: LearningAnalytics): LearningInsight[] {
    const insights: LearningInsight[] = [];

    // Top strategy insight
    if (analytics.strategyRanking.length > 0) {
      const top = analytics.strategyRanking[0];
      if (top.winRate >= 75 && top.count >= 20) {
        insights.push(this.createInsight({
          category: "strategy",
          severity: "HIGH",
          confidence: Math.min(95, 50 + top.count / 10),
          title: `${top.strategyName} apresenta ${top.winRate.toFixed(0)}% de WIN`,
          description: `Nas últimas ${top.count} operações, ${top.strategyName} manteve taxa de acerto de ${top.winRate.toFixed(1)}%.`,
          recommendation: `Considere aumentar exposição nesta estratégia durante sessões favoráveis.`,
          metric: top.winRate,
          trend: "UP",
        }));
      }

      // Worst strategy
      const worst = analytics.strategyRanking[analytics.strategyRanking.length - 1];
      if (worst && worst.winRate < 45 && worst.count >= 10) {
        insights.push(this.createInsight({
          category: "strategy",
          severity: "MEDIUM",
          confidence: 70,
          title: `${worst.strategyName} apresenta ${worst.winRate.toFixed(0)}% de WIN`,
          description: `Taxa de acerto abaixo do esperado nas últimas ${worst.count} operações.`,
          recommendation: `Revise os parâmetros ou evite esta estratégia em condições atuais.`,
          metric: worst.winRate,
          trend: "DOWN",
        }));
      }
    }

    // Session insight
    if (analytics.sessionRanking.length > 0) {
      const best = analytics.sessionRanking[0];
      if (best.winRate >= 70 && best.count >= 15) {
        insights.push(this.createInsight({
          category: "session",
          severity: "HIGH",
          confidence: 80,
          title: `Sessão ${best.session} possui ${best.winRate.toFixed(0)}% de WIN`,
          description: `Melhor desempenho entre todas as sessões com ${best.count} operações.`,
          recommendation: `Priorize operações durante a sessão ${best.session}.`,
          metric: best.winRate,
        }));
      }
    }

    // Indicator contributions
    const topIndicators = analytics.indicatorContributions
      .filter((i) => i.contributionPercent >= 60)
      .slice(0, 3);
    for (const ind of topIndicators) {
      insights.push(this.createInsight({
        category: "indicator",
        severity: "MEDIUM",
        confidence: 75,
        title: `${ind.indicator} participou de ${ind.contributionPercent.toFixed(0)}% dos WINs`,
        description: `Indicador presente em ${ind.winUses} de ${analytics.totalOperations} operações vencedoras.`,
        recommendation: `Mantenha este indicador como critério de confirmação.`,
        metric: ind.contributionPercent,
      }));
    }

    // Filter effectiveness
    const effectiveFilters = analytics.filterEffectiveness
      .filter((f) => f.avoidedLosses >= 5)
      .sort((a, b) => b.avoidedLosses - a.avoidedLosses)
      .slice(0, 2);
    for (const f of effectiveFilters) {
      insights.push(this.createInsight({
        category: "filter",
        severity: "MEDIUM",
        confidence: 70,
        title: `Filtro ${f.filter} evitou ${f.avoidedLosses} LOSS`,
        description: `Filtro rejeitou operações que resultariam em perda.`,
        recommendation: `Mantenha este filtro ativo.`,
        metric: f.avoidedLosses,
      }));
    }

    // Volatility insight
    const highVol = analytics.volatilityStats.find((v) => v.volatility === "HIGH");
    if (highVol && highVol.winRate < 50) {
      insights.push(this.createInsight({
        category: "volatility",
        severity: "HIGH",
        confidence: 80,
        title: `Alta volatilidade reduz ${(100 - highVol.winRate).toFixed(0)}% da taxa de acerto`,
        description: `Win rate cai para ${highVol.winRate.toFixed(1)}% durante alta volatilidade.`,
        recommendation: `Evite operar ou reduza exposição durante alta volatilidade.`,
        metric: highVol.winRate,
        trend: "DOWN",
      }));
    }

    // Trend insight
    const lateral = analytics.trendStats.find((t) => t.trend === "LATERAL");
    if (lateral && lateral.winRate < 45 && lateral.count >= 10) {
      insights.push(this.createInsight({
        category: "trend",
        severity: "MEDIUM",
        confidence: 75,
        title: `Mercado lateral apresenta ${lateral.winRate.toFixed(0)}% de WIN`,
        description: `Operações em mercado lateral geram mais perdas.`,
        recommendation: `Aguarde definição de tendência antes de operar.`,
        metric: lateral.winRate,
        trend: "DOWN",
      }));
    }

    return insights;
  }

  // ── Private helpers ──

  private createInsight(params: Omit<LearningInsight, "id" | "createdAt">): LearningInsight {
    return {
      ...params,
      id: `insight-${Date.now()}-${++insightCounter}`,
      createdAt: Date.now(),
    };
  }

  private calcWinRate(records: MarketMemoryRecord[]): number {
    if (records.length === 0) return 0;
    const wins = records.filter((r) => r.result === "WIN").length;
    return (wins / records.length) * 100;
  }

  private calcAvgProfit(records: MarketMemoryRecord[]): number {
    if (records.length === 0) return 0;
    return records.reduce((s, r) => s + (r.pnl ?? 0), 0) / records.length;
  }

  private rankByStrategy(records: MarketMemoryRecord[]): StrategyRanking[] {
    const grouped = this.groupBy(records, "strategy");
    return [...grouped.entries()]
      .map(([strategy, recs]) => {
        const wins = recs.filter((r) => r.result === "WIN").length;
        const losses = recs.filter((r) => r.result === "LOSS").length;
        const bes = recs.filter((r) => r.result === "BREAK_EVEN").length;
        return {
          strategy,
          strategyName: recs[0]?.strategyName ?? strategy,
          count: recs.length,
          winRate: (wins / recs.length) * 100,
          lossRate: (losses / recs.length) * 100,
          breakEvenRate: (bes / recs.length) * 100,
          avgProfit: recs.reduce((s, r) => s + (r.pnl ?? 0), 0) / recs.length,
          avgScore: recs.reduce((s, r) => s + r.score, 0) / recs.length,
          avgConfidence: recs.reduce((s, r) => s + r.confidence, 0) / recs.length,
          drawdown: this.calcDrawdown(recs),
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  }

  private rankByCore(records: MarketMemoryRecord[]): CoreRanking[] {
    const grouped = this.groupBy(records, "core");
    return [...grouped.entries()]
      .map(([core, recs]) => ({
        core,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private rankByProfile(records: MarketMemoryRecord[]): ProfileRanking[] {
    const grouped = this.groupBy(records, "profile");
    return [...grouped.entries()]
      .map(([profile, recs]) => ({
        profile,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private rankBySession(records: MarketMemoryRecord[]): SessionRanking[] {
    const grouped = this.groupBy(records, "session");
    return [...grouped.entries()]
      .map(([session, recs]) => ({
        session,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private rankByAsset(records: MarketMemoryRecord[]): AssetRanking[] {
    const grouped = this.groupBy(records, "asset");
    return [...grouped.entries()]
      .map(([asset, recs]) => ({
        asset,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private calcIndicatorContributions(records: MarketMemoryRecord[]): IndicatorContribution[] {
    const indicatorStats = new Map<string, { total: number; wins: number }>();
    const totalWins = records.filter((r) => r.result === "WIN").length;

    for (const r of records) {
      for (const [key, val] of Object.entries(r.indicators)) {
        if (val === true || val === "true") {
          if (!indicatorStats.has(key)) indicatorStats.set(key, { total: 0, wins: 0 });
          const stat = indicatorStats.get(key)!;
          stat.total++;
          if (r.result === "WIN") stat.wins++;
        }
      }
    }

    return [...indicatorStats.entries()]
      .map(([indicator, stat]) => ({
        indicator,
        totalUses: stat.total,
        winUses: stat.wins,
        lossUses: stat.total - stat.wins,
        winRate: stat.total > 0 ? (stat.wins / stat.total) * 100 : 0,
        contributionPercent: totalWins > 0 ? (stat.wins / totalWins) * 100 : 0,
      }))
      .sort((a, b) => b.contributionPercent - a.contributionPercent);
  }

  private calcFilterEffectiveness(records: MarketMemoryRecord[]): FilterEffectiveness[] {
    const filterStats = new Map<string, { checks: number; winPass: number; lossPass: number }>();

    for (const r of records) {
      for (const filter of r.filters) {
        if (!filterStats.has(filter)) filterStats.set(filter, { checks: 0, winPass: 0, lossPass: 0 });
        const stat = filterStats.get(filter)!;
        stat.checks++;
        if (r.result === "WIN") stat.winPass++;
        if (r.result === "LOSS") stat.lossPass++;
      }
    }

    return [...filterStats.entries()]
      .map(([filter, stat]) => ({
        filter,
        totalChecks: stat.checks,
        passedWins: stat.winPass,
        passedLosses: stat.lossPass,
        avoidedLosses: Math.max(0, stat.checks - stat.lossPass - stat.winPass),
        effectivenessPercent: stat.checks > 0 ? (stat.winPass / stat.checks) * 100 : 0,
      }))
      .sort((a, b) => b.effectivenessPercent - a.effectivenessPercent);
  }

  private calcVolatilityStats(records: MarketMemoryRecord[]): VolatilityStats[] {
    const grouped = this.groupBy(records, "volatility");
    return [...grouped.entries()]
      .map(([volatility, recs]) => ({
        volatility,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private calcTrendStats(records: MarketMemoryRecord[]): TrendStats[] {
    const grouped = this.groupBy(records, "trend");
    return [...grouped.entries()]
      .map(([trend, recs]) => ({
        trend,
        count: recs.length,
        winRate: this.calcWinRate(recs),
        avgProfit: this.calcAvgProfit(recs),
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  private calcDrawdown(records: MarketMemoryRecord[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let balance = 0;

    for (const r of records) {
      balance += r.pnl ?? 0;
      if (balance > peak) peak = balance;
      const dd = peak - balance;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return maxDrawdown;
  }

  private groupBy(records: MarketMemoryRecord[], field: keyof MarketMemoryRecord): Map<string, MarketMemoryRecord[]> {
    const grouped = new Map<string, MarketMemoryRecord[]>();
    for (const r of records) {
      const key = String(r[field]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }
    return grouped;
  }
}
