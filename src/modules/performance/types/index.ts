/**
 * performance/types/index.ts
 * Barrel público do submódulo de tipos do Performance Intelligence.
 *
 * Exporta todas as interfaces derivadas exclusivamente dos
 * DecisionContext, OperationContext e ReplayContext.
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
} from "./performance-context.types";
