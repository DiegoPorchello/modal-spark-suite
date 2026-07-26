/**
 * CoreLoader — resolves which core to load based on MarketMode.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * RULE: This is the ONLY place where market-specific logic lives.
 *       No other module should contain if (market === "FOREX") checks.
 *
 * Flow:
 *   1. Receive MarketMode from config
 *   2. If FOREX → return ForexCore with profiles
 *   3. If HYBRID → return HybridCore with profiles
 *   4. If AUTO → use MarketClassifier to detect, then load appropriate core
 *
 * Updated with diagnostic logs for debugging.
 */

import type { MarketMode, MarketType, CoreId, OperationProfile } from "../types/market-mode.types";
import type { MarketProfile, CoreMarketProfile, CoreProfile } from "../types/market-profile.types";
import { FOREX_CORE } from "./forex-core";
import { HYBRID_CORE } from "./hybrid-core";
import { HYBRID_PROBABILITY_CORE } from "./hybrid-probability/hybrid-probability-core";
import { classifyMarket } from "../classifier/market-classifier";
import { FOREX_SCORE, HYBRID_SCORE, HYBRID_PROBABILITY_SCORE } from "./score";
import { FOREX_ADVISOR, HYBRID_ADVISOR, HYBRID_PROBABILITY_ADVISOR } from "./advisor";

const CORE_MAP: Record<CoreId, CoreMarketProfile> = {
  "forex-core": FOREX_CORE,
  "hybrid-core": HYBRID_CORE,
  "hybrid-probability-core": HYBRID_PROBABILITY_CORE,
};

const SCORE_MAP: Record<CoreId, any> = {
  "forex-core": FOREX_SCORE,
  "hybrid-core": HYBRID_SCORE,
  "hybrid-probability-core": HYBRID_PROBABILITY_SCORE,
};

const ADVISOR_MAP: Record<CoreId, any> = {
  "forex-core": FOREX_ADVISOR,
  "hybrid-core": HYBRID_ADVISOR,
  "hybrid-probability-core": HYBRID_PROBABILITY_ADVISOR,
};

/**
 * Select the best profile from a core based on the operationProfile.
 * Profiles belong to their Core — the CoreLoader only selects from them.
 */
function selectProfile(core: CoreMarketProfile, operationProfile?: OperationProfile): CoreProfile {
  if (!operationProfile || operationProfile === "AUTO" || core.profiles.length <= 1) {
    return core.profiles[0];
  }

  const profileIdMap: Record<string, string> = {
    "FOREX": "trend",
    "HYBRID_FLOW": "continuity",
    "HYBRID_PROBABILITY": "probability",
  };

  const searchKey = profileIdMap[operationProfile];
  if (searchKey) {
    const found = core.profiles.find((p) => p.id.includes(searchKey));
    if (found) return found;
  }

  return core.profiles[0];
}

/**
 * Load the appropriate core based on MarketMode.
 * For AUTO mode, runs the MarketClassifier first.
 * Includes diagnostic logging for debugging.
 */
export function loadCore(
  mode: MarketMode,
  asset?: string,
  candles?: number[],
  operationProfile?: OperationProfile,
): { profile: MarketProfile; core: CoreMarketProfile; scoreProfile: any; advisorProfile: any } {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  let detectedMarket: MarketType;
  let confidence: number;
  let activeCore: CoreId;

  // When operationProfile is provided, use it for manual selection
  // Otherwise, use MarketMode for backward compatibility
  if (operationProfile) {
    console.log(`[CoreLoader] ${timestamp} 🚀 Iniciando carregamento — OperationProfile: ${operationProfile}, Asset: ${asset ?? "N/A"}`);

    // Map OperationProfile to Core and Profile selection
    switch (operationProfile) {
      case "AUTO":
        console.log(`[CoreLoader] ${timestamp} 🧠 Modo AUTO — executando classificação automática...`);
        const classification = classifyMarket(asset, candles);
        detectedMarket = classification.market;
        confidence = classification.confidence;
        activeCore = detectedMarket === "FOREX" ? "forex-core" : "hybrid-core";
        console.log(`[CoreLoader] ${timestamp} 📊 Classificação: ${detectedMarket} (${confidence}% confiança) — Core: ${activeCore}`);
        break;

      case "FOREX":
        detectedMarket = "FOREX";
        confidence = 100;
        activeCore = "forex-core";
        console.log(`[CoreLoader] ${timestamp} 📊 Modo FOREX selecionado manualmente`);
        break;

      case "HYBRID_FLOW":
        detectedMarket = "HYBRID";
        confidence = 100;
        activeCore = "hybrid-core";
        console.log(`[CoreLoader] ${timestamp} 📊 Modo HYBRID FLOW selecionado manualmente`);
        break;

      case "HYBRID_PROBABILITY":
        detectedMarket = "HYBRID_PROBABILITY";
        confidence = 100;
        activeCore = "hybrid-probability-core";
        console.log(`[CoreLoader] ${timestamp} 📊 Modo HYBRID PROBABILITY selecionado manualmente`);
        break;
    }
  } else {
    // Fallback to MarketMode for backward compatibility
    console.log(`[CoreLoader] ${timestamp} 🚀 Iniciando carregamento — Mode: ${mode}, Asset: ${asset ?? "N/A"}`);

    if (mode === "FOREX") {
      detectedMarket = "FOREX";
      confidence = 100;
      activeCore = "forex-core";
      console.log(`[CoreLoader] ${timestamp} 📊 Modo FOREX selecionado manualmente`);
    } else if (mode === "HYBRID") {
      detectedMarket = "HYBRID";
      confidence = 100;
      activeCore = "hybrid-core";
      console.log(`[CoreLoader] ${timestamp} 📊 Modo HYBRID selecionado manualmente`);
    } else {
      // AUTO mode — classify the market
      console.log(`[CoreLoader] ${timestamp} 🤖 Modo AUTO — executando classificação...`);
      const classification = classifyMarket(asset, candles);
      detectedMarket = classification.market;
      confidence = classification.confidence;
      activeCore = detectedMarket === "FOREX" ? "forex-core" : "hybrid-core";
      console.log(`[CoreLoader] ${timestamp} 📊 Classificação: ${detectedMarket} (${confidence}% confiança) — Core: ${activeCore}`);
    }
  }

  const core = CORE_MAP[activeCore];
  const scoreProfile = SCORE_MAP[activeCore];
  const advisorProfile = ADVISOR_MAP[activeCore];

  const selectedProfile = selectProfile(core, operationProfile);

  const firstStrategy = selectedProfile?.strategies?.[0];

  const profile: MarketProfile = {
    mode: operationProfile as MarketMode || mode,
    detectedMarket,
    confidence,
    activeCore,
    activeProfileId: selectedProfile?.id ?? "",
    activeProfileName: selectedProfile?.name ?? "",
    activeStrategyId: firstStrategy?.id ?? "",
    activeStrategyName: firstStrategy?.name ?? "",
    changedAt: Date.now(),
  };

  console.log(`[CoreLoader] ${timestamp} ✅ Core carregado:`, {
    core: core.name,
    profile: selectedProfile?.name ?? "N/A",
    strategy: firstStrategy?.name ?? "N/A",
    indicators: selectedProfile?.indicators?.length ?? 0,
    filters: selectedProfile?.filters?.length ?? 0,
    operationProfile: operationProfile ?? "AUTO",
  });

  return { profile, core, scoreProfile, advisorProfile };
}

/**
 * Get a core directly by ID (no classification).
 */
export function getCoreById(coreId: CoreId): CoreMarketProfile {
  return CORE_MAP[coreId];
}

/**
 * Get score profile by core ID.
 */
export function getScoreProfile(coreId: CoreId): typeof FOREX_SCORE {
  return SCORE_MAP[coreId];
}

/**
 * Get advisor profile by core ID.
 */
export function getAdvisorProfile(coreId: CoreId): typeof FOREX_ADVISOR {
  return ADVISOR_MAP[coreId];
}

/**
 * Get all available cores.
 */
export function getAllCores(): CoreMarketProfile[] {
  return Object.values(CORE_MAP);
}

/**
 * Get all profiles for a core.
 */
export function getProfilesForCore(coreId: CoreId): CoreProfile[] {
  return CORE_MAP[coreId]?.profiles ?? [];
}

/**
 * Get a specific profile by core and profile ID.
 */
export function getProfile(coreId: CoreId, profileId: string): CoreProfile | undefined {
  return CORE_MAP[coreId]?.profiles.find((p) => p.id === profileId);
}
