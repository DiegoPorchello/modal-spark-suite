/**
 * Hybrid Probability Profile — Statistical profile for HYBRID_PROBABILITY.
 *
 * This profile removes all technical indicators and focuses purely on statistical analysis.
 * It includes the 2 Candle Continuation strategy.
 */

import type { CoreProfile } from "../types/market-profile.types";
import type { Strategy } from "../../../../../types/strategy-profile.types";

export interface HYBRID_PROBABILITY_STRATEGY extends Strategy {
  id: "2c-continuation";
  name: "2 Candle Continuation";
  description: "Entrar no terceiro candle quando dois candles consecutivos da mesma cor aparecem (sem considerar tendências, suporte/resistência ou indicadores)";
  type: "probabilistic";
}

export const HYBRID_PROBABILITY_STRATEGY: HYBRID_PROBABILITY_STRATEGY = {
  id: "2c-continuation",
  name: "2 Candle Continuation",
  description: "Entrar no terceiro candle quando dois candles consecutivos da mesma cor aparecem (sem considerar tendências, suporte/resistência ou indicadores)",
  type: "probabilistic",
};

export const HYBRID_PROBABILITY_PROFILE: CoreProfile = {
  id: "hybrid-probability",
  name: "Probabilidade 2c + Filtros",
  description: "Sequência de cores (2 Candle Continuation) filtrada por contexto: ADX (força), EMA 200 (direção), ATR (volatilidade) e Flow Index (fluidez das velas). Sem Smart Money (BOS/CHOCH/Order Block/FVG/Supply-Demand).",
  market: "HYBRID_PROBABILITY",
  coreId: "hybrid-probability-core",
  indicators: [
    { id: "adx", name: "ADX (14)", description: "Força direcional — libera operações acima de 25, bloqueia abaixo de 20" },
    { id: "ema200", name: "EMA 200", description: "Filtro de direção — CALL acima / PUT abaixo" },
    { id: "atr", name: "ATR (14)", description: "Volatilidade — exige estar acima da média das últimas 20 velas" },
    { id: "flow-index", name: "Flow Index (20)", description: "Mede continuidade x alternância das velas — bloqueia em lateralização" },
  ],
  filters: [
    {
      id: "prob-count-min",
      name: "Mínimo de ocorrências",
      type: "number",
      min: 10,
      max: 1000,
      default: 30,
    },
    {
      id: "prob-win-rate-min",
      name: "Win Rate mínimo",
      type: "number",
      min: 50,
      max: 100,
      default: 60,
    },
    {
      id: "adx-min",
      name: "ADX mínimo",
      type: "number",
      min: 15,
      max: 50,
      default: 25,
    },
    {
      id: "adx-block",
      name: "ADX de bloqueio",
      type: "number",
      min: 10,
      max: 30,
      default: 20,
    },
    {
      id: "ema200-enabled",
      name: "Usar EMA 200 (direção)",
      type: "boolean",
      default: true,
    },
    {
      id: "atr-enabled",
      name: "Usar ATR (volatilidade)",
      type: "boolean",
      default: true,
    },
    {
      id: "flow-index-min",
      name: "Flow Index mínimo",
      type: "number",
      min: 0,
      max: 1,
      default: 0.55,
    },
  ],
  strategies: [HYBRID_PROBABILITY_STRATEGY],
  updatedAt: new Date().toISOString(),
};