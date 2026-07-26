/**
 * OperationContext types - the single source of truth for executed operations.
 *
 * The OperationContext records the complete lifecycle of a trade:
 * from the DecisionContext that triggered it, through execution,
 * to the final result. It never makes decisions — it only records.
 */

export type OperationStatus =
  | "PENDING"
  | "OPEN"
  | "WIN"
  | "LOSS"
  | "DRAW"
  | "CANCELLED";

export type ExecutionSource = "AUTO" | "MANUAL" | "REPLAY";

export interface OperationContext {
  /** Unique operation identifier */
  id: string;

  /** Link to the DecisionContext that triggered this operation */
  decisionId: string;

  /** When the operation was created */
  timestamp: number;

  /** Asset traded */
  asset: string;

  /** Timeframe used for analysis */
  timeframe: string;

  /** Trade direction */
  direction: "CALL" | "PUT";

  /** Strategy used */
  strategyId: string;

  /** Human-readable strategy name */
  strategyName: string;

  /** Price at entry */
  entryPrice: number;

  /** Price at exit (0 if still open) */
  exitPrice: number;

  /** Trade expiration in seconds */
  expiration: number;

  /** Broker identifier */
  broker: string;

  /** Payout percentage (e.g. 0.86 = 86%) */
  payout: number;

  /** Trade amount */
  amount: number;

  /** Current status */
  status: OperationStatus;

  /** Profit/loss (negative on loss) */
  profit: number;

  /** Execution latency in ms (candle open → order sent) */
  executionLatency: number;

  /** Total execution time in ms (decision → confirmation) */
  executionTime: number;

  /** Broker-assigned trade ID */
  brokerTradeId: string;

  /** Human-readable description of what triggered execution */
  executionReason: string;

  /** Source of the trade */
  executionSource: ExecutionSource;

  /** Time the broker took to confirm (send → confirm) */
  brokerResponseTime: number;

  /** Score at time of decision */
  score: number;

  /** Decision confidence (0-1) */
  confidence: number;

  /** Smart Recovery level */
  recoveryLevel: number;

  /** Whether this was a recovery trade */
  isRecovery: boolean;

  /** Trace ID for correlation across the full flow */
  traceId: string;

  /** Signal candle time (when the analysis was performed) */
  signalCandleTime: number;

  /** Expected entry candle (signalCandleTime + 60000) */
  expectedEntryCandle: number;

  /** Actual entry time (when the order was sent) */
  actualEntryTime: number;

  /** Candle ID for correlation */
  candleId: string;
}
