/**
 * Forex Breakout Profile — Breakout strategies for FOREX.
 *
 * Strategies: London Breakout, NY Reversal, Range Breakout.
 * Explicit indicators and filters for this profile only.
 */

import type { CoreProfile } from "../../types/market-profile.types";
import { FOREX_STRUCTURE_INDICATORS } from "./indicators/structure.indicators";
import { FOREX_SMARTMONEY_INDICATORS } from "./indicators/smartmoney.indicators";
import { FOREX_MOMENTUM_INDICATORS } from "./indicators/momentum.indicators";
import { FOREX_SESSION_INDICATORS } from "./indicators/session.indicators";
import { FOREX_SUPPLYDEMAND_INDICATORS } from "./indicators/supplydemand.indicators";
import { FOREX_FILTERS } from "./filters";

// Breakout Profile uses only these specific indicators
const BREAKOUT_PROFILE_INDICATORS = [
  ...FOREX_STRUCTURE_INDICATORS.filter(i => ["bos", "choch"].includes(i.id)),
  ...FOREX_SMARTMONEY_INDICATORS.filter(i => ["liquidity-sweep", "order-block"].includes(i.id)),
  ...FOREX_MOMENTUM_INDICATORS.filter(i => ["atr"].includes(i.id)),
  ...FOREX_SESSION_INDICATORS,
  ...FOREX_SUPPLYDEMAND_INDICATORS,
];

// Breakout Profile uses only these specific filters
const BREAKOUT_PROFILE_FILTERS = FOREX_FILTERS.filter(f =>
  ["trend-h4", "trend-h1", "entry-m15", "entry-m5", "break-valid", "atr-min", "liquidity-before", "confirmation-candle", "min-confluence"].includes(f.id)
);

export const FOREX_BREAKOUT_PROFILE: CoreProfile = {
  id: "forex-breakout",
  name: "Breakout Profile",
  description: "Estratégias de rompimento para FOREX — foco em BOS, Supply/Demand, Sessões.",

  indicators: BREAKOUT_PROFILE_INDICATORS,
  filters: BREAKOUT_PROFILE_FILTERS,

  strategies: [
    {
      id: "london-breakout",
      name: "London Breakout",
      description: "Rompimento da range da sessão asiática durante Londres",
      priority: 1,
      indicators: [
        "bos", "choch", "supply-zone", "demand-zone",
        "atr", "session-asia", "session-london",
        "liquidity-sweep", "order-block",
      ],
      filters: [
        "trend-h4", "trend-h1", "entry-m15", "entry-m5",
        "break-valid", "atr-min", "liquidity-before",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 15,
        structure: 30,
        smartMoney: 20,
        momentum: 10,
        session: 20,
        continuity: 5,
      },
      minScore: 68,
      entryRules: [
        { condition: "Range da sessão asiática definida", description: "Máxima e mínima da Ásia identificadas", required: true },
        { condition: "Sessão Londres ativa", description: "Entrada durante Londres (08:00-17:00 GMT)", required: true },
        { condition: "Rompimento com BOS", description: "Preço rompeu a range com confirmação de estrutura", required: true },
        { condition: "Volume acima da média", description: "Rompimento com participação", required: false },
        { condition: "ATR >= mínimo", description: "Volatilidade suficiente para o movimento", required: false },
      ],
      exitRules: [
        { condition: "Alcançou 1x ATR da entrada", description: "Target baseado em volatilidade", required: false },
        { condition: "Perda de momentum", description: "RSI voltou ao neutro", required: false },
        { condition: "Preço voltou para a range", description: "Falso rompimento", required: false },
      ],
      advisorRules: ["session-active", "breakout-valid"],
    },
    {
      id: "ny-reversal",
      name: "NY Reversal",
      description: "Reversão durante a sessão Nova York após sobrecompra/sobrevenda",
      priority: 2,
      indicators: [
        "rsi", "bos", "choch", "order-block",
        "supply-zone", "demand-zone", "session-newyork",
        "fvg", "liquidity-sweep",
      ],
      filters: [
        "trend-h4", "entry-m15", "entry-m5",
        "pullback", "ema-distance", "liquidity-before",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 10,
        structure: 25,
        smartMoney: 25,
        momentum: 20,
        session: 15,
        continuity: 5,
      },
      minScore: 70,
      entryRules: [
        { condition: "Sessão Nova York ativa", description: "Entrada durante NY (13:00-22:00 GMT)", required: true },
        { condition: "RSI em sobrecompra (>70) ou sobrevenda (<30)", description: "Momentum extremo para reversão", required: true },
        { condition: "CHoCH de reversão", description: "Caráter do mercado mudou", required: true },
        { condition: "Liquidez capturada acima/abaixo", description: "Sweep antes da reversão", required: false },
      ],
      exitRules: [
        { condition: "Alcançou zona oposta (Supply/Demand)", description: "Target na zona contrária", required: false },
        { condition: "RSI voltou ao neutro", description: "Momentum normalizou", required: false },
      ],
      advisorRules: ["session-active", "reversal-zone"],
    },
    {
      id: "range-breakout",
      name: "Range Breakout",
      description: "Rompimento de lateralização com confirmação de estrutura",
      priority: 3,
      indicators: [
        "bos", "choch", "supply-zone", "demand-zone",
        "atr", "order-block", "fvg",
        "liquidity-sweep",
      ],
      filters: [
        "trend-h4", "entry-m15", "entry-m5",
        "break-valid", "atr-min", "liquidity-before",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 10,
        structure: 35,
        smartMoney: 25,
        momentum: 15,
        session: 10,
        continuity: 5,
      },
      minScore: 72,
      entryRules: [
        { condition: "Mercado em lateralização", description: "Range definida por mínimo de 4 horas", required: true },
        { condition: "Rompimento com BOS", description: "Estrutura quebrada na direção do rompimento", required: true },
        { condition: "Liquidez capturada antes do rompimento", description: "Sweep de stops nas bordas da range", required: false },
      ],
      exitRules: [
        { condition: "Alcançou 2x ATR da range", description: "Target baseado no tamanho da range", required: false },
        { condition: "Preço voltou para a range", description: "Falso rompimento", required: false },
      ],
      advisorRules: ["range-defined", "breakout-valid"],
    },
  ],
};
