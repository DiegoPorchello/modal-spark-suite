/**
 * DecisionContextBuilder - Creates DecisionContext from real engine outputs.
 *
 * Pure utility function — no DI, no decorators. Takes DecisionResult
 * from DecisionEngine.analyze() and strategy profile info, returns
 * a fully populated DecisionContext.
 */

import type { DecisionResult } from "../../../engine/decision/DecisionEngine";
import type { ScoreFilterItem } from "../../../engine/decision/ScoreEngine";
import { StrategyManager } from "../../../services/strategy-manager";
import type {
  DecisionContext,
  DecisionFilter,
} from "../types/decision-context.types";

let _decisionCounter = 0;

function generateDecisionId(): string {
  _decisionCounter++;
  return `dc_${Date.now()}_${_decisionCounter}`;
}

function generateFilterId(name: string): string {
  return `f_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

/**
 * Convert a ScoreEngine ScoreFilterItem to a DecisionFilter.
 */
function toDecisionFilter(
  f: ScoreFilterItem,
  passed: boolean,
): DecisionFilter {
  const weight = f.maxPoints > 0 ? f.maxPoints : 10;
  return {
    id: generateFilterId(f.name),
    name: f.name,
    weight,
    contribution: f.points,
    approved: passed,
    reason: passed
      ? `${f.name}: ${f.points}/${f.maxPoints} — ${f.detail}`
      : `${f.name}: ${f.points}/${f.maxPoints} — ${f.detail}`,
  };
}

/**
 * Determine the trading decision from a DecisionResult.
 */
function resolveDecision(
  result: DecisionResult,
): "CALL" | "PUT" | "WAIT" | "REJECT" {
  if (result.direction === "CALL") return "CALL";
  if (result.direction === "PUT") return "PUT";
  if (result.blockedRule === "LOW_SCORE" || result.blockedRule === "SIDEWAYS_MARKET") {
    return "REJECT";
  }
  return "WAIT";
}

/**
 * Build a human-readable decision reason.
 */
function buildDecisionReason(
  decision: "CALL" | "PUT" | "WAIT" | "REJECT",
  result: DecisionResult,
): string {
  const score = result.scoreBreakdown.total;
  const band = result.scoreBreakdown.bandLabel;
  const filters = result.scoreBreakdown.filters;
  const passedCount = filters.filter((f) => f.points > 0 && f.maxPoints > 0).length;
  const totalCount = filters.filter((f) => f.maxPoints > 0).length;

  switch (decision) {
    case "CALL":
    case "PUT":
      return result.scoreBreakdown.entryReason
        ?? `Score ${score}/100 (${band}) — ${decision} direction, ${passedCount}/${totalCount} filters contributing`;
    case "REJECT":
      return result.blockedReason
        ?? `Score ${score}/100 — below minimum threshold, ${passedCount}/${totalCount} filters contributing`;
    case "WAIT":
      return result.blockedReason
        ?? `Score ${score}/100 — waiting for better conditions`;
    default:
      return "Unknown decision";
  }
}

/**
 * Build execution trigger description.
 */
function buildExecutionTrigger(
  decision: "CALL" | "PUT" | "WAIT" | "REJECT",
  result: DecisionResult,
): string {
  switch (decision) {
    case "CALL":
    case "PUT":
      return `Trade initiated — ${decision} confirmed (score ${result.scoreBreakdown.total}/100)`;
    case "WAIT":
      return `Awaiting market conditions — ${result.blockedReason ?? "score or filters not ready"}`;
    case "REJECT":
      return `Blocked — ${result.blockedRule ?? "threshold not met"}`;
    default:
      return "No action";
  }
}

/**
 * Calculate decision confidence based on filter consistency.
 */
function calculateConfidence(
  result: DecisionResult,
  decision: "CALL" | "PUT" | "WAIT" | "REJECT",
): number {
  const filters = result.scoreBreakdown.filters.filter((f) => f.maxPoints > 0);
  if (filters.length === 0) return 0;

  if (decision === "CALL" || decision === "PUT") {
    const passedCount = filters.filter((f) => f.points > 0).length;
    const avgContribution =
      filters.reduce((sum, f) => sum + (f.points / f.maxPoints), 0) / filters.length;
    // Confidence = blend of filter consistency and average contribution
    return Math.min(1, (passedCount / filters.length) * 0.6 + avgContribution * 0.4);
  }

  // WAIT or REJECT
  const totalScore = result.scoreBreakdown.total;
  if (decision === "REJECT") {
    // More rejected = higher confidence it's the right call to reject
    return Math.min(1, 0.5 + (100 - totalScore) / 200);
  }
  return 0.4; // Low confidence for WAIT
}

/**
 * Build a complete DecisionContext from a DecisionResult.
 *
 * This is the main entry point. Call this after DecisionEngine.analyze()
 * to get a comprehensive explanation of the trading decision.
 */
export function buildDecisionContext(
  result: DecisionResult,
  options?: {
    timeframe?: string;
    marketType?: string;
  },
): DecisionContext {
  const strategyManager = StrategyManager.getInstance();
  const strategy = strategyManager.getActiveProfile();

  const timeframe = options?.timeframe ?? "M1";
  const marketType = options?.marketType ?? "FOREX";

  const decision = resolveDecision(result);

  // Separate filters into approved/rejected
  const approvedFilters: DecisionFilter[] = [];
  const rejectedFilters: DecisionFilter[] = [];

  for (const f of result.scoreBreakdown.filters) {
    if (f.maxPoints === 0) continue; // Skip penalties with no max
    const passed = f.points > 0;
    const df = toDecisionFilter(f, passed);
    if (passed) {
      approvedFilters.push(df);
    } else {
      rejectedFilters.push(df);
    }
  }

  // Market condition labels
  const trendDir = result.trend.direction;
  const trendLabel =
    trendDir === "UPTREND" ? "Bullish" :
    trendDir === "DOWNTREND" ? "Bearish" : "Sideways";

  const volPercent = result.momentum.atrPercent;
  const volatilityLabel =
    volPercent >= 0.7 ? "High" :
    volPercent >= 0.4 ? "Medium" : "Low";

  const macdTrend = result.momentum.macdTrend;
  const biasLabel =
    macdTrend === "bullish" ? "Bullish" :
    macdTrend === "bearish" ? "Bearish" : "Neutral";

  return {
    id: generateDecisionId(),
    timestamp: Date.now(),
    asset: result.asset,
    timeframe,
    marketType,
    strategyId: strategy.id,
    strategyName: strategy.name,
    finalScore: result.scoreBreakdown.total,
    minimumScore: strategy.thresholds.minScore,
    decision,
    decisionReason: buildDecisionReason(decision, result),
    approvedFilters,
    rejectedFilters,
    pendingFilters: [],
    executionTrigger: buildExecutionTrigger(decision, result),
    confidence: calculateConfidence(result, decision),
    trend: trendLabel,
    volatility: volatilityLabel,
    bias: biasLabel,
  };
}
