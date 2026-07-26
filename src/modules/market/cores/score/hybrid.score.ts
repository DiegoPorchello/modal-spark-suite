/**
 * Hybrid Score Profile — scoring weights and thresholds for HYBRID.
 */

import type { ScoreProfile } from "../../types/market-profile.types";

export const HYBRID_SCORE: ScoreProfile = {
  id: "hybrid-score",
  name: "Hybrid Score",
  weights: {
    continuidade: 25,
    dominancia: 20,
    candleStrength: 15,
    liquidezSintetica: 12,
    emaShort: 10,
    microStructure: 15,
    volatility: 8,
    volume: 10,
  },
  thresholds: {
    minScore: 68,
    minProbability: 65,
    minFiltersPassed: 3,
  },
  penalties: {
    doji: -8,
    insideBar: -4,
  },
};
