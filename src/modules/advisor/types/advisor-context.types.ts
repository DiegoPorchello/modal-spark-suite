/**
 * AdvisorContext types — the intelligence layer that interprets
 * PerformanceContext and generates recommendations, alerts, and opportunities.
 *
 * The Advisor NEVER executes trades, recalculates scores, or makes decisions.
 * It ONLY observes, interprets, and recommends. The decision to enter an operation
 * remains the responsibility of DecisionContext and ExecutionEngine.
 */

import type { RobotHealthScore } from "../../performance/types/performance-context.types";

export interface AdvisorContext {
  generatedAt: number;
  overallStatus: "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL";
  recommendations: AdvisorRecommendation[];
  alerts: AdvisorAlert[];
  opportunities: AdvisorOpportunity[];
  robotHealth: RobotHealthScore;
}

export interface AdvisorRecommendation {
  id: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  reason: string;
  basedOn: string[];
}

export interface AdvisorAlert {
  id: string;
  severity: "INFO" | "WARNING" | "DANGER";
  title: string;
  description: string;
}

export interface AdvisorOpportunity {
  id: string;
  title: string;
  expectedImpact: string;
  description: string;
}

export interface AdvisorFeedEntry {
  id: string;
  timestamp: number;
  type: "recommendation" | "alert" | "opportunity";
  title: string;
  description: string;
  priority: string;
}
