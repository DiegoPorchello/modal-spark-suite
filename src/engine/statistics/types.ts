import type { Candle } from "../../market/types";

// ═══════════════════════════════════════════════════════════════════
// PATTERN CATALOG TYPES
// ═══════════════════════════════════════════════════════════════════

export type PatternType =
  | "continuity"
  | "breakout"
  | "lateralization"
  | "reversal"
  | "exhaustion"
  | "consolidation";

export type PatternCategory =
  | "candlestick"
  | "structure"
  | "volume"
  | "momentum"
  | "volatility"
  | "sequence";

export interface PatternDefinition {
  id: string;
  name: string;
  type: PatternType;
  category: PatternCategory;
  description: string;
  detector: (candles: Candle[]) => PatternMatch | null;
}

export interface PatternMatch {
  patternId: string;
  asset: string;
  timeframe: string;
  detected: boolean;
  direction: "CALL" | "PUT" | null;
  strength: number;
  timestamp: number;
}

export interface PatternRecord {
  patternId: string;
  asset: string;
  timeframe: string;
  occurrences: number;
  wins: number;
  losses: number;
  winrate: number;
  lastSeen: number;
  createdAt: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// PROBABILITY DATABASE TYPES
// ═══════════════════════════════════════════════════════════════════

export type ConfidenceLevel = "alta" | "media" | "baixa";

export interface StatisticalEntry {
  patternId: string;
  asset: string;
  timeframe: string;
  winRate: number;
  occurrences: number;
  confidence: ConfidenceLevel;
  version: number;
  lastUpdate: number;
  createdAt: number;
  wins: number;
  losses: number;
  avgStrength: number;
  directionBreakdown: {
    call: { occurrences: number; winrate: number };
    put: { occurrences: number; winrate: number };
  };
}

export interface StatisticalDatabase {
  version: number;
  entries: Map<string, StatisticalEntry>;
  lastGlobalUpdate: number;
  totalPatterns: number;
}

// ═══════════════════════════════════════════════════════════════════
// SCORE TYPES
// ═══════════════════════════════════════════════════════════════════

export interface TechnicalScore {
  total: number;
  breakdown: {
    trend: number;
    structure: number;
    priceAction: number;
    smartMoney: number;
    momentum: number;
  };
  classification: string;
}

export interface ProbabilityScore {
  total: number;
  breakdown: {
    winRate: number;
    occurrences: number;
    confidence: ConfidenceLevel;
    patternWinrate: number;
    overallWinrate: number;
  };
  weight: number;
}

export interface DecisionScore {
  total: number;
  technical: TechnicalScore;
  probability: ProbabilityScore;
  formula: string;
  classification: string;
}
