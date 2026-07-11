/**
 * ranking/types.ts
 * Tipos do Ranking de Ativos.
 */

export interface RankedAsset {
  asset: string;
  name: string;
  score: number;
  winrate: number;
  continuity: number;
  history: number;
  tradesCount: number;
  lastUpdated: number;
  direction: "CALL" | "PUT" | null;
  signalSummary: string;
}

export interface RankingConfig {
  maxAssets: number;
  refreshIntervalMs: number;
  minScoreThreshold: number;
}
