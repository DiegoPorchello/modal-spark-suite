/**
 * ForexCore — Full configuration for FOREX market.
 *
 * Hierarchy: Market → Core → Profile → Strategy → Score → Advisor
 *
 * Contains profiles, score weights, and advisor rules for FOREX.
 * Updated with normalized score weights (total = 100%).
 */

import type { CoreMarketProfile } from "../types/market-profile.types";
import { FOREX_TREND_PROFILE, FOREX_BREAKOUT_PROFILE, FOREX_SMARTMONEY_PROFILE } from "./forex";

export const FOREX_CORE: CoreMarketProfile = {
  id: "forex-core",
  name: "FOREX CORE",
  market: "FOREX",
  description: "Core completo para FOREX — EMA, ADX, BOS, CHoCH, Order Block, FVG, Liquidez, Sessões.",

  profiles: [
    FOREX_TREND_PROFILE,
    FOREX_BREAKOUT_PROFILE,
    FOREX_SMARTMONEY_PROFILE,
  ],

  scoreWeights: {
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

  advisorRules: [
    // Sessões
    { id: "forex-session-active", condition: "Londres ou Nova York ativa", recommendation: "Melhor horário para operar — maior liquidez", priority: "LOW" },
    { id: "forex-session-asia", condition: "Sessão Ásia ativa", recommendation: "Mercado lateral — evite rompimentos", priority: "MEDIUM" },
    { id: "forex-session-closed", condition: "Nenhuma sessão ativa", recommendation: "Mercado fechado — não opere", priority: "CRITICAL" },

    // Tendência
    { id: "forex-trend-strong", condition: "ADX > 25 e EMAs alinhadas", recommendation: "Tendência forte — opere na direção", priority: "LOW" },
    { id: "forex-adx-low", condition: "ADX < 20", recommendation: "Mercado lateral — reduza exposição", priority: "MEDIUM" },
    { id: "forex-ema-cross", condition: "EMA 20 cruzou EMA 50", recommendation: "Possível mudança de tendência — aguarde confirmação", priority: "MEDIUM" },

    // Smart Money
    { id: "forex-ob-active", condition: "Order Block identificado e preço retornando", recommendation: "Zona institucional ativa — entrada potencial", priority: "LOW" },
    { id: "forex-fvg-active", condition: "Fair Value Gap identificado", recommendation: "Gap de valor justo — preenchimento pendente", priority: "LOW" },
    { id: "forex-liquidity-sweep", condition: "Liquidez capturada acima/abaixo", recommendation: "Reversão potencial após captura de liquidez", priority: "MEDIUM" },

    // Risco
    { id: "forex-rsi-extreme", condition: "RSI > 70 ou RSI < 30", recommendation: "Zona extrema — cuidado com reversão", priority: "MEDIUM" },
    { id: "forex-low-volatility", condition: "ATR abaixo da média", recommendation: "Baixa volatilidade — alvos menores", priority: "MEDIUM" },
  ],
};
