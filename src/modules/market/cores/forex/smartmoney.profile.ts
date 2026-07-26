/**
 * Forex Smart Money Profile — Institutional strategies for FOREX.
 *
 * Strategies: Order Block Entry, Liquidity Sweep, FVG Continuation.
 * Explicit indicators and filters for this profile only.
 */

import type { CoreProfile } from "../../types/market-profile.types";
import { FOREX_STRUCTURE_INDICATORS } from "./indicators/structure.indicators";
import { FOREX_SMARTMONEY_INDICATORS } from "./indicators/smartmoney.indicators";
import { FOREX_MOMENTUM_INDICATORS } from "./indicators/momentum.indicators";
import { FOREX_SUPPLYDEMAND_INDICATORS } from "./indicators/supplydemand.indicators";
import { FOREX_TREND_INDICATORS } from "./indicators/trend.indicators";
import { FOREX_FILTERS } from "./filters";

// SmartMoney Profile uses only these specific indicators
const SMARTMONEY_PROFILE_INDICATORS = [
  ...FOREX_SMARTMONEY_INDICATORS,
  ...FOREX_STRUCTURE_INDICATORS.filter(i => ["bos", "choch"].includes(i.id)),
  ...FOREX_SUPPLYDEMAND_INDICATORS,
  ...FOREX_MOMENTUM_INDICATORS,
  ...FOREX_TREND_INDICATORS.filter(i => ["ema-200"].includes(i.id)),
];

// SmartMoney Profile uses only these specific filters
const SMARTMONEY_PROFILE_FILTERS = FOREX_FILTERS.filter(f =>
  ["trend-h4", "trend-h1", "entry-m15", "entry-m5", "pullback", "liquidity-before", "break-valid", "atr-min", "confirmation-candle", "min-confluence"].includes(f.id)
);

export const FOREX_SMARTMONEY_PROFILE: CoreProfile = {
  id: "forex-smartmoney",
  name: "Smart Money Profile",
  description: "Estratégias institucionais para FOREX — foco em Order Block, FVG, Liquidez.",

  indicators: SMARTMONEY_PROFILE_INDICATORS,
  filters: SMARTMONEY_PROFILE_FILTERS,

  strategies: [
    {
      id: "order-block-entry",
      name: "Order Block Entry",
      description: "Entrada em Order Block com confirmação de estrutura",
      priority: 1,
      indicators: [
        "order-block", "bos", "choch", "fvg",
        "liquidity-sweep", "rsi", "ema-200",
        "supply-zone", "demand-zone",
      ],
      filters: [
        "trend-h4", "trend-h1", "entry-m15", "entry-m5",
        "pullback", "liquidity-before",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 15,
        structure: 25,
        smartMoney: 35,
        momentum: 15,
        session: 5,
        continuity: 5,
      },
      minScore: 75,
      entryRules: [
        { condition: "Order Block identificado", description: "Zona institucional de acumulação/distribuição", required: true },
        { condition: "Preço retornou ao Order Block", description: "Pullback para a zona", required: true },
        { condition: "BOS de confirmação", description: "Estrutura quebrada na direção do OB", required: true },
        { condition: "Liquidez capturada antes do OB", description: "Sweep de stops na zona", required: false },
        { condition: "RSI confirmando momentum", description: "RSI na direção esperada", required: false },
      ],
      exitRules: [
        { condition: "Alcançou próximo OB oposto", description: "Target no próximo zona institucional", required: false },
        { condition: "FVG preenchido", description: "Gap de valor justo foi fechado", required: false },
        { condition: "CHoCH de reversão", description: "Caráter do mercado mudou", required: false },
      ],
      advisorRules: ["smart-money-active", "ob-confirmed"],
    },
    {
      id: "liquidity-sweep-entry",
      name: "Liquidity Sweep Entry",
      description: "Entrada após captura de liquidez com confirmação de estrutura",
      priority: 2,
      indicators: [
        "liquidity-sweep", "bos", "choch", "order-block",
        "fvg", "rsi", "atr",
        "supply-zone", "demand-zone",
      ],
      filters: [
        "trend-h4", "trend-h1", "entry-m15", "entry-m5",
        "liquidity-before", "break-valid", "atr-min",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 10,
        structure: 25,
        smartMoney: 40,
        momentum: 15,
        session: 5,
        continuity: 5,
      },
      minScore: 73,
      entryRules: [
        { condition: "Liquidez capturada", description: "Sweep de stops acima/abaixo de nível importante", required: true },
        { condition: "BOS ou CHoCH de reversão", description: "Estrutura confirmou reversão após sweep", required: true },
        { condition: "Order Block de reversão", description: "Zona institucional formada após sweep", required: false },
      ],
      exitRules: [
        { condition: "Alcançou zona oposta de liquidez", description: "Target na próxima zona de stops", required: false },
        { condition: "Novo sweep na direção oposta", description: "Liquidez capturada no sentido contrario", required: false },
      ],
      advisorRules: ["liquidity-swept", "reversal-confirmed"],
    },
    {
      id: "fvg-continuation",
      name: "FVG Continuation",
      description: "Continuação de tendência preenchendo Fair Value Gap",
      priority: 3,
      indicators: [
        "fvg", "bos", "ema-20", "ema-50", "adx",
        "order-block", "rsi", "atr",
      ],
      filters: [
        "trend-h4", "trend-h1", "entry-m15", "entry-m5",
        "break-valid", "ema-distance", "atr-min",
        "confirmation-candle", "min-confluence",
      ],
      scoreWeights: {
        trend: 20,
        structure: 25,
        smartMoney: 30,
        momentum: 15,
        session: 5,
        continuity: 5,
      },
      minScore: 72,
      entryRules: [
        { condition: "FVG identificado na direção da tendência", description: "Gap de valor justo alinhado com tendência", required: true },
        { condition: "Tendência confirmada (EMA + ADX)", description: "EMA alinhadas e ADX > 25", required: true },
        { condition: "Preço retornou para o FVG", description: "Pullback preenchendo o gap", required: true },
      ],
      exitRules: [
        { condition: "FVG totalmente preenchido", description: "Gap fechado — momentum pode enfraquecer", required: false },
        { condition: "Alcançou próximo nível S/R", description: "Target atingido", required: false },
      ],
      advisorRules: ["fvg-active", "trend-strong"],
    },
  ],
};
