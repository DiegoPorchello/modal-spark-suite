/**
 * performance/index.ts
 * Módulo Performance Intelligence — entrada principal.
 *
 * Responsabilidade: Transformar os Contexts existentes
 * (DecisionContext, OperationContext, ReplayContext) em métricas,
 * estatísticas, rankings, tendências e insights automáticos.
 *
 * O Performance Intelligence NÃO executa operações.
 * O Performance Intelligence NÃO recalcula Score, Estratégias ou Decisões.
 * Ele apenas consome os três Contexts e produz inteligência operacional.
 *
 * Submódulos:
 *   types/       → PerformanceContext e interfaces derivadas
 *   services/    → buildPerformanceContext (motor puro)
 *
 * Consumidores:
 *   Dashboard    → Visão geral de performance em tempo real
 *   NEXOR AI     → Insights para assistente inteligente
 *   Analytics    → Análises detalhadas e tendências
 *   Rankings     → Ranking de estratégias, ativos, horários
 *   Heatmaps     → Mapas de calor por hora/ativo/tendência
 *   Insights     → Sugestões automáticas baseadas em dados
 */

export type {
  StrategyPerformance,
  AssetPerformance,
  HourPerformance,
  TrendPerformance,
  FilterPerformance,
  RecentTrade,
  PerformanceInsight,
  PerformanceInsightSeverity,
  PerformanceInsightCategory,
  RobotHealthScore,
  HeatmapCell,
  HeatmapData,
  PerformanceTrend,
  PerformanceSnapshot,
  PerformanceContext,
} from "./types";

export { buildPerformanceContext, computeRobotHealthScore, buildSnapshot } from "./services";
export { performanceHistory } from "./services/performance-history";
export { PerformanceIntelligencePanel } from "./components/PerformanceIntelligencePanel";
