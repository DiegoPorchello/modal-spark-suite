/**
 * MarketProfile — the resolved state after CoreLoader processes the MarketMode.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * Contains the detected market, confidence level, and which core is active.
 * This is the single source of truth for the rest of the application.
 */

import type { MarketMode, MarketType, CoreId } from "./market-mode.types";

// ══════════════════════════════════════════════════════════════════════════
// CONFIDENCE LEVELS
// ══════════════════════════════════════════════════════════════════════════

export enum ConfidenceLevel {
  LOW = "LOW",
  MODERATE = "MODERATE",
  GOOD = "GOOD",
  HIGH = "HIGH",
  ELITE = "ELITE",
}

export interface ConfidenceProfile {
  level: ConfidenceLevel;
  score: number;
  label: string;
  color: string;
  recommendation: string;
}

export interface ConfidenceBreakdown {
  trend: number;
  structure: number;
  smartMoney: number;
  supplyDemand: number;
  momentum: number;
  session: number;
  confluence: number;
  total: number;
}

export const CONFIDENCE_PROFILES: Record<ConfidenceLevel, ConfidenceProfile> = {
  [ConfidenceLevel.ELITE]: {
    level: ConfidenceLevel.ELITE,
    score: 95,
    label: "Elite",
    color: "text-success",
    recommendation: "Entrada altamente recomendada",
  },
  [ConfidenceLevel.HIGH]: {
    level: ConfidenceLevel.HIGH,
    score: 85,
    label: "Alta",
    color: "text-success",
    recommendation: "Entrada recomendada",
  },
  [ConfidenceLevel.GOOD]: {
    level: ConfidenceLevel.GOOD,
    score: 75,
    label: "Boa",
    color: "text-info",
    recommendation: "Operar com atenção",
  },
  [ConfidenceLevel.MODERATE]: {
    level: ConfidenceLevel.MODERATE,
    score: 65,
    label: "Moderada",
    color: "text-warning",
    recommendation: "Aguardar mais confirmações",
  },
  [ConfidenceLevel.LOW]: {
    level: ConfidenceLevel.LOW,
    score: 50,
    label: "Baixa",
    color: "text-danger",
    recommendation: "Não operar",
  },
};

/**
 * Map a numeric score (0-100) to a ConfidenceLevel.
 */
export function scoreToConfidence(score: number): ConfidenceProfile {
  if (score >= 90) return CONFIDENCE_PROFILES[ConfidenceLevel.ELITE];
  if (score >= 80) return CONFIDENCE_PROFILES[ConfidenceLevel.HIGH];
  if (score >= 70) return CONFIDENCE_PROFILES[ConfidenceLevel.GOOD];
  if (score >= 60) return CONFIDENCE_PROFILES[ConfidenceLevel.MODERATE];
  return CONFIDENCE_PROFILES[ConfidenceLevel.LOW];
}

// ══════════════════════════════════════════════════════════════════════════
// MARKET PROFILE
// ══════════════════════════════════════════════════════════════════════════

export interface MarketProfile {
  /** The operator's selected mode */
  mode: MarketMode;
  /** The detected/resolved market type */
  detectedMarket: MarketType;
  /** Confidence level for AUTO detection (0-100). Always 100 for manual modes. */
  confidence: number;
  /** The active core identifier */
  activeCore: CoreId;
  /** The active profile within the core */
  activeProfileId: string;
  /** Human-readable profile name */
  activeProfileName: string;
  /** The active strategy within the profile */
  activeStrategyId: string;
  /** Human-readable strategy name */
  activeStrategyName: string;
  /** Timestamp of last profile change */
  changedAt: number;
}

/**
 * CoreMarketProfile — the full configuration for a market core.
 * Contains everything the robot needs to operate in a specific market.
 */
export interface CoreMarketProfile {
  id: CoreId;
  name: string;
  market: MarketType;
  description: string;

  /** Which profiles this core supports */
  profiles: CoreProfile[];
  /** Score weights for this core */
  scoreWeights: CoreScoreWeights;
  /** Advisor rules specific to this market */
  advisorRules: CoreAdvisorRule[];
}

/**
 * CoreProfile — a group of related strategies within a core.
 * Example: "Trend Profile" groups Trend Continuation, Pullback Pro, etc.
 */
export interface CoreProfile {
  id: string;
  name: string;
  description: string;
  /** Which indicators this profile uses */
  indicators: CoreIndicator[];
  /** Which filters this profile uses */
  filters: CoreFilter[];
  /** Strategies in this profile */
  strategies: CoreStrategy[];
}

export interface CoreIndicator {
  id: string;
  name: string;
  category: "trend" | "structure" | "momentum" | "volume" | "session" | "continuity";
  description: string;
  maxPoints: number;
  defaultParams: Record<string, number>;
}

export interface CoreFilter {
  id: string;
  name: string;
  description: string;
  weight: number;
  category: string;
}

/**
 * CoreStrategy — full strategy definition with entry/exit rules.
 */
export interface CoreStrategy {
  id: string;
  name: string;
  description: string;
  priority: number;
  indicators: string[];
  filters: string[];
  scoreWeights: Record<string, number>;
  minScore: number;
  entryRules: StrategyRule[];
  exitRules: StrategyRule[];
  advisorRules: string[];
}

export interface StrategyRule {
  condition: string;
  description: string;
  required: boolean;
}

export interface CoreScoreWeights {
  [key: string]: number;
}

export interface CoreAdvisorRule {
  id: string;
  condition: string;
  recommendation: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * ScoreProfile — weights and thresholds for scoring in a specific market.
 */
export interface ScoreProfile {
  id: string;
  name: string;
  weights: Record<string, number>;
  thresholds: {
    minScore: number;
    minProbability: number;
    minFiltersPassed: number;
  };
  penalties: Record<string, number>;
}

/**
 * AdvisorProfile — text generation rules for a specific market.
 */
export interface AdvisorProfile {
  id: string;
  name: string;
  templates: AdvisorTemplate[];
}

export interface AdvisorTemplate {
  id: string;
  condition: string;
  text: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
