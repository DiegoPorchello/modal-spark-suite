/**
 * engine/experiment/index.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Barrel exports para o framework de experimentos.
 */

export { EXPERIMENT_FRAMEWORK_VERSION } from "./types";
export type {
  ExperimentStatus,
  ExperimentConfig,
  ExperimentMetrics,
  ExperimentResult,
  GridSearchDimension,
  GridSearchConfig,
  RankingSortField,
  RankingEntry,
  CalibrationBucket,
  CalibrationReport,
  CalibrationAlert,
  DriftPoint,
  DriftAnalysis,
  DriftAlert,
  OptimizationSuggestion,
  OptimizationReport,
} from "./types";

export { ExperimentManager, experimentManager } from "./ExperimentManager";
export { ExperimentRunner } from "./ExperimentRunner";
export { ExperimentComparator } from "./ExperimentComparator";
export { ExperimentRanking } from "./ExperimentRanking";
export { CalibrationAnalyzer } from "./CalibrationReport";
export { DriftAnalyzer } from "./DriftAnalysis";
export { OptimizationEngine } from "./OptimizationEngine";
export { exportToJSON, exportToCSV, exportRankingToCSV } from "./export";
