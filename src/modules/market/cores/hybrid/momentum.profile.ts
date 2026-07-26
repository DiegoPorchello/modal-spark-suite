/**
 * Hybrid Momentum Profile — Momentum and volatility strategies for HYBRID.
 *
 * Strategies: Hybrid Momentum, Liquidity Hybrid, Reversal Hybrid.
 */

import type { CoreProfile } from "../../types/market-profile.types";

export const HYBRID_MOMENTUM_PROFILE: CoreProfile = {
  id: "hybrid-momentum",
  name: "Momentum Profile",
  description: "Estratégias de momentum para HYBRID — volatilidade, liquidez sintética, reversão.",

  indicators: [
    { id: "ema-9", name: "EMA 9", category: "trend", description: "Média móvel de 9 períodos", maxPoints: 10, defaultParams: { period: 9 } },
    { id: "ema-21", name: "EMA 21", category: "trend", description: "Média móvel de 21 períodos", maxPoints: 8, defaultParams: { period: 21 } },
    { id: "atr-curto", name: "ATR Curto", category: "momentum", description: "ATR de curto prazo", maxPoints: 8, defaultParams: { period: 7 } },
    { id: "candle-strength", name: "Candle Strength", category: "momentum", description: "Força do candle", maxPoints: 15, defaultParams: { minBodyRatio: 0.5 } },
    { id: "liquidez-sintetica", name: "Liquidez Sintética", category: "volume", description: "Liquidez derivada de-volume", maxPoints: 12, defaultParams: { lookback: 20 } },
    { id: "micro-choch", name: "Micro CHoCH", category: "structure", description: "Change of Character micro", maxPoints: 10, defaultParams: { lookback: 10 } },
  ],

  filters: [
    { id: "ema-alignment", name: "Alinhamento EMA 9/21", description: "EMA 9 acima/abaixo da EMA 21", weight: 18, category: "trend" },
    { id: "candle-strength-filter", name: "Filtro de Força", description: "Candle com corpo forte", weight: 15, category: "momentum" },
    { id: "volatility-filter", name: "Filtro de Volatilidade", description: "ATR dentro da faixa ideal", weight: 12, category: "momentum" },
    { id: "dominance-filter", name: "Filtro de Dominância", description: "Corpo > 60%", weight: 20, category: "continuity" },
  ],

  strategies: [
    {
      id: "hybrid-momentum",
      name: "Hybrid Momentum",
      description: "Momentum com EMA curta e volatilidade",
      priority: 1,
      indicators: ["ema-9", "ema-21", "atr-curto", "candle-strength"],
      filters: ["ema-alignment", "candle-strength-filter", "volatility-filter"],
      scoreWeights: { continuity: 20, dominance: 20, structure: 20, momentum: 40 },
      minScore: 70,
      entryRules: [
        { condition: "EMA 9 > EMA 21 (compra)", description: "Alinhamento de momentum", required: true },
        { condition: "Candle strength > 60%", description: "Candle com força", required: true },
        { condition: "ATR dentro da faixa", description: "Volatilidade adequada", required: false },
      ],
      exitRules: [
        { condition: "EMA cross bearish", description: "EMA 9 cruzou EMA 21 para baixo", required: false },
        { condition: "Candle strength < 40%", description: "Força do candle enfraqueceu", required: false },
      ],
      advisorRules: ["momentum-strong", "volatility-ideal"],
    },
    {
      id: "liquidity-hybrid",
      name: "Liquidity Hybrid",
      description: "Liquidez sintética com confirmação de fluxo",
      priority: 2,
      indicators: ["liquidez-sintetica", "continuidade", "micro-bos", "dominancia"],
      filters: ["continuity-filter", "dominance-filter", "volatility-filter"],
      scoreWeights: { continuity: 30, dominance: 25, structure: 25, momentum: 20 },
      minScore: 68,
      entryRules: [
        { condition: "Liquidez sintética alta", description: "Volume e pressão confirmam", required: true },
        { condition: "Continuidade presente", description: "Pelo menos 2 velas na direção", required: true },
        { condition: "Micro BOS confirmado", description: "Estrutura micro quebrou", required: false },
      ],
      exitRules: [
        { condition: "Liquidez caiu", description: "Volume e pressão enfraqueceram", required: false },
        { condition: "Perda de continuidade", description: "Vela oposta quebrou sequência", required: false },
      ],
      advisorRules: ["liquidity-high", "flow-confirmed"],
    },
    {
      id: "reversal-hybrid",
      name: "Reversal Hybrid",
      description: "Reversão com CHoCH micro e mudança de dominância",
      priority: 3,
      indicators: ["micro-choch", "dominancia", "candle-strength", "ema-9"],
      filters: ["micro-structure-filter", "dominance-filter", "candle-strength-filter"],
      scoreWeights: { continuity: 15, dominance: 30, structure: 35, momentum: 20 },
      minScore: 65,
      entryRules: [
        { condition: "Micro CHoCH detectado", description: "Mudança de character micro", required: true },
        { condition: "Dominância mudou", description: "Corpo do candle inverteu direção", required: true },
        { condition: "Candle força confirma", description: "Candle forte na nova direção", required: false },
      ],
      exitRules: [
        { condition: "CHoCH oposto", description: "Nova mudança de character", required: false },
        { condition: "Dominância perdeu", description: "Corpo do candle enfraqueceu", required: false },
      ],
      advisorRules: ["reversal-detected", "dominance-shift"],
    },
  ],
};
