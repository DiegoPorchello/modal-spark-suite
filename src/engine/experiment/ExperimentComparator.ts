/**
 * engine/experiment/ExperimentComparator.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Compara resultados de múltiplos experimentos lado a lado.
 * Gera tabelas comparativas e identifica o melhor por cada métrica.
 */

import type { ExperimentResult, ExperimentMetrics } from "./types";

export interface ComparisonRow {
  metric: string;
  values: { experimentId: string; value: number }[];
  best: string;
}

export interface ComparisonTable {
  experiments: string[];
  rows: ComparisonRow[];
  winner: string;
}

export class ExperimentComparator {
  private results: ExperimentResult[];

  constructor(results: ExperimentResult[]) {
    this.results = results.filter((r) => r.status === "completed");
  }

  /**
   * Gera tabela comparativa completa.
   */
  compare(): ComparisonTable {
    const ids = this.results.map((r) => r.config.experimentId);
    const metrics: (keyof ExperimentMetrics)[] = [
      "accuracy",
      "precision",
      "recall",
      "f1Score",
      "winRate",
      "profitFactor",
      "maxDrawdown",
      "avgDecisionScore",
      "avgProbabilityScore",
      "avgTechnicalScore",
      "calibrationScore",
      "totalSignals",
      "approved",
      "blocked",
    ];

    const rows: ComparisonRow[] = metrics.map((metric) => ({
      metric,
      values: this.results.map((r) => ({
        experimentId: r.config.experimentId,
        value: r.metrics[metric],
      })),
      best: this.findBest(ids, metric),
    }));

    const winner = this.findOverallWinner();

    return { experiments: ids, rows, winner };
  }

  /**
   * Compara apenas duas métricas-chave: accuracy e profitFactor.
   */
  quickCompare(): {
    id: string;
    name: string;
    accuracy: number;
    profitFactor: number;
    f1Score: number;
    drawdown: number;
  }[] {
    return this.results.map((r) => ({
      id: r.config.experimentId,
      name: r.config.experimentName,
      accuracy: r.metrics.accuracy,
      profitFactor: r.metrics.profitFactor,
      f1Score: r.metrics.f1Score,
      drawdown: r.metrics.maxDrawdown,
    }));
  }

  /**
   * Retorna o melhor experimento por uma métrica específica.
   */
  getBestByMetric(metric: keyof ExperimentMetrics): ExperimentResult | null {
    if (this.results.length === 0) return null;

    const lowerIsBetter = metric === "maxDrawdown";

    return this.results.reduce((best, current) => {
      const bestVal = best.metrics[metric];
      const currentVal = current.metrics[metric];
      if (typeof bestVal !== "number" || typeof currentVal !== "number") return best;
      return lowerIsBetter
        ? currentVal < bestVal
          ? current
          : best
        : currentVal > bestVal
          ? current
          : best;
    });
  }

  /**
   * Retorna diff entre dois experimentos.
   */
  diff(id1: string, id2: string): { metric: string; exp1: number; exp2: number; delta: number }[] {
    const r1 = this.results.find((r) => r.config.experimentId === id1);
    const r2 = this.results.find((r) => r.config.experimentId === id2);
    if (!r1 || !r2) return [];

    const metrics: (keyof ExperimentMetrics)[] = [
      "accuracy",
      "precision",
      "recall",
      "f1Score",
      "winRate",
      "profitFactor",
      "maxDrawdown",
      "avgDecisionScore",
      "calibrationScore",
    ];

    return metrics.map((m) => ({
      metric: m,
      exp1: r1.metrics[m],
      exp2: r2.metrics[m],
      delta: r2.metrics[m] - r1.metrics[m],
    }));
  }

  /**
   * Formata comparação como texto legível.
   */
  formatReport(table: ComparisonTable): string {
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  EXPERIMENT COMPARISON REPORT");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");

    for (const row of table.rows) {
      const vals = row.values
        .map((v) => `${v.experimentId.slice(-6)}: ${v.value.toFixed(1)}`)
        .join("  |  ");
      const bestMark = row.best ? `  ★ best: ${row.best.slice(-6)}` : "";
      lines.push(`  ${row.metric.padEnd(25)} ${vals}${bestMark}`);
    }

    lines.push("");
    lines.push(`  OVERALL WINNER: ${table.winner}`);
    lines.push("═══════════════════════════════════════════════════════════");

    return lines.join("\n");
  }

  private findBest(ids: string[], metric: keyof ExperimentMetrics): string {
    let bestId = "";
    let bestVal = -Infinity;
    const lowerIsBetter = metric === "maxDrawdown";

    for (const r of this.results) {
      const val = r.metrics[metric];
      if (typeof val !== "number") continue;

      if (lowerIsBetter ? val < bestVal : val > bestVal) {
        bestVal = val;
        bestId = r.config.experimentId;
      }
    }
    return bestId;
  }

  private findOverallWinner(): string {
    if (this.results.length === 0) return "";
    if (this.results.length === 1) return this.results[0].config.experimentId;

    const scored = this.results.map((r) => ({
      id: r.config.experimentId,
      score:
        r.metrics.accuracy * 0.25 +
        r.metrics.f1Score * 0.25 +
        r.metrics.profitFactor * 10 * 0.25 +
        (100 - r.metrics.maxDrawdown) * 0.15 +
        r.metrics.calibrationScore * 100 * 0.1,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }
}
