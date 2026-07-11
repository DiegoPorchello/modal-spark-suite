/**
 * catalog/catalog-manager.ts
 * Gerenciador do Catálogo de Padrões — banco estatístico.
 *
 * Armazena cada operação como um padrão com:
 * - Ativo, timeframe, direção, padrão (descrição)
 * - Score, resultado, data, hora
 *
 * Fornece winrate histórico para o cálculo de Score (10% Histórico).
 */

import type { IBroker } from "../broker/types";
import type { Timeframe } from "../market/types";
import type { CatalogPattern, PatternStats } from "./types";
import type { DatabaseClient } from "../database/types";

const DEFAULT_PATTERNS: CatalogPattern[] = [];

export class CatalogManager {
  private patterns: CatalogPattern[] = [...DEFAULT_PATTERNS];
  private db?: DatabaseClient;

  constructor(db?: DatabaseClient) {
    this.db = db;
  }

  addPattern(pattern: CatalogPattern): void {
    this.patterns.push(pattern);
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(-500);
    }
  }

  getPatterns(): CatalogPattern[] {
    return [...this.patterns];
  }

  getWinrate(
    asset: string,
    timeframe: Timeframe,
    direction: "CALL" | "PUT",
    lookback = 50,
  ): number {
    const filtered = this.patterns.filter(
      (p) => p.asset === asset && p.timeframe === timeframe && p.direction === direction,
    );
    const recent = filtered.slice(-lookback);
    if (recent.length === 0) return 0;
    const wins = recent.filter((r) => r.resultado === "WIN").length;
    return (wins / recent.length) * 100;
  }

  getHistoryScore(asset: string, timeframe: Timeframe, direction: "CALL" | "PUT"): number {
    const winrate = this.getWinrate(asset, timeframe, direction);
    // Converte winrate em score (0-100)
    // Winrate de 100% = score 100, winrate de 50% = score 0
    return Math.max(0, Math.min(100, (winrate - 50) * 2));
  }

  getStats(asset?: string, timeframe?: Timeframe): PatternStats[] {
    let filtered = this.patterns;
    if (asset) filtered = filtered.filter((p) => p.asset === asset);
    if (timeframe) filtered = filtered.filter((p) => p.timeframe === timeframe);

    const groups = new Map<string, CatalogPattern[]>();
    for (const p of filtered) {
      const key = `${p.padrao}_${p.asset}_${p.timeframe}_${p.direction}`;
      const existing = groups.get(key) ?? [];
      existing.push(p);
      groups.set(key, existing);
    }

    const stats: PatternStats[] = [];
    for (const [key, group] of groups) {
      const [pattern, asset, timeframe, direction] = key.split("_");
      const wins = group.filter((g) => g.resultado === "WIN").length;
      stats.push({
        pattern: group[0].padrao,
        asset: group[0].asset,
        timeframe: group[0].timeframe,
        direction: group[0].direction as "CALL" | "PUT",
        totalTrades: group.length,
        wins,
        losses: group.length - wins,
        winrate: (wins / group.length) * 100,
        avgScore: group.reduce((s, g) => s + g.score, 0) / group.length,
        lastUsed: group[group.length - 1].data,
      });
    }

    return stats.sort((a, b) => b.winrate - a.winrate);
  }
}
