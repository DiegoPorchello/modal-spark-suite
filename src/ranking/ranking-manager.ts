/**
 * ranking/ranking-manager.ts
 * Gerenciador de Ranking — monitora até 10 ativos.
 *
 * Atualiza a cada 60 segundos com:
 * - WinRate, Score, Continuidade, Histórico
 * - Ordenado por Score (decrescente)
 * - Apenas ativos com score >= minScore aparecem
 */

import type { ScoreResult } from "../engine/score-calculator";
import type { RankedAsset, RankingConfig } from "./types";

const DEFAULT_CONFIG: RankingConfig = {
  maxAssets: 10,
  refreshIntervalMs: 60000,
  minScoreThreshold: 80,
};

export class RankingManager {
  private rankings: Map<string, RankedAsset> = new Map();
  private config: RankingConfig;
  private lastRefresh = 0;

  constructor(config?: Partial<RankingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateAsset(
    asset: string,
    name: string,
    score: ScoreResult,
    winrate: number,
    continuity: number,
    history: number,
    direction: "CALL" | "PUT" | null,
  ): void {
    this.rankings.set(asset, {
      asset,
      name,
      score: score.total,
      winrate,
      continuity,
      history,
      tradesCount: (this.rankings.get(asset)?.tradesCount ?? 0) + 1,
      lastUpdated: Date.now(),
      direction,
      signalSummary: `${direction} | Score: ${score.total} | ${score.classification}`,
    });
  }

  getRankings(): RankedAsset[] {
    const assets = Array.from(this.rankings.values())
      .filter((a) => a.score >= this.config.minScoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxAssets);
    return assets;
  }

  getTopAsset(): RankedAsset | null {
    return this.getRankings()[0] ?? null;
  }

  getAsset(asset: string): RankedAsset | undefined {
    return this.rankings.get(asset);
  }

  removeAsset(asset: string): void {
    this.rankings.delete(asset);
  }

  shouldRefresh(): boolean {
    return Date.now() - this.lastRefresh >= this.config.refreshIntervalMs;
  }

  markRefreshed(): void {
    this.lastRefresh = Date.now();
  }

  clear(): void {
    this.rankings.clear();
  }

  get config_(): RankingConfig {
    return { ...this.config };
  }
}
