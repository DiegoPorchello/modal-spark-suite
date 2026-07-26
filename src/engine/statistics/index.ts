export type {
  PatternType,
  PatternCategory,
  PatternDefinition,
  PatternMatch,
  PatternRecord,
  ConfidenceLevel,
  StatisticalEntry,
  StatisticalDatabase,
  TechnicalScore,
  ProbabilityScore,
  DecisionScore,
} from "./types";

export { PatternCatalogEngine } from "./pattern-catalog";
export { ProbabilityDatabaseService } from "./probability-database";
export { DecisionScoreCalculator } from "./decision-score-calculator";

// PHASE XXIII.5 — Signal Logging & Validation
export {
  SignalLogger,
  JsonlSignalStorage,
  signalLogger,
  ENGINE_VERSION,
  DATABASE_VERSION,
  PATTERN_CATALOG_VERSION,
} from "./signal-log";
export type {
  SignalStatus,
  SignalResult,
  DecisionTreeNode,
  SignalFilterSnapshot,
  SignalLogEntry,
  SignalSummary,
  SignalStorage,
} from "./signal-log";

export { ValidationSummary } from "./validation-summary";
export type {
  ValidationMetrics,
  ClassificationMetrics,
  CalibrationBucket,
  DriftPoint,
  AssetBreakdown,
  TimeframeBreakdown,
  PerformanceMetrics,
} from "./validation-summary";
