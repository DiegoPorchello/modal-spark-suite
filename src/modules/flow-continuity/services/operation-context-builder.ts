/**
 * OperationContextBuilder - Creates OperationContext from execution data.
 *
 * Pure utility function — no DI, no React. Takes raw execution data
 * and produces a fully populated OperationContext.
 *
 * Flow: DecisionContext → Execution → OperationContextBuilder → OperationContext
 */

import type { DecisionContext } from "../types/decision-context.types";
import type { OperationContext, ExecutionSource } from "../types/operation-context.types";
import type { EntryRecord } from "../../../engine/execution/types";
import type { StrategyManager } from "../../../services/strategy-manager";

let _operationCounter = 0;

function generateOperationId(): string {
  _operationCounter++;
  return `op_${Date.now()}_${_operationCounter}`;
}

/**
 * Build an OperationContext from execution data.
 *
 * Called after a trade has been executed and its result is known.
 */
export function buildOperationContext(params: {
  decisionContext: DecisionContext;
  entryRecord: EntryRecord;
  brokerTradeId: string;
  direction: "CALL" | "PUT";
  status: "WIN" | "LOSS" | "DRAW" | "CANCELLED";
  entryPrice: number;
  exitPrice: number;
  profit: number;
  amount: number;
  payout: number;
  expiration: number;
  broker: string;
  executionSource: ExecutionSource;
  score: number;
  recoveryLevel: number;
  isRecovery: boolean;
}): OperationContext {
  const {
    decisionContext,
    entryRecord,
    brokerTradeId,
    direction,
    status,
    entryPrice,
    exitPrice,
    profit,
    amount,
    payout,
    expiration,
    broker,
    executionSource,
    score,
    recoveryLevel,
    isRecovery,
  } = params;

  return {
    id: generateOperationId(),
    decisionId: decisionContext.id,
    timestamp: entryRecord.sendTime,
    asset: entryRecord.symbol,
    timeframe: entryRecord.timeframe,
    direction,
    strategyId: decisionContext.strategyId,
    strategyName: decisionContext.strategyName,
    entryPrice,
    exitPrice,
    expiration,
    broker,
    payout,
    amount,
    status,
    profit,
    executionLatency: entryRecord.totalLatency,
    executionTime: entryRecord.confirmationTime - entryRecord.decisionTime,
    brokerTradeId,
    executionReason: buildExecutionReason(status, decisionContext),
    executionSource,
    brokerResponseTime: entryRecord.brokerDelay,
    score,
    confidence: decisionContext.confidence,
    recoveryLevel,
    isRecovery,
    traceId: entryRecord.traceId,
    signalCandleTime: entryRecord.signalCandleTime,
    expectedEntryCandle: entryRecord.expectedEntryCandle,
    actualEntryTime: entryRecord.actualEntryTime,
    candleId: entryRecord.candleId,
  };
}

/**
 * Build a human-readable execution reason.
 */
function buildExecutionReason(
  status: "WIN" | "LOSS" | "DRAW" | "CANCELLED",
  ctx: DecisionContext,
): string {
  switch (status) {
    case "WIN":
      return `Trade WON — ${ctx.decision} at score ${ctx.finalScore}/100, ${ctx.trend} trend, ${ctx.volatility} volatility`;
    case "LOSS":
      return `Trade LOST — ${ctx.decision} at score ${ctx.finalScore}/100, ${ctx.trend} trend, ${ctx.volatility} volatility`;
    case "DRAW":
      return `Trade DRAW — ${ctx.decision} at score ${ctx.finalScore}/100, result neutral`;
    case "CANCELLED":
      return `Trade CANCELLED — ${ctx.decision} at score ${ctx.finalScore}/100, order not confirmed`;
    default:
      return `Trade ${status}`;
  }
}
