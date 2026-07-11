/**
 * engine/types.ts
 * Tipos do módulo Engine — sinais e resultados de análise.
 */

import type { ScoreResult, ScoreClassification } from "./score-calculator";
import type { ContinuityResult } from "./continuity-detector";
import type { SRAnalysis } from "./support-resistance";
import type { LateralizationResult } from "./lateralization";
import type { CandleStrengthResult } from "./candle-strength";
import type { Timeframe } from "../market/types";

export interface EngineSignal {
  asset: string;
  timeframe: Timeframe;
  direction: "CALL" | "PUT";
  score: ScoreResult;
  continuity: ContinuityResult;
  candleStrength: CandleStrengthResult;
  srAnalysis: SRAnalysis;
  lateralization: LateralizationResult;
  dominance: number;
  historyWinrate: number;
  entryPrice: number;
  timestamp: number;
  blocked: boolean;
  blockReason: string | null;
}

export interface EngineConfig {
  minScore: number;
  maxAssets: number;
  loopIntervalMs: number;
  riskPerTrade: number;
  maxConcurrentTrades: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  minScore: 80,
  maxAssets: 10,
  loopIntervalMs: 5000,
  riskPerTrade: 0.02,
  maxConcurrentTrades: 1,
};
