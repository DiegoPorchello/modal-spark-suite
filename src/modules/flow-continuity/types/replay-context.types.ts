import type { DecisionContext } from "./decision-context.types";
import type { OperationContext } from "./operation-context.types";

export type ReplayTimelineStep =
  | "market.classified"
  | "strategy.selected"
  | "score.calculated"
  | "filters.approved"
  | "decision.made"
  | "order.sent"
  | "broker.confirmed"
  | "trade.opened"
  | "trade.closed";

export interface ReplayTimelineEvent {
  stepIndex: number;
  step: ReplayTimelineStep;
  label: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface ReplayContext {
  /** Unique ID for this replay */
  replayId: string;

  /** Unix timestamp when the operation started (ms) */
  operationStartTime: number;

  /** Unix timestamp when the operation ended (ms) */
  operationEndTime: number;

  /** Duration of the operation in ms */
  durationMs: number;

  /** The original DecisionContext (why the trade happened) */
  decisionContext: DecisionContext;

  /** The original OperationContext (what happened during execution) */
  operationContext: OperationContext;

  /** Auto-generated timeline events in chronological order */
  timeline: ReplayTimelineEvent[];

  /** Total number of timeline steps */
  timelineLength: number;

  /** Execution source: AUTO, MANUAL, or REPLAY */
  executionSource: "AUTO" | "MANUAL" | "REPLAY";

  /** Final outcome: WIN, LOSS, BREAKEVEN, TIMEOUT */
  result: "WIN" | "LOSS" | "BREAKEVEN" | "TIMEOUT";

  /** Profit/loss in account currency */
  profit: number;

  /** Timestamp of this replay */
  createdAt: number;

  /** Optional replay speed hint */
  replaySpeed?: "1x" | "2x" | "5x" | "10x" | "INSTANT";
}
