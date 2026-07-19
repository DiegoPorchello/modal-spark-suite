/**
 * NEXOR AIO Copilot — Performance-based answer generation.
 *
 * All answers are derived exclusively from PerformanceContext and AdvisorContext.
 * No business logic calculations are performed here.
 * This is a pure data transformation layer.
 */

import type { PerformanceContext } from "../performance/types/performance-context.types";
import type { AdvisorContext } from "../advisor/types/advisor-context.types";

export interface CopilotAnswer {
  question: string;
  answer: string;
  severity: "SUCCESS" | "INFO" | "WARNING" | "DANGER";
  metric?: number;
}

/**
 * Answer questions using exclusively AdvisorContext data.
 * Responses are derived from Advisor recommendations, alerts, and opportunities.
 */
export function answerFromAdvisorContext(
  advisor: AdvisorContext | null,
  question: string,
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

  return {
    question,
    answer: `Perguntas suportadas: o que devo melhorar, qual estratégia usar, vale a pena operar, alertas, o que reduz taxa de acerto, status geral.`,
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
 * Generate all possible copilot answers for display in the Insights panel.
 */
export function generateAllCopilotAnswers(
  ctx: PerformanceContext | null,
  advisor?: AdvisorContext | null,
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
    ];
    answers.push(...advisorQuestions.map((q) => answerFromAdvisorContext(advisor, q)));
  }

  return answers;
}
