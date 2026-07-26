/**
 * Forex Trend Profile — Trend-following strategies for FOREX.
 *
 * Strategies: Trend Continuation, Pullback Pro.
 * Explicit indicators and filters for this profile only.
 */

import type { CoreProfile } from "../../types/market-profile.types";
import { FOREX_TREND_INDICATORS } from "./indicators/trend.indicators";
import { FOREX_STRUCTURE_INDICATORS } from "./indicators/structure.indicators";
import { FOREX_MOMENTUM_INDICATORS } from "./indicators/momentum.indicators";
import { FOREX_SESSION_INDICATORS } from "./indicators/session.indicators";
import { FOREX_FILTERS } from "./filters";

// Trend Profile uses only these specific indicators
const TREND_PROFILE_INDICATORS = [
  ...FOREX_TREND_INDICATORS,
  ...FOREX_STRUCTURE_INDICATORS.filter(i => ["bos", "hh-hl-lh-ll"].includes(i.id)),
  ...FOREX_MOMENTUM_INDICATORS,
  ...FOREX_SESSION_INDICATORS.filter(i => ["session-london", "session-newyork"].includes(i.id)),
];

// Trend Profile uses only these specific filters
const TREND_PROFILE_FILTERS = FOREX_FILTERS.filter(f =>
  ["trend-h4", "trend-h1", "pullback", "atr-min", "ema-distance", "confirmation-candle", "min-confluence"].includes(f.id)
);

export const FOREX_TREND_PROFILE: CoreProfile = {
  id: "forex-trend",
  name: "Trend Profile",
  description: "Estratégias de tendência para FOREX — foco em EMA, ADX, BOS, CHoCH.",

  indicators: TREND_PROFILE_INDICATORS,
  filters: TREND_PROFILE_FILTERS,

  strategies: [
    {
      id: "trend-continuation",
      name: "Trend Continuation",
      description: "Continuação de tendência com confirmação de estrutura multi-timeframe",
      priority: 1,
      indicators: [
        "ema-20", "ema-50", "ema-200", "adx",
        "bos", "hh-hl-lh-ll",
        "rsi", "atr",
        "session-london", "session-newyork",
      ],
      filters: [
        "trend-h4", "trend-h1",
        "pullback", "ema-distance", "atr-min",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        tendencia: 25,
        structure: 25,
        smartMoney: 15,
        momentum: 15,
        session: 10,
        continuity: 10,
      },
      minScore: 70,
      entryRules: [
        { condition: "Tendência H4 e H1 alinhadas", description: "H4 e H1 na mesma direção", required: true },
        { condition: "EMA 20 > EMA 50 > EMA 200 (ou inverso)", description: "EMAs alinhadas na direção da tendência", required: true },
        { condition: "ADX > 25", description: "Tendência com força confirmada", required: true },
        { condition: "BOS confirmado", description: "Estrutura quebrada na direção da tendência", required: true },
        { condition: "Preço em pullback para EMA", description: "Entrada em zona de valor", required: false },
        { condition: "RSI não em sobrecompra/sobrevenda", description: "RSI entre 30-70", required: false },
        { condition: "Sessão Londres ou Nova York ativa", description: "Maior liquidez disponível", required: false },
      ],
      exitRules: [
        { condition: "EMA cross (20 e 50)", description: "EMAs cruzaram na direção oposta", required: false },
        { condition: "ADX < 20", description: "Tendência enfraquecendo", required: false },
      ],
      advisorRules: ["trend-strong", "adx-confirmed", "session-active"],
    },
    {
      id: "pullback-pro",
      name: "Pullback Pro",
      description: "Entrada em pullback com confirmação de zona e momentum",
      priority: 2,
      indicators: [
        "ema-50", "ema-200", "rsi", "bos",
        "atr", "hh-hl-lh-ll",
      ],
      filters: [
        "trend-h4", "trend-h1",
        "pullback", "ema-distance", "atr-min",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 20,
        structure: 30,
        smartMoney: 20,
        momentum: 20,
        session: 5,
        continuity: 5,
      },
      minScore: 72,
      entryRules: [
        { condition: "Pullback até EMA 50/200", description: "Preço reagiu à zona de suporte/resistência", required: true },
        { condition: "RSI em zona de reversão (30-40 ou 60-70)", description: "Momentum confirmando reversão do pullback", required: true },
        { condition: "BOS de confirmação", description: "Estrutura confirmou reversão do pullback", required: true },
      ],
      exitRules: [
        { condition: "Alcançou próximo nível S/R", description: "Target atingido", required: false },
        { condition: "Perda de momentum (RSI volta ao neutro)", description: "Momentum enfraquecendo", required: false },
      ],
      advisorRules: ["pullback-zone", "rsi-reversal"],
    },
  ],
};
