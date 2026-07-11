/**
 * database/types.ts
 * Tipos do módulo Database.
 */

export interface DatabaseClient {
  saveOperation(data: OperationRecord): Promise<void>;
  saveSession(data: SessionRecord): Promise<void>;
  updateSession(sessionId: string, data: Partial<SessionRecord>): Promise<void>;
  savePatternStats(data: PatternStatsRecord): Promise<void>;
  getOperations(filter?: OperationFilter): Promise<OperationRecord[]>;
  getDashboard(): Promise<DashboardData>;
}

export interface OperationRecord {
  id?: string;
  session_id?: string;
  asset: string;
  timeframe: string;
  direction: "CALL" | "PUT";
  amount: number;
  entry_price: number;
  exit_price?: number;
  result: "WIN" | "LOSS" | "DRAW" | "PENDING";
  profit: number;
  score: number;
  score_continuity: number;
  score_dominance: number;
  score_strength: number;
  score_structure: number;
  score_history: number;
  classification: string;
  strategy: string;
  pattern: string;
  block_reason?: string | null;
  created_at?: string;
}

export interface SessionRecord {
  id?: string;
  initial_balance: number;
  current_balance: number;
  total_operations: number;
  wins: number;
  losses: number;
  draws: number;
  status: "active" | "paused" | "stopped";
  config_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PatternStatsRecord {
  id?: string;
  asset: string;
  timeframe: string;
  direction: "CALL" | "PUT";
  pattern: string;
  total_trades: number;
  wins: number;
  losses: number;
  updated_at?: string;
}

export interface OperationFilter {
  asset?: string;
  timeframe?: string;
  result?: string;
  limit?: number;
  offset?: number;
}

export interface DashboardData {
  totalTrades: number;
  wins: number;
  losses: number;
  winrate: number;
  netProfit: number;
  bestAsset: string;
  bestTimeframe: string;
  bestHour: number;
  balance: number;
}
