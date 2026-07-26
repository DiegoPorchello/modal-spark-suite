/**
 * Hybrid Continuity Profile — Flow and continuity strategies for HYBRID.
 *
 * Strategies: Flow Continuity, Continuation Hybrid.
 */

import type { CoreProfile } from "../../types/market-profile.types";

export const HYBRID_CONTINUITY_PROFILE: CoreProfile = {
  id: "hybrid-continuity",
  name: "Continuity Profile",
  description: "Estratégias de continuidade para HYBRID — fluxo, dominância, micro estrutura.",

  indicators: [
    { id: "continuidade", name: "Continuidade", category: "continuity", description: "Detecção de continuidade de direção", maxPoints: 20, defaultParams: { minConsecutive: 2 } },
    { id: "dominancia", name: "Dominância", category: "continuity", description: "Dominância compradora/vendedora", maxPoints: 15, defaultParams: { minBodyPercent: 60 } },
    { id: "candle-strength", name: "Candle Strength", category: "momentum", description: "Força do candle", maxPoints: 15, defaultParams: { minBodyRatio: 0.5 } },
    { id: "ema-9", name: "EMA 9", category: "trend", description: "Média móvel de 9 períodos", maxPoints: 10, defaultParams: { period: 9 } },
    { id: "ema-21", name: "EMA 21", category: "trend", description: "Média móvel de 21 períodos", maxPoints: 8, defaultParams: { period: 21 } },
    { id: "micro-bos", name: "Micro BOS", category: "structure", description: "Break of Structure micro", maxPoints: 12, defaultParams: { lookback: 10 } },
  ],

  filters: [
    { id: "continuity-filter", name: "Filtro de Continuidade", description: "Pelo menos 2 velas na mesma direção", weight: 25, category: "continuity" },
    { id: "dominance-filter", name: "Filtro de Dominância", description: "Corpo > 60% do range", weight: 20, category: "continuity" },
    { id: "ema-alignment", name: "Alinhamento EMA 9/21", description: "EMA 9 acima/abaixo da EMA 21", weight: 18, category: "trend" },
    { id: "micro-structure-filter", name: "Filtro Micro Estrutura", description: "Micro BOS confirmado", weight: 15, category: "structure" },
  ],

  strategies: [
    {
      id: "flow-continuity",
      name: "Flow Continuity",
      description: "Continuidade de fluxo com dominância e micro estrutura",
      priority: 1,
      indicators: ["continuidade", "dominancia", "micro-bos", "candle-strength"],
      filters: ["continuity-filter", "dominance-filter", "micro-structure-filter"],
      scoreWeights: { continuity: 35, dominance: 25, structure: 25, momentum: 15 },
      minScore: 72,
      entryRules: [
        { condition: "Continuidade > 2 velas", description: "Pelo menos 2 velas na mesma direção", required: true },
        { condition: "Dominância > 60%", description: "Corpo do candle domina o range", required: true },
        { condition: "Micro BOS confirmado", description: "Estrutura micro quebrou", required: true },
      ],
      exitRules: [
        { condition: "Perda de continuidade", description: "Vela oposta quebrou sequência", required: false },
        { condition: "Dominância < 40%", description: "Corpo do candle enfraqueceu", required: false },
      ],
      advisorRules: ["flow-strong", "dominance-confirmed"],
    },
    {
      id: "continuation-hybrid",
      name: "Continuation Hybrid",
      description: "Continuação após pullback com EMA e micro BOS",
      priority: 2,
      indicators: ["ema-9", "ema-21", "micro-bos", "continuidade"],
      filters: ["ema-alignment", "continuity-filter", "micro-structure-filter"],
      scoreWeights: { continuity: 30, dominance: 20, structure: 30, momentum: 20 },
      minScore: 70,
      entryRules: [
        { condition: "Pullback até EMA 9/21", description: "Preço reagiu à EMA curta", required: true },
        { condition: "Micro BOS de confirmação", description: "Estrutura confirmou continuação", required: true },
        { condition: "Continuidade retomada", description: "Velas voltaram à direção original", required: false },
      ],
      exitRules: [
        { condition: "EMA cross", description: "EMA 9 cruzou EMA 21", required: false },
        { condition: "Perda de momentum", description: "Candle força < 40%", required: false },
      ],
      advisorRules: ["pullback-ema", "continuation-confirmed"],
    },
  ],
};
