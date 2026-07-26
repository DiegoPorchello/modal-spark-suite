/**
 * engine/index.ts
 * Barrel do módulo Engine.
 */

export {
  analyzeCandle,
  meetsBodyThreshold,
  meetsWickThreshold,
  isStrongCandle,
} from "./candle-analyzer";
export { detectContinuity, detectDominance } from "./continuity-detector";
export { calculateCandleStrength } from "./candle-strength";
export { detectSupportResistance } from "./support-resistance";
export { detectLateralization } from "./lateralization";
export { calculateScore, shouldTrade } from "./score-calculator";
export type { ScoreResult, ScoreInput, ScoreClassification } from "./score-calculator";
export type { ContinuityResult } from "./continuity-detector";
export type { CandleStrengthResult } from "./candle-strength";
export type { SRAnalysis, SRLevel } from "./support-resistance";
export type { LateralizationResult } from "./lateralization";
export type { EngineSignal, EngineConfig } from "./types";
export { DEFAULT_ENGINE_CONFIG } from "./types";
export { Logger, engineLogger } from "./logger";
export type { LogEntry, LogLevel } from "./logger";
export { CandleContinuityEngine } from "./candle-continuity-engine";
export type {
  CandleContinuityResult,
  CandleContinuityState,
  FilterCheck,
} from "./candle-continuity-engine";
