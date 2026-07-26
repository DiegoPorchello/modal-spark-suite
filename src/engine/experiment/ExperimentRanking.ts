/**
 * engine/experiment/ExperimentRanking.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Ranking automático de configurações baseado em scores compostos.
 * Cada experimento recebe um Score que combina múltiplas métricas.
 */

import type { ExperimentResult, RankingEntry, RankingSortField } from "./types";

const WEIGHTS = {
  accuracy: 0.25,
  f1Score: 0.25,
  profitFactor: 0.25,
  drawdown: 0.15,
  calibration: 0.1,
};

export class ExperimentRanking {
  private results: ExperimentResult[];

  constructor(results: ExperimentResult[]) {
    this.results = results.filter((r) => r.status === "completed");
  }

  /**
   * Gera ranking completo com scores compostos.
   */
  rank(sortBy: RankingSortField = "composite"): RankingEntry[] {
    const entries: RankingEntry[] = this.results.map((r) => {
      const compositeScore = this.computeCompositeScore(r.metrics);
      return {
        rank: 0,
        experimentId: r.config.experimentId,
        experimentName: r.config.experimentName,
        config: r.config.engineOverrides,
        metrics: r.metrics,
        compositeScore,
      };
    });

    entries.sort((a, b) => {
      if (sortBy === "composite") return b.compositeScore - a.compositeScore;
      if (sortBy === "maxDrawdown") {
        return a.metrics.maxDrawdown - b.metrics.maxDrawdown;
      }
      return (
        (b.metrics[sortBy as keyof typeof b.metrics] as number) -
        (a.metrics[sortBy as keyof typeof a.metrics] as number)
      );
    });

    entries.forEach((e, i) => {
      e.rank = i + 1;
    });

    return entries;
  }

  /**
   * Retorna Top N configurações.
   */
  topN(n: number, sortBy: RankingSortField = "composite"): RankingEntry[] {
    return this.rank(sortBy).slice(0, n);
  }

  /**
   * Retorna o melhor experimento.
   */
  best(sortBy: RankingSortField = "composite"): RankingEntry | null {
    const ranked = this.rank(sortBy);
    return ranked.length > 0 ? ranked[0] : null;
  }

  /**
   * Formata ranking como texto.
   */
  formatReport(entries: RankingEntry[]): string {
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  EXPERIMENT RANKING");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("  Rank | Experiment          | Accuracy | Profit | Drawdown | Score");
    lines.push("  ─────┼─────────────────────┼──────────┼────────┼──────────┼──────");

    for (const e of entries) {
      lines.push(
        `  ${String(e.rank).padStart(4)} | ${e.experimentName.slice(0, 19).padEnd(19)} | ${e.metrics.accuracy.toFixed(1).padStart(6)}% | ${e.metrics.profitFactor.toFixed(2).padStart(6)} | ${e.metrics.maxDrawdown.toFixed(0).padStart(6)}  | ${e.compositeScore.toFixed(1).padStart(5)}`,
      );
    }

    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
  }

  private computeCompositeScore(metrics: {
    accuracy: number;
    f1Score: number;
    profitFactor: number;
    maxDrawdown: number;
    calibrationScore: number;
  }): number {
    const normalizedProfit = Math.min(metrics.profitFactor, 5) / 5;
    const normalizedDrawdown = Math.max(0, 1 - metrics.maxDrawdown / 100);

    return (
      metrics.accuracy * WEIGHTS.accuracy +
      metrics.f1Score * WEIGHTS.f1Score +
      normalizedProfit * 100 * WEIGHTS.profitFactor +
      normalizedDrawdown * 100 * WEIGHTS.drawdown +
      metrics.calibrationScore * 100 * WEIGHTS.calibration
    );
  }
}
