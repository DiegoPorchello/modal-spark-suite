/**
 * session.types.ts
 * Tipos da entidade test_sessions — cada sessão representa
 * uma rodada completa de forward testing em conta DEMO.
 */

export interface TestSession {
  id: string;
  name: string;
  description: string | null;

  initial_balance: number;
  final_balance: number | null;
  currency: string;

  total_operations: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;

  net_profit: number | null;
  max_drawdown: number | null;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  recovery_factor: number | null;

  best_asset: string | null;
  best_timeframe: string | null;
  best_hour: number | null;
  best_pattern: string | null;
  avg_score: number | null;

  strategy: string;
  base_entry: number;
  max_level: number;
  stop_loss: number | null;
  target_profit: number | null;

  status: SessionStatus;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = "running" | "paused" | "completed" | "stopped" | "error";

export interface CreateSessionInput {
  name: string;
  description?: string;
  initial_balance: number;
  strategy?: string;
  base_entry?: number;
  max_level?: number;
  stop_loss?: number;
  target_profit?: number;
}
