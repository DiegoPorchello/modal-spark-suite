import type { Timeframe, DateRange } from "./common.types";

/**
 * catalog.types.ts
 * Tipos do Catálogo de Padrões — repositório de formações reconhecidas
 * pelo robô (continuidade, rompimento, lateralização, reversão).
 * Fornece a base para o motor de score comparar o mercado atual
 * com padrões históricos catalogados.
 */

/** Padrão de mercado catalogado */
export interface Pattern {
  id: string;
  name: string;
  type: PatternType;
  category: PatternCategory;
  description: string;
  asset: string;
  timeframe: Timeframe;
  strength: PatternStrength;
  confidence: number;
  occurrences: number;
  winRate: number;
  createdAt: string;
  updatedAt: string;
  status: PatternStatus;
}

export type PatternType =
  | "continuity"
  | "breakout"
  | "lateralization"
  | "reversal"
  | "exhaustion"
  | "consolidation";

export type PatternCategory = "candlestick" | "structure" | "volume" | "momentum" | "volatility";

export type PatternStrength = 1 | 2 | 3 | 4 | 5;
export type PatternStatus = "active" | "confirmed" | "expired" | "invalidated";

/** Filtro para consulta de padrões no catálogo */
export interface PatternFilter {
  types?: PatternType[];
  categories?: PatternCategory[];
  assets?: string[];
  timeframes?: Timeframe[];
  minStrength?: PatternStrength;
  minConfidence?: number;
  status?: PatternStatus;
  dateRange?: DateRange;
}

/** Meta-informação de reconhecimento de padrão no mercado atual */
export interface PatternMatch {
  pattern: Pattern;
  similarity: number;
  matchedAt: string;
  currentCandles: number;
  remainingCandles: number;
}

/** Catálogo completo com estatísticas agregadas */
export interface CatalogSummary {
  totalPatterns: number;
  byType: Record<PatternType, number>;
  byCategory: Record<PatternCategory, number>;
  topPatterns: Pattern[];
  lastUpdated: string;
}
