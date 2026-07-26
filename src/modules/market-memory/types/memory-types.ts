/**
 * Market Memory Types
 *
 * Defines the record structure for all executed operations.
 * Generic — works for any Core/Profile/Strategy combination.
 */

export type OperationResult = "WIN" | "LOSS" | "BREAK_EVEN" | "PENDING";

export interface MarketMemoryRecord {
  id: string;

  // Identification
  asset: string;
  market: string;                // "FOREX" | "HYBRID" | "CRYPTO"
  core: string;                  // "forex-core" | "hybrid-core"
  profile: string;               // "forex-trend" | "hybrid-momentum"
  strategy: string;              // "trend-continuation"
  strategyName: string;          // "Trend Continuation"

  // Score & Confidence
  score: number;
  confidence: number;

  // Context
  session: string;               // "London" | "New York" | etc.
  trend: string;                 // "BULLISH" | "BEARISH" | "LATERAL"
  volatility: string;            // "LOW" | "MEDIUM" | "HIGH"
  direction: "CALL" | "PUT";

  // Timing
  entryTime: string;             // ISO or HH:mm:ss
  exitTime?: string;
  entryTimestamp: number;
  exitTimestamp?: number;
  expiration?: string;           // "M5" | "M15" | etc.

  // Price
  entryPrice: number;
  exitPrice?: number;

  // Result
  result: OperationResult;
  profit?: number;               // in points or currency
  pnl?: number;                  // net profit/loss

  // Intelligence
  advisorMessage?: string;
  filters: string[];             // ["Trend OK", "ATR OK", etc.]
  indicators: Record<string, unknown>;  // { EMA20: true, ADX: 31, RSI: 58 }
  lifecycleTimeline?: Array<{
    state: string;
    time: string;
    duration?: number;
  }>;

  // Learning fields
  decisionReason?: string;       // why this entry was taken
  rejectedReasons?: string[];    // why other signals were rejected
  learningTags?: string[];       // tags for categorization (e.g. "strong-confluence", "weak-confirmation")
  optimizationHints?: string[];  // hints for optimizer (e.g. "low-vol-better", "session-mismatch")

  // Metadata
  recordedAt: number;
  updatedAt: number;
}

export interface MarketMemoryStats {
  totalOperations: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  avgScore: number;
  avgConfidence: number;
  avgProfit: number;
  byStrategy: Record<string, { count: number; winRate: number }>;
  byCore: Record<string, { count: number; winRate: number }>;
  byProfile: Record<string, { count: number; winRate: number }>;
  bySession: Record<string, { count: number; winRate: number }>;
  byResult: Record<OperationResult, number>;
}

export interface MemoryRecordEvent {
  type: "memory.record.created" | "memory.record.updated";
  recordId: string;
  asset: string;
  strategy: string;
  result?: OperationResult;
  timestamp: number;
}
