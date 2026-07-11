import type { Timeframe, AssetCategory } from "./common.types";

/**
 * ranking.types.ts
 * Tipos do Ranking de Ativos — classifica ativos por pontuação composta
 * (score, win rate, volume, consistência) para auxiliar na seleção
 * do melhor ativo para operar no momento.
 */

/** Entrada individual no ranking */
export interface RankingEntry {
  position: number;
  asset: string;
  flag?: string;
  score: number;
  winRate: number;
  totalOperations: number;
  consecutiveWins: number;
  averagePayout: number;
  profitLoss: number;
  volatility: number;
  trend: "up" | "down" | "stable";
  lastUpdated: string;
}

/** Configuração de como o ranking é calculado */
export interface RankingConfig {
  sortBy: RankingSortField;
  sortDirection: "asc" | "desc";
  maxEntries: number;
  timeframe: Timeframe;
  minOperations: number;
  refreshIntervalMs: number;
}

export type RankingSortField =
  | "score"
  | "winRate"
  | "profitLoss"
  | "totalOperations"
  | "volatility"
  | "averagePayout";

/** Filtro para consulta do ranking */
export interface RankingFilter {
  assets?: string[];
  timeframes?: Timeframe[];
  minScore?: number;
  minWinRate?: number;
  categories?: AssetCategory[];
}

/** Estatísticas agregadas do ranking */
export interface RankingSummary {
  topAsset: string;
  bottomAsset: string;
  averageScore: number;
  averageWinRate: number;
  totalAssets: number;
  lastUpdated: string;
}
