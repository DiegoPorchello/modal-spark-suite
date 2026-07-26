/**
 * Forex Score Profile — scoring weights and thresholds for FOREX.
 *
 * Updated with normalized weights (total = 100%):
 * - Tendência: 20%
 * - Estrutura: 18%
 * - Smart Money: 20%
 * - Supply/Demand: 10%
 * - Momentum: 10%
 * - Sessão: 7%
 * - Confluência: 15%
 */

import type { ScoreProfile } from "../../types/market-profile.types";

export const FOREX_SCORE: ScoreProfile = {
  id: "forex-score",
  name: "Forex Score",
  weights: {
    // Tendência (20%)
    tendencia: 8,
    ema_alignment: 7,
    adx_strength: 5,

    // Estrutura (18%)
    bos: 7,
    choch: 6,
    hh_hl_lh_ll: 5,

    // Smart Money (20%)
    orderBlock: 8,
    fvg: 5,
    liquiditySweep: 5,
    breakerBlock: 2,

    // Supply/Demand (10%)
    supplyZone: 5,
    demandZone: 5,

    // Momentum (10%)
    rsi: 6,
    atr: 4,

    // Sessão (7%)
    session: 4,
    sessionLiqidez: 3,

    // Confluência (15%)
    pullback: 5,
    retracao: 3,
    forcaVela: 3,
    continuidade: 2,
    novaAltaBaixa: 1,
    volume: 1,
    padraoCandle: 0,
  },
  thresholds: {
    minScore: 70,
    minProbability: 70,
    minFiltersPassed: 4,
  },
  penalties: {
    doji: -10,
    insideBar: -5,
    distantEMA: -8,
    lowVolatility: -10,
    wrongSession: -7,
  },
};
