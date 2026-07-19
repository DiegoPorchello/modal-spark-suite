/**
 * PerformanceContext types - the single source of truth for operational intelligence.
 *
 * The PerformanceContext is derived exclusively from:
 *   DecisionContext + OperationContext + ReplayContext
 *
 * It NEVER executes trades, recalculates scores, or makes decisions.
 * It ONLY measures, ranks, and generates insights from historical data.
 */

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  netProfit: number;
  averageScore: number;
  averageConfidence: number;
  profitFactor: number;
}

export interface AssetPerformance {
  asset: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  averageScore: number;
}

export interface HourPerformance {
  hour: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
}

export interface TrendPerformance {
  trend: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
}

export interface FilterPerformance {
  filterName: string;
  totalApprovals: number;
  totalRejections: number;
  approvalWinRate: number;
  rejectionWinRate: number;
  averageContribution: number;
}

export interface RecentTrade {
  id: string;
  timestamp: number;
  asset: string;
  direction: "CALL" | "PUT";
  strategyName: string;
  score: number;
  result: "WIN" | "LOSS" | "BREAKEVEN";
  profit: number;
  durationMs: number;
}

export type PerformanceInsightSeverity =
  | "SUCCESS"
  | "INFO"
  | "WARNING"
  | "DANGER";

export type PerformanceInsightCategory =
  | "strategy"
  | "asset"
  | "time"
  | "filter"
  | "streak"
  | "general"
  | "health"
  | "trend";

export interface PerformanceInsight {
  id: string;
  type: "positive" | "negative" | "neutral" | "warning";
  severity: PerformanceInsightSeverity;
  category: PerformanceInsightCategory;
  title: string;
  description: string;
  text: string;
  metric?: number;
  timestamp: number;
}

export interface RobotHealthScore {
  score: number;
  label: string;
  color: string;
  breakdown: {
    winRate: number;
    profitFactor: number;
    latency: number;
    lossStreak: number;
    consistency: number;
  };
}

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  label: string;
}

export interface HeatmapData {
  title: string;
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
}

export interface PerformanceTrend {
  label: string;
  current: number;
  previous7d: number;
  previous30d: number;
  direction: "up" | "down" | "stable";
}

export interface PerformanceSnapshot {
  timestamp: number;
  winRate: number;
  profitFactor: number;
  netProfit: number;
  averageScore: number;
  averageConfidence: number;
  averageLatency: number;
  totalTrades: number;
  healthScore: number;
}

export interface PerformanceContext {
  /** When this performance snapshot was generated */
  generatedAt: number;

  // ── Core Metrics ──
  totalTrades: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;

  // ── Financial ──
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  roi: number;
  profitFactor: number;
  expectancy: number;

  // ── Averages ──
  averageScore: number;
  averageConfidence: number;
  averageLatency: number;
  averagePayout: number;
  averageDuration: number;

  // ── Best Performing ──
  bestStrategy: string;
  bestAsset: string;
  bestHour: number;
  bestTrend: string;

  // ── Streaks ──
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;

  // ── Robot Health ──
  robotHealth: RobotHealthScore;

  // ── Trends ──
  trends: PerformanceTrend[];

  // ── Heatmaps ──
  heatmaps: {
    hourStrategy: HeatmapData;
    assetHour: HeatmapData;
    dayWeek: HeatmapData;
  };

  // ── Breakdowns ──
  byStrategy: StrategyPerformance[];
  byAsset: AssetPerformance[];
  byHour: HourPerformance[];
  byTrend: TrendPerformance[];
  byFilter: FilterPerformance[];

  // ── Recent Trades ──
  recentTrades: RecentTrade[];

  // ── Insights ──
  insights: PerformanceInsight[];
}
