/**
 * AdvisorEngine — pure analysis layer that interprets PerformanceContext
 * and generates AdvisorContext with recommendations, alerts, and opportunities.
 *
 * RULES:
 *   - Consumes: PerformanceContext
 *   - Produces: AdvisorContext
 *   - NEVER recalculates metrics
 *   - NEVER recalculates Score
 *   - NEVER accesses React
 *   - NEVER makes trading decisions
 */

import type { PerformanceContext } from "../../performance/types/performance-context.types";
import type {
  AdvisorContext,
  AdvisorRecommendation,
  AdvisorAlert,
  AdvisorOpportunity,
} from "../types/advisor-context.types";

let _idSeq = 0;
function nextId(prefix: string): string {
  return `adv-${prefix}-${Date.now()}-${++_idSeq}`;
}

// ══════════════════════════════════════════════════════════════════════════
// BUILD ADVISOR CONTEXT
// ══════════════════════════════════════════════════════════════════════════

export function buildAdvisorContext(perf: PerformanceContext | null): AdvisorContext {
  if (!perf || perf.totalTrades === 0) {
    return {
      generatedAt: Date.now(),
      overallStatus: "WARNING",
      recommendations: [],
      alerts: [],
      opportunities: [],
      robotHealth: perf?.robotHealth ?? { score: 0, label: "SEM DADOS", color: "text-muted-foreground", breakdown: { winRate: 0, profitFactor: 0, latency: 0, lossStreak: 0, consistency: 0 } },
    };
  }

  const recommendations = analyzeRecommendations(perf);
  const alerts = analyzeAlerts(perf);
  const opportunities = analyzeOpportunities(perf);

  const overallStatus = computeOverallStatus(recommendations, alerts, opportunities);

  return {
    generatedAt: Date.now(),
    overallStatus,
    recommendations,
    alerts,
    opportunities,
    robotHealth: perf.robotHealth,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// OVERALL STATUS
// ══════════════════════════════════════════════════════════════════════════

function computeOverallStatus(
  recommendations: AdvisorRecommendation[],
  alerts: AdvisorAlert[],
  _opportunities: AdvisorOpportunity[],
): AdvisorContext["overallStatus"] {
  const hasDanger = alerts.some((a) => a.severity === "DANGER");
  const hasCriticalRec = recommendations.some((r) => r.priority === "CRITICAL");
  const hasWarning = alerts.some((a) => a.severity === "WARNING");
  const hasHighRec = recommendations.some((r) => r.priority === "HIGH");

  if (hasDanger || hasCriticalRec) return "CRITICAL";
  if (hasWarning || hasHighRec) return "WARNING";
  if (recommendations.length > 0) return "GOOD";
  return "EXCELLENT";
}

// ══════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ══════════════════════════════════════════════════════════════════════════

function analyzeRecommendations(perf: PerformanceContext): AdvisorRecommendation[] {
  const recs: AdvisorRecommendation[] = [];

  // ── Worst Hour: Win Rate < 60% ──
  const worstHours = perf.byHour.filter((h) => h.totalTrades >= 3 && h.winRate < 60);
  for (const h of worstHours) {
    recs.push({
      id: nextId("rec"),
      priority: h.winRate < 40 ? "HIGH" : "MEDIUM",
      title: `Evite operar às ${h.hour}h`,
      description: `Win Rate de ${h.winRate.toFixed(1)}% no horário das ${h.hour}h com ${h.totalTrades} operações. Considere evitar este período.`,
      reason: `Win Rate abaixo de 60% no horário das ${h.hour}h`,
      basedOn: [`Win Rate ${h.hour}h: ${h.winRate.toFixed(1)}%`, `${h.totalTrades} operações`],
    });
  }

  // ── Best Strategy: Win Rate > 80% ──
  const bestStrategies = perf.byStrategy.filter(
    (s) => s.totalTrades >= 5 && s.winRate >= 80,
  );
  for (const s of bestStrategies) {
    recs.push({
      id: nextId("rec"),
      priority: s.winRate >= 90 ? "HIGH" : "MEDIUM",
      title: `Priorize a estratégia ${s.strategyName}`,
      description: `Win Rate de ${s.winRate.toFixed(1)}% com ${s.totalTrades} operações e lucro de R$ ${s.netProfit.toFixed(2)}.`,
      reason: `Estratégia com desempenho excelente (${s.winRate}% Win Rate)`,
      basedOn: [`Win Rate: ${s.winRate.toFixed(1)}%`, `${s.totalTrades} operações`, `Lucro: R$ ${s.netProfit.toFixed(2)}`],
    });
  }

  // ── Worst Strategy: Win Rate < 40% ──
  const worstStrategies = perf.byStrategy.filter(
    (s) => s.totalTrades >= 5 && s.winRate < 40,
  );
  for (const s of worstStrategies) {
    recs.push({
      id: nextId("rec"),
      priority: "MEDIUM",
      title: `Reavalie a estratégia ${s.strategyName}`,
      description: `Win Rate de apenas ${s.winRate.toFixed(1)}% com ${s.totalTrades} operações. Considere desativar ou ajustar.`,
      reason: `Estratégia com desempenho abaixo do esperado`,
      basedOn: [`Win Rate: ${s.winRate.toFixed(1)}%`, `${s.totalTrades} operações`],
    });
  }

  // ── Best Trend: Win Rate > 75% ──
  const bestTrends = perf.byTrend.filter(
    (t) => t.totalTrades >= 5 && t.winRate >= 75,
  );
  for (const t of bestTrends) {
    recs.push({
      id: nextId("rec"),
      priority: "LOW",
      title: `Mercado em tendência ${t.trend} está favorável`,
      description: `Win Rate de ${t.winRate.toFixed(1)}% em tendências ${t.trend} com ${t.totalTrades} operações.`,
      reason: `Alta taxa de acerto em tendências ${t.trend}`,
      basedOn: [`Win Rate: ${t.winRate.toFixed(1)}%`, `${t.totalTrades} operações`],
    });
  }

  // ── Overall Win Rate < 50% ──
  if (perf.totalTrades >= 10 && perf.winRate < 50) {
    recs.push({
      id: nextId("rec"),
      priority: "HIGH",
      title: "Win Rate geral abaixo de 50%",
      description: `Win Rate atual: ${perf.winRate.toFixed(1)}%. Considere revisar critérios de entrada e filtros.`,
      reason: "Desempenho geral abaixo do esperado",
      basedOn: [`Win Rate: ${perf.winRate.toFixed(1)}%`, `${perf.totalTrades} operações`],
    });
  }

  // ── Best Asset Recommendation ──
  if (perf.bestAsset && perf.bestAsset !== "—") {
    const bestAsset = perf.byAsset.find((a) => a.asset === perf.bestAsset);
    if (bestAsset && bestAsset.winRate >= 65 && bestAsset.totalTrades >= 5) {
      recs.push({
        id: nextId("rec"),
        priority: "LOW",
        title: `Foque no ativo ${bestAsset.asset}`,
        description: `Win Rate de ${bestAsset.winRate.toFixed(1)}% com ${bestAsset.totalTrades} operações. Este é o ativo com melhor desempenho.`,
        reason: "Melhor ativo por Win Rate e volume",
        basedOn: [`Win Rate: ${bestAsset.winRate.toFixed(1)}%`, `${bestAsset.totalTrades} operações`],
      });
    }
  }

  return recs;
}

// ══════════════════════════════════════════════════════════════════════════
// ALERTS
// ══════════════════════════════════════════════════════════════════════════

function analyzeAlerts(perf: PerformanceContext): AdvisorAlert[] {
  const alerts: AdvisorAlert[] = [];

  // ── Loss Streak >= 4 ──
  if (perf.currentLossStreak >= 4) {
    alerts.push({
      id: nextId("alert"),
      severity: perf.currentLossStreak >= 6 ? "DANGER" : "WARNING",
      title: "Sequência de perdas elevada",
      description: `${perf.currentLossStreak} LOSS consecutivos. Considere interromper as operações e reavaliar o mercado.`,
    });
  }

  // ── High Latency ──
  if (perf.averageLatency > 200) {
    alerts.push({
      id: nextId("alert"),
      severity: perf.averageLatency > 500 ? "DANGER" : "WARNING",
      title: "Latência acima do ideal",
      description: `Latência média de ${perf.averageLatency.toFixed(0)}ms. Ideal: abaixo de 200ms. Pode afetar a execução das operações.`,
    });
  }

  // ── Robot Health Degraded ──
  if (perf.robotHealth.score < 60) {
    alerts.push({
      id: nextId("alert"),
      severity: perf.robotHealth.score < 40 ? "DANGER" : "WARNING",
      title: "Saúde do robô degradada",
      description: `Score de saúde: ${perf.robotHealth.score}/100 (${perf.robotHealth.label}). Verifique os componentes abaixo do ideal.`,
    });
  }

  // ── Profit Factor < 1.0 ──
  if (perf.totalTrades >= 10 && perf.profitFactor < 1.0) {
    alerts.push({
      id: nextId("alert"),
      severity: "DANGER",
      title: "Profit Factor abaixo de 1.0",
      description: `Profit Factor atual: ${perf.profitFactor.toFixed(2)}. Operações estão gerando mais perdas que lucros.`,
    });
  }

  // ── Negative Net Profit ──
  if (perf.totalTrades >= 10 && perf.netProfit < 0) {
    alerts.push({
      id: nextId("alert"),
      severity: "DANGER",
      title: "Lucro líquido negativo",
      description: `Prejuízo de R$ ${Math.abs(perf.netProfit).toFixed(2)}. Revise os critérios de entrada.`,
    });
  }

  // ── Longest Loss Streak Warning ──
  if (perf.longestLossStreak >= 6 && perf.currentLossStreak === 0) {
    alerts.push({
      id: nextId("alert"),
      severity: "INFO",
      title: "Histórico de sequências longas de perda",
      description: `Maior sequência de perdas: ${perf.longestLossStreak}. O mercado pode ter períodos de alta volatilidade.`,
    });
  }

  // ── Win Rate Trend Down ──
  const wrTrend = perf.trends.find((t) => t.label === "Win Rate");
  if (wrTrend && wrTrend.direction === "down" && wrTrend.current < 60) {
    alerts.push({
      id: nextId("alert"),
      severity: "WARNING",
      title: "Win Rate em tendência de queda",
      description: `Win Rate caiu para ${wrTrend.current.toFixed(1)}% (era ${wrTrend.previous7d.toFixed(1)}% há 7 dias).`,
    });
  }

  return alerts;
}

// ══════════════════════════════════════════════════════════════════════════
// OPPORTUNITIES
// ══════════════════════════════════════════════════════════════════════════

function analyzeOpportunities(perf: PerformanceContext): AdvisorOpportunity[] {
  const opps: AdvisorOpportunity[] = [];

  // ── Strong Filter: Win Rate > 90% ──
  const strongFilters = perf.byFilter.filter(
    (f) => f.totalApprovals >= 5 && f.approvalWinRate >= 90,
  );
  for (const f of strongFilters) {
    opps.push({
      id: nextId("opp"),
      title: `Aumente o peso do filtro ${f.filterName}`,
      expectedImpact: `Win Rate de ${f.approvalWinRate.toFixed(1)}% quando aprovado`,
      description: `O filtro ${f.filterName} aprovou ${f.totalApprovals} operações com ${f.approvalWinRate.toFixed(1)}% de acerto. Considere aumentar seu peso na decisão.`,
    });
  }

  // ── Best Hour Opportunity ──
  const bestHours = perf.byHour
    .filter((h) => h.totalTrades >= 5 && h.winRate >= 70)
    .sort((a, b) => b.winRate - a.winRate);
  if (bestHours.length > 0) {
    const bh = bestHours[0];
    opps.push({
      id: nextId("opp"),
      title: `Concentre operações às ${bh.hour}h`,
      expectedImpact: `Win Rate de ${bh.winRate.toFixed(1)}% neste horário`,
      description: `O horário das ${bh.hour}h apresenta Win Rate de ${bh.winRate.toFixed(1)}% com ${bh.totalTrades} operações. Considere concentrar as operações neste período.`,
    });
  }

  // ── Best Strategy Scaling ──
  const topStrategy = perf.byStrategy
    .filter((s) => s.totalTrades >= 10 && s.winRate >= 70)
    .sort((a, b) => b.winRate - a.winRate)[0];
  if (topStrategy) {
    opps.push({
      id: nextId("opp"),
      title: `Escale a estratégia ${topStrategy.strategyName}`,
      expectedImpact: `${topStrategy.winRate.toFixed(1)}% Win Rate com ${topStrategy.totalTrades} operações`,
      description: `A estratégia ${topStrategy.strategyName} é a mais consistente. Considere aumentar a exposição quando as condições forem favoráveis.`,
    });
  }

  // ── Consistency Improvement ──
  if (perf.robotHealth.breakdown.consistency < 10 && perf.totalTrades >= 10) {
    opps.push({
      id: nextId("opp"),
      title: "Melhore a consistência de operações",
      expectedImpact: `Score de consistência: ${perf.robotHealth.breakdown.consistency.toFixed(1)}/15`,
      description: "A consistência está abaixo do ideal. Operar em horários e condições mais estáveis pode melhorar este componente.",
    });
  }

  return opps;
}
