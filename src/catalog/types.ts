/**
 * catalog/types.ts
 * Tipos do Catálogo de Padrões.
 */

export interface CatalogPattern {
  id?: number;
  asset: string;
  timeframe: string;
  direction: "CALL" | "PUT";
  padrao: string;
  score: number;
  resultado: "WIN" | "LOSS";
  data: string;
  hora: string;
  created_at?: string;
}

export interface PatternStats {
  pattern: string;
  asset: string;
  timeframe: string;
  direction: "CALL" | "PUT";
  totalTrades: number;
  wins: number;
  losses: number;
  winrate: number;
  avgScore: number;
  lastUsed: string;
}
