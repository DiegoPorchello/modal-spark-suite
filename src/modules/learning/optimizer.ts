/**
 * Strategy Optimizer
 *
 * Generates recommendations based on analytics.
 * Never modifies strategies — only suggests.
 */

import type { LearningAnalytics, OptimizerRecommendation } from "./types/learning-types";

let recCounter = 0;

export class StrategyOptimizer {
  /**
   * Generate recommendations from analytics.
   */
  optimize(analytics: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    // Strategy-based recommendations
    recs.push(...this.recommendFromStrategies(analytics));

    // Session-based recommendations
    recs.push(...this.recommendFromSessions(analytics));

    // Indicator-based recommendations
    recs.push(...this.recommendFromIndicators(analytics));

    // Filter-based recommendations
    recs.push(...this.recommendFromFilters(analytics));

    // Profile-based recommendations
    recs.push(...this.recommendFromProfiles(analytics));

    // Volatility-based recommendations
    recs.push(...this.recommendFromVolatility(analytics));

    return recs;
  }

  private createRec(params: Omit<OptimizerRecommendation, "id" | "createdAt">): OptimizerRecommendation {
    return {
      ...params,
      id: `rec-${Date.now()}-${++recCounter}`,
      createdAt: Date.now(),
    };
  }

  private recommendFromStrategies(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    if (a.strategyRanking.length >= 2) {
      const best = a.strategyRanking[0];
      const worst = a.strategyRanking[a.strategyRanking.length - 1];

      if (best.winRate >= 70 && best.count >= 20) {
        recs.push(this.createRec({
          category: "strategy",
          priority: "HIGH",
          title: `Priorizar ${best.strategyName}`,
          description: `Taxa de ${best.winRate.toFixed(0)}% em ${best.count} operações. Considere aumentar exposição.`,
          impact: `Potencial melhoria de ${(best.winRate - 50).toFixed(0)}% no win rate geral`,
          confidence: Math.min(90, 50 + best.count / 5),
        }));
      }

      if (worst.winRate < 45 && worst.count >= 15) {
        recs.push(this.createRec({
          category: "strategy",
          priority: "MEDIUM",
          title: `Revisar ${worst.strategyName}`,
          description: `Taxa de ${worst.winRate.toFixed(0)}% em ${worst.count} operações. Considere ajustar parâmetros.`,
          impact: `Possível redução de perdas`,
          confidence: 65,
        }));
      }
    }

    return recs;
  }

  private recommendFromSessions(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    if (a.sessionRanking.length >= 2) {
      const best = a.sessionRanking[0];
      const worst = a.sessionRanking[a.sessionRanking.length - 1];

      if (best.winRate >= 75 && best.count >= 15) {
        recs.push(this.createRec({
          category: "session",
          priority: "HIGH",
          title: `Priorizar sessão ${best.session}`,
          description: `Win rate de ${best.winRate.toFixed(0)}% com ${best.count} operações.`,
          impact: `Foco nesta sessão pode melhorar resultado geral`,
          confidence: 80,
        }));
      }

      if (worst.winRate < 40 && worst.count >= 10) {
        recs.push(this.createRec({
          category: "session",
          priority: "MEDIUM",
          title: `Evitar sessão ${worst.session}`,
          description: `Win rate de ${worst.winRate.toFixed(0)}% — abaixo do esperado.`,
          impact: `Evitar perdas nesta sessão`,
          confidence: 70,
        }));
      }
    }

    return recs;
  }

  private recommendFromIndicators(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    const topIndicators = a.indicatorContributions
      .filter((i) => i.contributionPercent >= 60 && i.winRate >= 60)
      .slice(0, 3);

    for (const ind of topIndicators) {
      recs.push(this.createRec({
        category: "indicator",
        priority: "MEDIUM",
        title: `Manter ${ind.indicator} como confirmação`,
        description: `Presente em ${ind.contributionPercent.toFixed(0)}% dos WINs com ${ind.winRate.toFixed(0)}% de acerto.`,
        impact: `Indicador confiável para validação de entrada`,
        confidence: 75,
      }));
    }

    const weakIndicators = a.indicatorContributions
      .filter((i) => i.totalUses >= 10 && i.winRate < 40)
      .slice(0, 2);

    for (const ind of weakIndicators) {
      recs.push(this.createRec({
        category: "indicator",
        priority: "LOW",
        title: `Revisar peso de ${ind.indicator}`,
        description: `Win rate de ${ind.winRate.toFixed(0)}% com ${ind.totalUses} usos.`,
        impact: `Reduzir falsos positivos`,
        confidence: 60,
      }));
    }

    return recs;
  }

  private recommendFromFilters(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    const effectiveFilters = a.filterEffectiveness
      .filter((f) => f.avoidedLosses >= 3)
      .sort((a, b) => b.avoidedLosses - a.avoidedLosses)
      .slice(0, 2);

    for (const f of effectiveFilters) {
      recs.push(this.createRec({
        category: "filter",
        priority: "HIGH",
        title: `Manter filtro ${f.filter}`,
        description: `Evitou ${f.avoidedLosses} LOSS com eficácia de ${f.effectivenessPercent.toFixed(0)}%.`,
        impact: `Proteção contra perdas`,
        confidence: 80,
      }));
    }

    return recs;
  }

  private recommendFromProfiles(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    if (a.profileRanking.length >= 2) {
      const best = a.profileRanking[0];
      const worst = a.profileRanking[a.profileRanking.length - 1];

      if (best.winRate >= 70 && best.count >= 15) {
        recs.push(this.createRec({
          category: "profile",
          priority: "MEDIUM",
          title: `Perfil ${best.profile} apresenta melhor desempenho`,
          description: `${best.winRate.toFixed(0)}% de WIN em ${best.count} operações.`,
          impact: `Focalizar neste perfil`,
          confidence: 75,
        }));
      }

      if (worst.winRate < 45 && worst.count >= 10) {
        recs.push(this.createRec({
          category: "profile",
          priority: "LOW",
          title: `Perfil ${worst.profile} com desempenho inferior`,
          description: `${worst.winRate.toFixed(0)}% de WIN — abaixo da média.`,
          impact: `Revisar ou evitar este perfil`,
          confidence: 65,
        }));
      }
    }

    return recs;
  }

  private recommendFromVolatility(a: LearningAnalytics): OptimizerRecommendation[] {
    const recs: OptimizerRecommendation[] = [];

    const highVol = a.volatilityStats.find((v) => v.volatility === "HIGH");
    if (highVol && highVol.winRate < 45 && highVol.count >= 10) {
      recs.push(this.createRec({
        category: "filter",
        priority: "HIGH",
        title: `Evitar operações em alta volatilidade`,
        description: `Win rate cai para ${highVol.winRate.toFixed(0)}% durante alta volatilidade.`,
        impact: `Redução significativa de perdas`,
        confidence: 85,
      }));
    }

    const lowVol = a.volatilityStats.find((v) => v.volatility === "LOW");
    if (lowVol && lowVol.winRate >= 70 && lowVol.count >= 10) {
      recs.push(this.createRec({
        category: "filter",
        priority: "MEDIUM",
        title: `Priorizar operações em baixa volatilidade`,
        description: `Win rate de ${lowVol.winRate.toFixed(0)}% em baixa volatilidade.`,
        impact: `Melhor consistência`,
        confidence: 75,
      }));
    }

    return recs;
  }
}
