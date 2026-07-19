/**
 * DecisionContext types - duplicate placeholder (deprecated).
 * Use decision-context.types.ts instead.
 */

export interface DecisionFilter {
  id: string;
  name: string;
  weight: number;
  contribution: number;
  approved: boolean;
  reason: string;
}

export interface DecisionContext {
  id: string;
  timestamp: number;
  asset: string;
  timeframe: string;
  marketType: string;
  strategyId: string;
  strategyName: string;
  finalScore: number;
  minimumScore: number;
  decision: "CALL" | "PUT" | "WAIT" | "REJECT";
  decisionReason: string;
  approvedFilters: DecisionFilter[];
  rejectedFilters: DecisionFilter[];
  pendingFilters: DecisionFilter[];
  executionTrigger: string;
  confidence: number;
  trend: string;
  volatility: string;
  bias: string;
}
