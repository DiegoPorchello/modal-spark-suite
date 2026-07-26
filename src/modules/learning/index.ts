/**
 * Learning Engine Module
 *
 * Analyzes Market Memory data to produce insights and recommendations.
 * 100% observational — never modifies strategies.
 */

export type {
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
  OptimizerRecommendation,
  LearningContext,
  LearningEvent,
  InsightCategory,
  InsightSeverity,
} from "./types/learning-types";

export { LearningAnalyzer } from "./learning-analyzer";
export { StrategyOptimizer } from "./optimizer";
export { LearningEngine, getGlobalLearningEngine } from "./learning-engine";
