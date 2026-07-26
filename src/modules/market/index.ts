/**
 * market/index.ts
 * Módulo Adaptive Market Core — entrada principal.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * Responsabilidade: Gerenciar múltiplos cores de mercado (FOREX, HYBRID)
 * com profiles, estratégias, scores e advisors separados.
 *
 * O Market Core é a ÚNICA camada que contém lógica específica de mercado.
 * O resto da aplicação recebe um Core já resolvido.
 *
 * Submódulos:
 *   types/       → MarketMode, MarketProfile, CoreMarketProfile, ScoreProfile, AdvisorProfile
 *   cores/       → ForexCore, HybridCore, CoreLoader, Profiles, Scores, Advisors
 *   classifier/  → MarketClassifier (AUTO mode)
 *   components/  → MarketProfileCard (UI)
 */

export type {
  MarketMode,
  MarketType,
  CoreId,
  MarketProfile,
  CoreMarketProfile,
  CoreProfile,
  CoreIndicator,
  CoreFilter,
  CoreStrategy,
  CoreScoreWeights,
  CoreAdvisorRule,
  ScoreProfile,
  AdvisorProfile,
  AdvisorTemplate,
  StrategyRule,
} from "./types";

export {
  FOREX_CORE,
  HYBRID_CORE,
  HYBRID_PROBABILITY_CORE,
  loadCore,
  getCoreById,
  getScoreProfile,
  getAdvisorProfile,
  getAllCores,
  getProfilesForCore,
  getProfile,
  FOREX_TREND_PROFILE,
  FOREX_BREAKOUT_PROFILE,
  FOREX_SMARTMONEY_PROFILE,
  HYBRID_CONTINUITY_PROFILE,
  HYBRID_MOMENTUM_PROFILE,
  FOREX_SCORE,
  HYBRID_SCORE,
  FOREX_ADVISOR,
  HYBRID_ADVISOR,
} from "./cores";

export { HYBRID_PROBABILITY_SCORE } from "./cores/score/hybrid-probability.score";
export { HYBRID_PROBABILITY_ADVISOR } from "./cores/advisor/hybrid-probability.advisor";

export { classifyMarket } from "./classifier";
export { MarketProfileCard } from "./components";
