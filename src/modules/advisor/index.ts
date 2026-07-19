/**
 * advisor/index.ts
 * Módulo Advisor Intelligence Engine — entrada principal.
 *
 * Responsabilidade: Interpretar o PerformanceContext e gerar
 * recomendações, alertas e oportunidades para o operador.
 *
 * O Advisor NÃO executa operações.
 * O Advisor NÃO altera estratégias.
 * O Advisor NÃO recalcula métricas.
 * Ele apenas observa, interpreta e recomenda.
 *
 * Submódulos:
 *   types/       → AdvisorContext e interfaces derivadas
 *   services/    → buildAdvisorContext (motor puro)
 *   components/  → AdvisorPanel, AdvisorFeed (UI)
 *
 * Consumidores:
 *   Dashboard    → Painel ADVISOR no dashboard principal
 *   NEXOR AI     → Respostas baseadas em AdvisorContext
 *   Feed         → Feed cronológico de recomendações
 */

export type {
  AdvisorContext,
  AdvisorRecommendation,
  AdvisorAlert,
  AdvisorOpportunity,
  AdvisorFeedEntry,
} from "./types";

export { buildAdvisorContext } from "./services";
export { advisorHistory } from "./services/advisor-history";
export { AdvisorPanel, AdvisorFeed } from "./components";
