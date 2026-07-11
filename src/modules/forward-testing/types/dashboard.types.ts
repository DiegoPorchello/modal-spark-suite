/**
 * dashboard.types.ts
 * Tipos para o dashboard de performance em tempo real.
 */

export interface DailyReport {
  day: string;
  total_operations: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  net_profit: number;
  avg_score: number;
  assets_traded: number;
  active_sessions: number;
}

export interface AssetRanking {
  asset: string;
  total_ops: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_profit: number;
  avg_score: number;
  days_traded: number;
  last_trade_at: string;
}

export interface HourlyPerformance {
  hour: number;
  total_ops: number;
  wins: number;
  win_rate: number;
  total_profit: number;
  avg_score: number;
}

export interface BestTimeframe {
  timeframe: string;
  total_ops: number;
  wins: number;
  win_rate: number;
  total_profit: number;
  avg_score: number;
}

export interface DashboardSummary {
  activeSessions: number;
  totalOperations: number;
  globalWinRate: number;
  totalProfit: number;
  bestAsset: string | null;
  bestTimeframe: string | null;
  bestHour: number | null;
  todayReport: DailyReport | null;
}
