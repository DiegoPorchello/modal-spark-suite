/**
 * engine/experiment/types.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Tipos centrais para o framework de experimentos.
 * Cada experimento é uma execução reproduzível do HybridProbabilityEngine
 * com uma configuração específica, comparando resultados.
 */

import type { HybridProbabilityConfig } from "../decision/HybridProbabilityEngine";

// ═══════════════════════════════════════════════════════════════════
// VERSION CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export const EXPERIMENT_FRAMEWORK_VERSION = "1.0.0";

// ═══════════════════════════════════════════════════════════════════
// EXPERIMENT STATUS
// ═══════════════════════════════════════════════════════════════════

export type ExperimentStatus = "created" | "running" | "completed" | "failed" | "cancelled";

// ═══════════════════════════════════════════════════════════════════
// EXPERIMENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export interface ExperimentConfig {
  experimentId: string;
  experimentName: string;
  description: string;

  engineVersion: string;
  databaseVersion: string;
  patternCatalogVersion: string;

  historySize: number;
  probabilityWeight: number;
  asset: string;
  timeframe: string;
  profile: string;

  startDate: string;
  endDate: string;

  engineOverrides: Partial<HybridProbabilityConfig>;
  candleDataPath?: string;
}

// ═══════════════════════════════════════════════════════════════════
// EXPERIMENT METRICS (result of a single experiment run)
// ═══════════════════════════════════════════════════════════════════

export interface ExperimentMetrics {
  totalSignals: number;
  approved: number;
  blocked: number;
  insufficientData: number;
  lowConfidence: number;
  technicalRejection: number;

  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;

  winRate: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;

  profitFactor: number;
  maxDrawdown: number;
  avgProfit: number;
  netProfit: number;

  avgDecisionScore: number;
  avgProbabilityScore: number;
  avgTechnicalScore: number;

  avgProcessingTimeMs: number;

  calibrationScore: number;
  driftScore: number;
}

// ═══════════════════════════════════════════════════════════════════
// EXPERIMENT RESULT
// ═══════════════════════════════════════════════════════════════════

export interface ExperimentResult {
  config: ExperimentConfig;
  status: ExperimentStatus;
  metrics: ExperimentMetrics;
  signalLogPath: string;
  startedAt: number;
  completedAt: number | null;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════
// GRID SEARCH
// ═══════════════════════════════════════════════════════════════════

export interface GridSearchDimension {
  name: string;
  field: keyof HybridProbabilityConfig | "historySize" | "probabilityWeight";
  values: number[];
}

export interface GridSearchConfig {
  name: string;
  description: string;
  asset: string;
  timeframe: string;
  profile: string;
  dimensions: GridSearchDimension[];
  baseHistorySize: number;
  baseProbabilityWeight: number;
  candleDataPath: string;
}

// ═══════════════════════════════════════════════════════════════════
// RANKING
// ═══════════════════════════════════════════════════════════════════

export type RankingSortField =
  | "accuracy"
  | "profitFactor"
  | "maxDrawdown"
  | "f1Score"
  | "calibrationScore"
  | "composite";

export interface RankingEntry {
  rank: number;
  experimentId: string;
  experimentName: string;
  config: Partial<HybridProbabilityConfig>;
  metrics: ExperimentMetrics;
  compositeScore: number;
}

// ═══════════════════════════════════════════════════════════════════
// CALIBRATION REPORT
// ═══════════════════════════════════════════════════════════════════

export interface CalibrationBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  approvedCount: number;
  winCount: number;
  lossCount: number;
  actualWinRate: number;
  expectedWinRate: number;
  delta: number;
}

export interface CalibrationReport {
  experimentId: string;
  buckets: CalibrationBucket[];
  overallCalibrationError: number;
  isCalibrated: boolean;
  alerts: CalibrationAlert[];
}

export interface CalibrationAlert {
  bucket: string;
  expected: number;
  actual: number;
  severity: "info" | "warning" | "critical";
  message: string;
}

// ═══════════════════════════════════════════════════════════════════
// DRIFT ANALYSIS
// ═══════════════════════════════════════════════════════════════════

export interface DriftPoint {
  windowStart: number;
  windowEnd: number;
  signalCount: number;
  approvalRate: number;
  accuracy: number;
  avgDecisionScore: number;
  winRate: number;
}

export interface DriftAnalysis {
  experimentId: string;
  points: DriftPoint[];
  hasDrift: boolean;
  driftMagnitude: number;
  alerts: DriftAlert[];
}

export interface DriftAlert {
  metric: string;
  recentValue: number;
  historicalValue: number;
  change: number;
  severity: "info" | "warning" | "critical";
  message: string;
}

// ═══════════════════════════════════════════════════════════════════
// OPTIMIZATION SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════

export interface OptimizationSuggestion {
  parameter: string;
  currentValue: number;
  suggestedValue: number;
  justification: string;
  expectedImpact: {
    accuracy: number;
    profitFactor: number;
    drawdown: number;
  };
  confidence: "high" | "medium" | "low";
}

export interface OptimizationReport {
  experimentId: string;
  currentMetrics: ExperimentMetrics;
  suggestions: OptimizationSuggestion[];
  generatedAt: number;
}
