/**
 * DecisionContext interface - the single source of truth for trading decisions.
 *
 * The DecisionContext contains all information needed to understand why every
 * trading decision was made, providing comprehensive explanation for:
 * - Why an operation was approved
 * - Why an operation was rejected
 * - Which filters participated
 * - Which market conditions existed
 * - Which strategy was active
 * - Which execution trigger fired
 *
 * This is the interface used by NEXOR AI and the dashboard to explain all
 * trading decisions.
 */

export interface DecisionFilter {
  /** Filter identifier - unique ID */
  id: string;

  /** Human-readable filter name */
  name: string;

  /** Filter weight/importance in decision making */
  weight: number;

  /** Contribution to final score (points earned from this filter) */
  contribution: number;

  /** Whether filter passed (approved) */
  approved: boolean;

  /** Detailed reason for approval/rejection */
  reason: string;
}

export interface DecisionContext {
  /** Unique decision identifier */
  id: string;

  /** When the decision was made */
  timestamp: number;

  /** Asset being analyzed */
  asset: string;

  /** Analysis timeframe */
  timeframe: string;

  /** Market type (FOREX, CRYPTO, HYBRID, COMMODITIES) */
  marketType: string;

  /** Strategy being used */
  strategyId: string;

  /** Human-readable strategy name */
  strategyName: string;

  /** Final score achieved */
  finalScore: number;

  /** Minimum score required to proceed */
  minimumScore: number;

  /** Trading decision made */
  decision: "CALL" | "PUT" | "WAIT" | "REJECT";

  /** Human-readable explanation of why this decision was made */
  decisionReason: string;

  /** Filters that approved this decision */
  approvedFilters: DecisionFilter[];

  /** Filters that rejected this decision */
  rejectedFilters: DecisionFilter[];

  /** Filters still pending */
  pendingFilters: DecisionFilter[];

  /** What triggered the execution to happen */
  executionTrigger: string;

  /** Decision confidence (0-1) */
  confidence: number;

  /** Current market trend */
  trend: string;

  /** Current market volatility */
  volatility: string;

  /** Market bias */
  bias: string;
}

/**
 * Builder options for creating DecisionContext from real engine data.
 */
export interface DecisionContextOptions {
  asset: string;
  timeframe: string;
  marketType: string;
  strategyId: string;
  strategyName: string;
  minimumScore: number;
}
