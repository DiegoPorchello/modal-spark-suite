import { OperationProfile } from "./operation-profile";

export interface ProfileCandleConfig {
  /** Mínimo de candles fechados para análise. */
  minCandles: number;
  /** Quantidade a buscar do broker. */
  fetchSize: number;
}

export const PROFILE_CANDLE_CONFIG: Record<OperationProfile, ProfileCandleConfig> = {
  [OperationProfile.AUTO]: { minCandles: 70, fetchSize: 200 },
  [OperationProfile.FOREX]: { minCandles: 100, fetchSize: 200 },
  [OperationProfile.HYBRID_FLOW]: { minCandles: 150, fetchSize: 300 },
  [OperationProfile.HYBRID_PROBABILITY]: { minCandles: 200, fetchSize: 2000 },
};

export function getProfileCandleConfig(profile: OperationProfile): ProfileCandleConfig {
  return PROFILE_CANDLE_CONFIG[profile] ?? PROFILE_CANDLE_CONFIG[OperationProfile.AUTO];
}
