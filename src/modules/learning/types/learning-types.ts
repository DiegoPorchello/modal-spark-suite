/**
 * Learning Engine Types
 *
 * Defines types for analytics, insights, rankings, and recommendations.
 * 100% observational — never modifies strategies.
 */

export type InsightCategory =
  | "strategy"
  | "core"
  | "profile"
  | "session"
  | "asset"
  | "indicator"
  | "filter"
  | "volatility"
  | "trend"
  | "time";

export type InsightSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LearningInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  confidence: number;       // 0-100
  title: string;
  description: string;
  recommendation: string;
  metric?: number;          // related value (e.g. 84 for 84%)
  trend?: "UP" | "DOWN" | "STABLE";
  createdAt: number;
}

export interface StrategyRanking {
  strategy: string;
  strategyName: string;
  count: number;
  winRate: number;
  lossRate: number;
  breakEvenRate: number;
  avgProfit: number;
  avgScore: number;
  avgConfidence: number;
  drawdown: number;
}

export interface CoreRanking {
  core: string;
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface ProfileRanking {
  profile: string;
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface SessionRanking {
  session: string;
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface AssetRanking {
  asset: string;
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface IndicatorContribution {
  indicator: string;
  totalUses: number;
  winUses: number;
  lossUses: number;
  winRate: number;
  contributionPercent: number;  // % of WINs that used this indicator
}

export interface FilterEffectiveness {
  filter: string;
  totalChecks: number;
  passedWins: number;
  passedLosses: number;
  avoidedLosses: number;        // times filter rejected a potential LOSS
  effectivenessPercent: number;
}

export interface VolatilityStats {
  volatility: string;           // "LOW" | "MEDIUM" | "HIGH"
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface TrendStats {
  trend: string;                // "BULLISH" | "BEARISH" | "LATERAL"
  count: number;
  winRate: number;
  avgProfit: number;
}

export interface LearningAnalytics {
  totalOperations: number;
  overallWinRate: number;
  overallAvgProfit: number;
  strategyRanking: StrategyRanking[];
  coreRanking: CoreRanking[];
  profileRanking: ProfileRanking[];
  sessionRanking: SessionRanking[];
  assetRanking: AssetRanking[];
  indicatorContributions: IndicatorContribution[];
  filterEffectiveness: FilterEffectiveness[];
  volatilityStats: VolatilityStats[];
  trendStats: TrendStats[];
}

export interface OptimizerRecommendation {
  id: string;
  category: "weight" | "filter" | "indicator" | "session" | "strategy" | "profile";
  priority: "LOW" | "MEDIUM" | "HIGH";
  title: string;
  description: string;
  currentWeight?: number;
  suggestedWeight?: number;
  impact: string;               // expected impact description
  confidence: number;           // 0-100
  createdAt: number;
}

export interface LearningContext {
  analytics: LearningAnalytics;
  insights: LearningInsight[];
  recommendations: OptimizerRecommendation[];
  topStrategy: StrategyRanking | null;
  topCore: CoreRanking | null;
  topSession: SessionRanking | null;
  topIndicator: IndicatorContribution | null;
  topFilter: FilterEffectiveness | null;
}

export interface LearningEvent {
  type: "learning.analysis.completed" | "learning.insight.created" | "optimizer.recommendation.created";
  timestamp: number;
  data: Record<string, unknown>;
}
