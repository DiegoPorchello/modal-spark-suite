/**
 * NEXOR AIO Copilot — Performance-based answer generation.
 *
 * All answers are derived exclusively from PerformanceContext, AdvisorContext,
 * MarketProfile, StrategyLifecycleContext, LearningContext, and ConfidenceContext.
 * No business logic calculations are performed here.
 * This is a pure data transformation layer.
 */

import type { PerformanceContext } from "../performance/types/performance-context.types";
import type { AdvisorContext } from "../advisor/types/advisor-context.types";
import type { MarketProfile, ConfidenceBreakdown } from "../market/types/market-profile.types";
import type { StrategyLifecycleInstance, StrategyState } from "../lifecycle/types/strategy-lifecycle.types";
import type { LearningContext } from "../learning/types/learning-types";

export interface CopilotAnswer {
  question: string;
  answer: string;
  severity: "SUCCESS" | "INFO" | "WARNING" | "DANGER";
  metric?: number;
}

/**
 * Market context for copilot answers.
 */
export interface CopilotMarketContext {
  market: string;
  core: string;
  strategy: string;
  profile: string;
}

/**
 * Lifecycle context for copilot answers.
 */
export interface CopilotLifecycleContext {
  current: StrategyLifecycleInstance | null;
  active: StrategyLifecycleInstance[];
  totalHistory: number;
}

/**
 * Confidence context for copilot answers.
 */
export interface CopilotConfidenceContext {
  score: number;
  level: string;
  label: string;
  breakdown: ConfidenceBreakdown;
}

/**
 * Answer questions using exclusively AdvisorContext data.
 * Responses are derived from Advisor recommendations, alerts, and opportunities.
 */
export function answerFromAdvisorContext(
  advisor: AdvisorContext | null,
  question: string,
  marketCtx?: CopilotMarketContext,
): CopilotAnswer {
  if (!advisor) {
    return {
      question,
      answer: "Ainda não há dados do Advisor disponíveis. Aguarde o robô operar para gerar recomendações.",
      severity: "INFO",
    };
  }

  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // O que devo melhorar?
  if (q.includes("melhorar") || q.includes("o que devo") || q.includes("recomendacao") || q.includes("recomendação")) {
    if (advisor.recommendations.length === 0) {
      return { question, answer: "Nenhuma recomendação pendente. Seu desempenho está adequado.", severity: "SUCCESS" };
    }
    const top = advisor.recommendations[0];
    return {
      question,
      answer: `**${top.title}**: ${top.description} Motivo: ${top.reason}.`,
      severity: top.priority === "CRITICAL" ? "DANGER" : top.priority === "HIGH" ? "WARNING" : "INFO",
    };
  }

  // Qual estratégia devo usar?
  if (q.includes("qual estrategia") || q.includes("estrategia devo") || q.includes("estrategia usar")) {
    const stratRec = advisor.recommendations.find((r) => r.title.toLowerCase().includes("estrat"));
    if (stratRec) {
      return {
        question,
        answer: `O Advisor recomenda: **${stratRec.title}**. ${stratRec.description}`,
        severity: "INFO",
      };
    }
    return { question, answer: "Nenhuma recomendação específica de estratégia no momento.", severity: "INFO" };
  }

  // Vale a pena operar agora?
  if (q.includes("vale a pena") || q.includes("operar agora") || q.includes("devo operar") || q.includes("momento")) {
    if (advisor.overallStatus === "CRITICAL") {
      return {
        question,
        answer: `⚠ **Não recomendado.** Status: ${advisor.overallStatus}. Existem ${advisor.alerts.length} alertas ativos. ${advisor.alerts[0]?.description ?? ""}`,
        severity: "DANGER",
      };
    }
    if (advisor.overallStatus === "WARNING") {
      return {
        question,
        answer: `🟡 **Momente de cautela.** Status: ${advisor.overallStatus}. ${advisor.alerts[0]?.description ?? ""}`,
        severity: "WARNING",
      };
    }
    return {
      question,
      answer: `✅ **Condições favoráveis.** Status: ${advisor.overallStatus}. O robô pode operar normalmente.`,
      severity: "SUCCESS",
    };
  }

  // Existe algum alerta?
  if (q.includes("alerta") || q.includes("alertas") || q.includes("perigo") || q.includes("risco")) {
    if (advisor.alerts.length === 0) {
      return { question, answer: "Nenhum alerta ativo no momento. Tudo operando normalmente.", severity: "SUCCESS" };
    }
    const alerts = advisor.alerts.map((a) => `• **${a.title}**: ${a.description}`).join("\n");
    return {
      question,
      answer: `${advisor.alerts.length} alerta(s) ativo(s):\n${alerts}`,
      severity: advisor.alerts.some((a) => a.severity === "DANGER") ? "DANGER" : "WARNING",
    };
  }

  // O que está reduzindo minha taxa de acerto?
  if (q.includes("reduzindo") || q.includes("taxa de acerto") || q.includes("win rate caiu") || q.includes("piorando")) {
    const negativeAlerts = advisor.alerts.filter((a) => a.severity === "DANGER" || a.severity === "WARNING");
    if (negativeAlerts.length === 0) {
      return { question, answer: "Nenhum fator negativo identificado no momento.", severity: "SUCCESS" };
    }
    const reasons = negativeAlerts.map((a) => `• ${a.title}: ${a.description}`).join("\n");
    return {
      question,
      answer: `Fatores identificados:\n${reasons}`,
      severity: "WARNING",
    };
  }

  // Status geral
  if (q.includes("status") || q.includes("situacao") || q.includes("situação")) {
    const statusLabel =
      advisor.overallStatus === "EXCELLENT" ? "🟢 Excelente" :
      advisor.overallStatus === "GOOD" ? "🟢 Bom" :
      advisor.overallStatus === "WARNING" ? "🟡 Atenção" : "🔴 Crítico";
    return {
      question,
      answer: `Status geral: **${statusLabel}**. Recomendações: ${advisor.recommendations.length} | Alertas: ${advisor.alerts.length} | Oportunidades: ${advisor.opportunities.length}.`,
      severity: advisor.overallStatus === "CRITICAL" ? "DANGER" : advisor.overallStatus === "WARNING" ? "WARNING" : "SUCCESS",
    };
  }

  // Qual mercado estou operando?
  if (q.includes("mercado") || q.includes("core") || q.includes("perfil") || q.includes("market")) {
    if (marketCtx) {
      return {
        question,
        answer: `Mercado: **${marketCtx.market}** | Core: ${marketCtx.core} | Perfil: ${marketCtx.profile} | Estratégia: ${marketCtx.strategy}.`,
        severity: "INFO",
      };
    }
    return { question, answer: "Contexto de mercado não disponível.", severity: "INFO" };
  }

  return {
    question,
    answer: `Perguntas suportadas: o que devo melhorar, qual estratégia usar, vale a pena operar, alertas, o que reduz taxa de acerto, status geral, mercado.`,
    severity: "INFO",
  };
}

/**
 * Answer questions using exclusively PerformanceContext data.
 * All responses are derived from pre-computed metrics.
 */
export function answerFromPerformanceContext(
  ctx: PerformanceContext | null,
  question: string,
): CopilotAnswer {
  if (!ctx) {
    return {
      question,
      answer: "Ainda não há dados de performance disponíveis. Aguarde o robô operar para gerar métricas.",
      severity: "INFO",
    };
  }

  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Qual minha melhor estratégia?
  if (q.includes("melhor estrat") || q.includes("estrategia melhor") || q.includes("qual estrategia")) {
    if (ctx.byStrategy.length === 0) {
      return { question, answer: "Ainda não há estratégias registradas.", severity: "INFO" };
    }
    const best = ctx.byStrategy.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    return {
      question,
      answer: `A melhor estratégia é **${best.strategyName}** com ${best.winRate}% de Win Rate em ${best.totalTrades} operações, gerando R$ ${best.netProfit.toFixed(2)} de lucro líquido.`,
      severity: best.winRate >= 50 ? "SUCCESS" : "WARNING",
      metric: best.winRate,
    };
  }

  // Em qual horário ganho mais?
  if (q.includes("horario") || q.includes("hora ganho") || q.includes("melhor hora") || q.includes("melhor horario")) {
    const profitable = ctx.byHour.filter((h) => h.netProfit > 0);
    if (profitable.length === 0) {
      return { question, answer: "Nenhum horário registrou lucro ainda.", severity: "INFO" };
    }
    const best = profitable.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    return {
      question,
      answer: `O melhor horário é às **${best.hour}h** com ${best.winRate}% de Win Rate e R$ ${best.netProfit.toFixed(2)} de lucro.`,
      severity: "SUCCESS",
      metric: best.hour,
    };
  }

  // Qual ativo apresenta melhor desempenho?
  if (q.includes("ativo") || q.includes("melhor ativo") || q.includes("ativo melhor")) {
    if (ctx.byAsset.length === 0) {
      return { question, answer: "Ainda não há ativos registrados.", severity: "INFO" };
    }
    const best = ctx.byAsset.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    return {
      question,
      answer: `O melhor ativo é **${best.asset}** com ${best.winRate}% de Win Rate em ${best.totalTrades} operações, lucro de R$ ${best.netProfit.toFixed(2)}.`,
      severity: best.winRate >= 50 ? "SUCCESS" : "WARNING",
      metric: best.winRate,
    };
  }

  // Meu Win Rate melhorou?
  if (q.includes("win rate melhorou") || q.includes("winrate melhorou") || q.includes("win rate")) {
    const trend = ctx.trends.find((t) => t.label === "Win Rate");
    if (!trend) {
      return { question, answer: "Dados insuficientes para analisar tendência do Win Rate.", severity: "INFO" };
    }
    const direction = trend.direction === "up" ? "melhorou" : trend.direction === "down" ? "piorou" : "estabilizou";
    return {
      question,
      answer: `O Win Rate ${direction}. Atual: **${trend.current}%** | 7 dias: ${trend.previous7d}% | 30 dias: ${trend.previous30d}%.`,
      severity: trend.direction === "up" ? "SUCCESS" : trend.direction === "down" ? "WARNING" : "INFO",
      metric: trend.current,
    };
  }

  // Qual filtro mais gera WIN?
  if (q.includes("filtro") && (q.includes("win") || q.includes("vencedor") || q.includes("aprov"))) {
    const sorted = [...ctx.byFilter].sort((a, b) => b.approvalWinRate - a.approvalWinRate);
    if (sorted.length === 0) {
      return { question, answer: "Ainda não há dados de filtros.", severity: "INFO" };
    }
    const best = sorted[0];
    return {
      question,
      answer: `O filtro mais eficiente é **${best.filterName}** com ${best.approvalWinRate}% de Win Rate quando aprovado (${best.totalApprovals} aprovações).`,
      severity: "SUCCESS",
      metric: best.approvalWinRate,
    };
  }

  // Qual filtro mais gera LOSS?
  if (q.includes("filtro") && (q.includes("loss") || q.includes("perda") || q.includes("rejeit"))) {
    const sorted = [...ctx.byFilter].sort((a, b) => a.approvalWinRate - b.approvalWinRate);
    if (sorted.length === 0) {
      return { question, answer: "Ainda não há dados de filtros.", severity: "INFO" };
    }
    const worst = sorted[0];
    return {
      question,
      answer: `O filtro menos confiável é **${worst.filterName}** com apenas ${worst.approvalWinRate}% de Win Rate quando aprovado. Considere revisar sua lógica.`,
      severity: "DANGER",
      metric: worst.approvalWinRate,
    };
  }

  // Como está a saúde do robô?
  if (q.includes("saude") || q.includes("saúde") || q.includes("health") || q.includes("robô")) {
    const h = ctx.robotHealth;
    return {
      question,
      answer: `A saúde do robô está **${h.label}** (${h.score}/100). Win Rate: ${h.breakdown.winRate.toFixed(1)}/25 | Profit Factor: ${h.breakdown.profitFactor.toFixed(1)}/25 | Latência: ${h.breakdown.latency.toFixed(1)}/20 | Loss Streak: ${h.breakdown.lossStreak.toFixed(1)}/15 | Consistência: ${h.breakdown.consistency.toFixed(1)}/15.`,
      severity: h.score >= 60 ? "SUCCESS" : h.score >= 40 ? "WARNING" : "DANGER",
      metric: h.score,
    };
  }

  // Fallback
  return {
    question,
    answer: `Não consegui responder essa pergunta com os dados disponíveis. Perguntas suportadas: melhor estratégia, melhor horário, melhor ativo, win rate, filtros, saúde do robô.`,
    severity: "INFO",
  };
}

/**
 * Answer questions using StrategyLifecycleContext.
 */
export function answerFromLifecycleContext(
  lifecycle: CopilotLifecycleContext | null,
  question: string,
): CopilotAnswer {
  if (!lifecycle || !lifecycle.current) {
    return {
      question,
      answer: "Nenhuma estratégia está em ciclo ativo. Aguarde o robô iniciar uma operação.",
      severity: "INFO",
    };
  }

  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const current = lifecycle.current;
  const elapsed = Date.now() - current.currentStateSince;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  // Em que estágio da estratégia estamos?
  if (q.includes("estagio") || q.includes("estágio") || q.includes("fase") || q.includes("estado")) {
    const stateLabels: Record<StrategyState, string> = {
      IDLE: "inativa",
      MONITORING: "monitoramento (observando o mercado)",
      PREPARING: "preparação (confluências sendo formadas)",
      READY: "pronta (entrada próxima)",
      CONFIRMED: "confirmada (todos critérios atendidos)",
      EXECUTING: "executando (ordem enviada)",
      ACTIVE: "ativa (operação em andamento)",
      COMPLETED: "concluída",
      CANCELLED: "cancelada",
      LEARNING: "aprendizado (analisando resultado)",
    };
    return {
      question,
      answer: `Estratégia "${current.strategyName}" está em **${stateLabels[current.state]}** há ${minutes}m ${seconds}s.`,
      severity: current.state === "ACTIVE" ? "SUCCESS" : "INFO",
    };
  }

  // Qual o próximo passo?
  if (q.includes("proximo") || q.includes("próximo") || q.includes("passo")) {
    const nextMap: Record<StrategyState, string> = {
      IDLE: "Iniciar monitoramento do mercado",
      MONITORING: "Aguardar formação de confluências",
      PREPARING: "Aguardar sinais de confirmação",
      READY: "Confirmar entrada quando critérios atenderem",
      CONFIRMED: "Executar ordem",
      EXECUTING: "Aguardar confirmação da ordem",
      ACTIVE: "Gerenciar posição (trailing stop / take profit)",
      COMPLETED: "Analisar resultado e aprender",
      CANCELLED: "Reiniciar monitoramento",
      LEARNING: "Reiniciar ciclo",
    };
    return {
      question,
      answer: `Próximo passo: **${nextMap[current.state]}**`,
      severity: "INFO",
    };
  }

  // Quantas estratégias estão ativas?
  if (q.includes("quantas") || q.includes("ativas") || q.includes("estrategias ativas")) {
    const activeCount = lifecycle.active.length;
    return {
      question,
      answer: activeCount > 0
        ? `${activeCount} estratégia(s) ativa(s) no momento.`
        : "Nenhuma estratégia ativa no momento.",
      severity: activeCount > 0 ? "SUCCESS" : "INFO",
      metric: activeCount,
    };
  }

  // Histórico de estados
  if (q.includes("historico") || q.includes("histórico") || q.includes("timeline")) {
    const steps = current.timeline.length;
    return {
      question,
      answer: `A estratégia passou por **${steps}** etapas desde o início. Estado atual: ${current.state}.`,
      severity: "INFO",
      metric: steps,
    };
  }

  return {
    question,
    answer: `Estratégia "${current.strategyName}" — Estado: ${current.state}. Há ${minutes}m ${seconds}s neste estado.`,
    severity: "INFO",
  };
}

/**
 * Answer questions using LearningContext.
 */
export function answerFromLearningContext(
  learning: LearningContext | null,
  question: string,
): CopilotAnswer {
  if (!learning || learning.analytics.totalOperations === 0) {
    return {
      question,
      answer: "Ainda não há dados históricos suficientes para análises de aprendizado. Aguarde mais operações.",
      severity: "INFO",
    };
  }

  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { analytics } = learning;

  // Qual estratégia apresenta maior taxa de acerto?
  if (q.includes("estrategia") && (q.includes("maior") || q.includes("acerto") || q.includes("melhor"))) {
    if (learning.topStrategy) {
      const s = learning.topStrategy;
      return {
        question,
        answer: `${s.strategyName} é a melhor com **${s.winRate.toFixed(0)}% de WIN** em ${s.count} operações. Lucro médio: ${s.avgProfit.toFixed(2)}.`,
        severity: "SUCCESS",
        metric: s.winRate,
      };
    }
  }

  // Qual sessão está performando melhor?
  if (q.includes("sessao") || q.includes("sessão") || q.includes("horario") || q.includes("horário")) {
    if (learning.topSession) {
      const s = learning.topSession;
      return {
        question,
        answer: `Sessão **${s.session}** está performando melhor com **${s.winRate.toFixed(0)}% de WIN** em ${s.count} operações.`,
        severity: "SUCCESS",
        metric: s.winRate,
      };
    }
  }

  // Qual Core está gerando mais lucro?
  if (q.includes("core") && (q.includes("lucro") || q.includes("mais") || q.includes("melhor"))) {
    if (learning.topCore) {
      const c = learning.topCore;
      return {
        question,
        answer: `**${c.core}** é o melhor com **${c.winRate.toFixed(0)}% de WIN** em ${c.count} operações. Lucro médio: ${c.avgProfit.toFixed(2)}.`,
        severity: "SUCCESS",
        metric: c.winRate,
      };
    }
  }

  // Qual indicador mais contribuiu para os WINs?
  if (q.includes("indicador") && (q.includes("contribuiu") || q.includes("mais") || q.includes("melhor"))) {
    if (learning.topIndicator) {
      const i = learning.topIndicator;
      return {
        question,
        answer: `**${i.indicator}** participou de **${i.contributionPercent.toFixed(0)}% dos WINs** com ${i.winRate.toFixed(0)}% de acerto.`,
        severity: "SUCCESS",
        metric: i.contributionPercent,
      };
    }
  }

  // Quais filtros mais evitaram LOSS?
  if (q.includes("filtro") && (q.includes("evitaram") || q.includes("mais") || q.includes("melhor"))) {
    if (learning.topFilter) {
      const f = learning.topFilter;
      return {
        question,
        answer: `Filtro **${f.filter}** evitou **${f.avoidedLosses} LOSS** com eficácia de ${f.effectivenessPercent.toFixed(0)}%.`,
        severity: "SUCCESS",
        metric: f.avoidedLosses,
      };
    }
  }

  // Qual ativo possui maior taxa de acerto?
  if (q.includes("ativo") && (q.includes("maior") || q.includes("acerto") || q.includes("melhor"))) {
    const topAsset = analytics.assetRanking[0];
    if (topAsset) {
      return {
        question,
        answer: `**${topAsset.asset}** possui maior taxa de acerto com **${topAsset.winRate.toFixed(0)}% de WIN** em ${topAsset.count} operações.`,
        severity: "SUCCESS",
        metric: topAsset.winRate,
      };
    }
  }

  // Win rate geral
  if (q.includes("win rate") || q.includes("taxa de acerto")) {
    return {
      question,
      answer: `Win rate geral: **${analytics.overallWinRate.toFixed(1)}%** em ${analytics.totalOperations} operações.`,
      severity: analytics.overallWinRate >= 60 ? "SUCCESS" : "WARNING",
      metric: analytics.overallWinRate,
    };
  }

  // Lucro médio
  if (q.includes("lucro") || q.includes("prejuizo") || q.includes("prejuízo")) {
    return {
      question,
      answer: `Lucro médio por operação: **${analytics.overallAvgProfit.toFixed(2)}** em ${analytics.totalOperations} operações.`,
      severity: analytics.overallAvgProfit > 0 ? "SUCCESS" : "WARNING",
      metric: analytics.overallAvgProfit,
    };
  }

  return {
    question,
    answer: `Baseado em ${analytics.totalOperations} operações — Win Rate: ${analytics.overallWinRate.toFixed(1)}%.`,
    severity: "INFO",
    metric: analytics.overallWinRate,
  };
}

/**
 * Answer questions using ConfidenceContext.
 */
export function answerFromConfidenceContext(
  confidence: CopilotConfidenceContext | null,
  question: string,
): CopilotAnswer {
  if (!confidence) {
    return {
      question,
      answer: "Ainda não há dados de confiança disponíveis. Aguarde o robô analisar o mercado.",
      severity: "INFO",
    };
  }

  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const { score, level, label, breakdown } = confidence;

  // Qual é o nível de confiança?
  if (q.includes("confianca") || q.includes("confiança") || q.includes("nivel") || q.includes("nível")) {
    const recommendations: Record<string, string> = {
      ELITE: "Entrada altamente recomendada",
      HIGH: "Entrada recomendada",
      GOOD: "Operar com atenção",
      MODERATE: "Aguardar mais confirmações",
      LOW: "Não operar",
    };
    return {
      question,
      answer: `Confiança: **${label}** (${score}%). ${recommendations[level] ?? ""}`,
      severity: score >= 70 ? "SUCCESS" : score >= 60 ? "WARNING" : "DANGER",
      metric: score,
    };
  }

  // Por que a confiança foi X%?
  if (q.includes("por que") && (q.includes("confianca") || q.includes("confiança") || q.includes("score"))) {
    const breakdownText = [
      `Tendência: ${breakdown.trend}/20`,
      `Estrutura: ${breakdown.structure}/18`,
      `Smart Money: ${breakdown.smartMoney}/20`,
      `Supply/Demand: ${breakdown.supplyDemand}/10`,
      `Momentum: ${breakdown.momentum}/10`,
      `Sessão: ${breakdown.session}/7`,
      `Confluência: ${breakdown.confluence}/15`,
    ].join(" | ");

    return {
      question,
      answer: `Score total: **${score}%** (${label})\n\n${breakdownText}`,
      severity: "INFO",
      metric: score,
    };
  }

  // Qual categoria reduziu o score?
  if (q.includes("reduziu") || q.includes("reduz") || q.includes("menor")) {
    const categories = [
      { name: "Tendência", value: breakdown.trend, max: 20 },
      { name: "Estrutura", value: breakdown.structure, max: 18 },
      { name: "Smart Money", value: breakdown.smartMoney, max: 20 },
      { name: "Supply/Demand", value: breakdown.supplyDemand, max: 10 },
      { name: "Momentum", value: breakdown.momentum, max: 10 },
      { name: "Sessão", value: breakdown.session, max: 7 },
      { name: "Confluência", value: breakdown.confluence, max: 15 },
    ];

    const weakest = categories.reduce((a, b) => (a.value / a.max < b.value / b.max ? a : b));
    const percent = ((weakest.value / weakest.max) * 100).toFixed(0);

    return {
      question,
      answer: `Categoria mais fraca: **${weakest.name}** (${weakest.value}/${weakest.max} = ${percent}%). Considere melhorar esta área.`,
      severity: "WARNING",
      metric: weakest.value,
    };
  }

  // O que falta para atingir nível Elite?
  if (q.includes("falta") || q.includes("elite") || q.includes("melhorar")) {
    if (score >= 90) {
      return {
        question,
        answer: `Parabéns! Você já está no nível **Elite** (${score}%).`,
        severity: "SUCCESS",
        metric: score,
      };
    }

    const needed = 90 - score;
    const categories = [
      { name: "Tendência", value: breakdown.trend, max: 20 },
      { name: "Estrutura", value: breakdown.structure, max: 18 },
      { name: "Smart Money", value: breakdown.smartMoney, max: 20 },
      { name: "Supply/Demand", value: breakdown.supplyDemand, max: 10 },
      { name: "Momentum", value: breakdown.momentum, max: 10 },
      { name: "Sessão", value: breakdown.session, max: 7 },
      { name: "Confluência", value: breakdown.confluence, max: 15 },
    ];

    const improvable = categories
      .filter(c => c.value < c.max)
      .sort((a, b) => (b.max - b.value) - (a.max - a.value))
      .slice(0, 2);

    const suggestions = improvable.map(c => `${c.name} (+${c.max - c.value} disponível)`).join(", ");

    return {
      question,
      answer: `Faltam **${needed} pontos** para Elite. Melhore: ${suggestions}`,
      severity: "INFO",
      metric: needed,
    };
  }

  // Breakdown completo
  return {
    question,
    answer: `Confiança: **${label}** (${score}%)\nTendência: ${breakdown.trend}/20 | Estrutura: ${breakdown.structure}/18 | Smart Money: ${breakdown.smartMoney}/20`,
    severity: "INFO",
    metric: score,
  };
}

/**
 * Generate all possible copilot answers for display in the Insights panel.
 */
export function generateAllCopilotAnswers(
  ctx: PerformanceContext | null,
  advisor?: AdvisorContext | null,
  marketCtx?: CopilotMarketContext,
  lifecycleCtx?: CopilotLifecycleContext,
  learningCtx?: LearningContext,
  confidenceCtx?: CopilotConfidenceContext,
): CopilotAnswer[] {
  const answers: CopilotAnswer[] = [];

  if (ctx) {
    const questions = [
      "Qual minha melhor estratégia?",
      "Em qual horário ganho mais?",
      "Qual ativo apresenta melhor desempenho?",
      "Meu Win Rate melhorou?",
      "Qual filtro mais gera WIN?",
      "Qual filtro mais gera LOSS?",
      "Como está a saúde do robô?",
    ];
    answers.push(...questions.map((q) => answerFromPerformanceContext(ctx, q)));
  }

  if (advisor) {
    const advisorQuestions = [
      "O que devo melhorar?",
      "Qual estratégia devo usar?",
      "Vale a pena operar agora?",
      "Existe algum alerta?",
      "O que está reduzindo minha taxa de acerto?",
      "Qual mercado estou operando?",
    ];
    answers.push(...advisorQuestions.map((q) => answerFromAdvisorContext(advisor, q, marketCtx)));
  }

  if (lifecycleCtx) {
    const lifecycleQuestions = [
      "Em que estágio da estratégia estamos?",
      "Qual o próximo passo?",
      "Quantas estratégias estão ativas?",
      "Qual o histórico de estados?",
    ];
    answers.push(...lifecycleQuestions.map((q) => answerFromLifecycleContext(lifecycleCtx, q)));
  }

  if (learningCtx) {
    const learningQuestions = [
      "Qual estratégia apresenta maior taxa de acerto?",
      "Qual sessão está performando melhor?",
      "Qual Core está gerando mais lucro?",
      "Qual indicador mais contribuiu para os WINs?",
      "Quais filtros mais evitaram LOSS?",
      "Qual ativo possui maior taxa de acerto?",
    ];
    answers.push(...learningQuestions.map((q) => answerFromLearningContext(learningCtx, q)));
  }

  if (confidenceCtx) {
    const confidenceQuestions = [
      "Qual é o nível de confiança?",
      "Por que a confiança foi esse valor?",
      "Qual categoria reduziu o score?",
      "O que falta para atingir nível Elite?",
    ];
    answers.push(...confidenceQuestions.map((q) => answerFromConfidenceContext(confidenceCtx, q)));
  }

  return answers;
}
