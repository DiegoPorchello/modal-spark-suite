/**
 * HybridCore — Full configuration for HYBRID market.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * Contains profiles, score weights, and advisor rules for HYBRID.
 */

import type { CoreMarketProfile } from "../types/market-profile.types";
import { HYBRID_CONTINUITY_PROFILE, HYBRID_MOMENTUM_PROFILE } from "./hybrid";

export const HYBRID_CORE: CoreMarketProfile = {
  id: "hybrid-core",
  name: "HYBRID CORE",
  market: "HYBRID",
  description: "Core para mercados sintéticos, criptomoedas e multi-ativo com foco em continuidade e momentum.",

  profiles: [
    HYBRID_CONTINUITY_PROFILE,
    HYBRID_MOMENTUM_PROFILE,
  ],

  scoreWeights: {
    continuidade: 25,
    dominancia: 20,
    candleStrength: 15,
    liquidezSintetica: 12,
    emaShort: 10,
    microStructure: 15,
    volatility: 8,
    volume: 10,
  },

  advisorRules: [
    { id: "hybrid-volatility-alert", condition: "ATR acima do normal", recommendation: "Alta volatilidade — reduza posição", priority: "HIGH" },
    { id: "hybrid-continuity-strong", condition: "Continuidade > 80%", recommendation: "Fluxo forte — mantenha posição", priority: "LOW" },
    { id: "hybrid-dominance-shift", condition: "Mudança de dominância", recommendation: "Possível reversão — prepare stops", priority: "MEDIUM" },
  ],
};
