/**
 * HybridProbabilityCore — Full configuration for HYBRID_PROBABILITY market.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * Contains profiles, score weights, and advisor rules for HYBRID_PROBABILITY.
 * Based exclusively on statistical analysis (no technical indicators).
 */

import type { CoreMarketProfile } from "../types/market-profile.types";
import { HYBRID_PROBABILITY_PROFILE } from "./hybrid-probability-profile";

export const HYBRID_PROBABILITY_CORE: CoreMarketProfile = {
  id: "hybrid-probability-core",
  name: "HYBRID PROBABILITY CORE",
  market: "HYBRID_PROBABILITY",
  description: "Core para seleção baseada em probabilidade estatística — 2 Candle Continuation, purely statistical (sem EMAs, RSI, ATR, Order Blocks, FVGs, Supply/Demand, Smart Money).",

  profiles: [
    HYBRID_PROBABILITY_PROFILE,
  ],

  scoreWeights: {
    // Sequência de cores (principal)
    colorSequence: 100,
  },

  advisorRules: [], // Rules are managed internally in the advisor module
};