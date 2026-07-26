/**
 * FOREX Filters
 *
 * Trend H4, Trend H1, Entry M15, Entry M5, Pullback,
 * Break Valid, Min Distance, EMA Distance, ATR Min,
 * Liquidity Before Entry, Confirmation Candle, Min Confluence
 *
 * Updated weights based on importance for decision-making.
 */

import type { CoreFilter } from "../../../types/market-profile.types";

export const FOREX_FILTERS: CoreFilter[] = [
  // Multi-timeframe
  {
    id: "trend-h4",
    name: "Tendência H4",
    description: "Direção da tendência no timeframe H4 — filtro de alinhamento",
    weight: 20,
    category: "multi-timeframe",
  },
  {
    id: "trend-h1",
    name: "Tendência H1",
    description: "Direção da tendência no timeframe H1 — confirmação intermediária",
    weight: 18,
    category: "multi-timeframe",
  },
  {
    id: "entry-m15",
    name: "Entrada M15",
    description: "Sinal de entrada no timeframe M15 — timing de entrada",
    weight: 16,
    category: "multi-timeframe",
  },
  {
    id: "entry-m5",
    name: "Entrada M5",
    description: "Sinal de entrada no timeframe M5 — timing preciso",
    weight: 15,
    category: "multi-timeframe",
  },

  // Estrutura
  {
    id: "pullback",
    name: "Pullback",
    description: "Preço retornou para zona de valor (EMA ou Order Block)",
    weight: 15,
    category: "structure",
  },
  {
    id: "break-valid",
    name: "Rompimento Válido",
    description: "BOS/CHoCH com confirmação de volume e estrutura",
    weight: 18,
    category: "structure",
  },

  // Distância
  {
    id: "ema-distance",
    name: "Distância da EMA",
    description: "Preço não está muito distante da EMA (evita entrada em extremo)",
    weight: 12,
    category: "distance",
  },
  {
    id: "min-distance",
    name: "Distância Mínima",
    description: "Distância mínima entre entrada e stop (risco/recompensa)",
    weight: 8,
    category: "distance",
  },

  // Volatilidade
  {
    id: "atr-min",
    name: "ATR Mínimo",
    description: "ATR acima do mínimo — mercado com volatilidade suficiente",
    weight: 14,
    category: "volatility",
  },

  // Liquidez
  {
    id: "liquidity-before",
    name: "Liquidez Antes da Entrada",
    description: "Há liquidity sweep ou acumulação antes da entrada",
    weight: 16,
    category: "liquidity",
  },

  // Confirmação
  {
    id: "confirmation-candle",
    name: "Candle de Confirmação",
    description: "Candle de confirmação (engolfo, doji, etc.) na direção",
    weight: 14,
    category: "confirmation",
  },

  // Confluência
  {
    id: "min-confluence",
    name: "Confluência Mínima",
    description: "Número mínimo de filtros aprovados para entrada",
    weight: 20,
    category: "confluence",
  },
];
