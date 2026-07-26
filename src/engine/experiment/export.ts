/**
 * engine/experiment/export.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Exportação de resultados de experimentos em JSON e CSV.
 */

import type { ExperimentResult, ExperimentMetrics } from "./types";
import type { RankingEntry } from "./types";

/**
 * Exporta experimentos como JSON string.
 */
export function exportToJSON(results: ExperimentResult[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: results.length,
      experiments: results.map((r) => ({
        id: r.config.experimentId,
        name: r.config.experimentName,
        description: r.config.description,
        status: r.status,
        config: {
          asset: r.config.asset,
          timeframe: r.config.timeframe,
          profile: r.config.profile,
          historySize: r.config.historySize,
          probabilityWeight: r.config.probabilityWeight,
          engineOverrides: r.config.engineOverrides,
          engineVersion: r.config.engineVersion,
        },
        metrics: r.metrics,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        duration: r.completedAt ? r.completedAt - r.startedAt : null,
      })),
    },
    null,
    2,
  );
}

/**
 * Exporta experimentos como CSV string.
 */
export function exportToCSV(results: ExperimentResult[]): string {
  const headers = [
    "experiment_id",
    "experiment_name",
    "status",
    "asset",
    "timeframe",
    "history_size",
    "probability_weight",
    "total_signals",
    "approved",
    "blocked",
    "accuracy",
    "precision",
    "recall",
    "f1_score",
    "win_rate",
    "profit_factor",
    "max_drawdown",
    "net_profit",
    "avg_decision_score",
    "avg_probability_score",
    "avg_technical_score",
    "calibration_score",
    "processing_time_ms",
    "started_at",
    "completed_at",
  ];

  const rows = results.map((r) => [
    r.config.experimentId,
    `"${r.config.experimentName}"`,
    r.status,
    r.config.asset,
    r.config.timeframe,
    r.config.historySize,
    r.config.probabilityWeight,
    r.metrics.totalSignals,
    r.metrics.approved,
    r.metrics.blocked,
    r.metrics.accuracy.toFixed(2),
    r.metrics.precision.toFixed(2),
    r.metrics.recall.toFixed(2),
    r.metrics.f1Score.toFixed(2),
    r.metrics.winRate.toFixed(2),
    r.metrics.profitFactor.toFixed(2),
    r.metrics.maxDrawdown.toFixed(2),
    r.metrics.netProfit.toFixed(2),
    r.metrics.avgDecisionScore.toFixed(2),
    r.metrics.avgProbabilityScore.toFixed(2),
    r.metrics.avgTechnicalScore.toFixed(2),
    r.metrics.calibrationScore.toFixed(2),
    r.metrics.avgProcessingTimeMs.toFixed(2),
    r.startedAt,
    r.completedAt ?? "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Exporta ranking como CSV string.
 */
export function exportRankingToCSV(entries: RankingEntry[]): string {
  const headers = [
    "rank",
    "experiment_id",
    "experiment_name",
    "accuracy",
    "precision",
    "recall",
    "f1_score",
    "win_rate",
    "profit_factor",
    "max_drawdown",
    "calibration_score",
    "composite_score",
  ];

  const rows = entries.map((e) => [
    e.rank,
    e.experimentId,
    `"${e.experimentName}"`,
    e.metrics.accuracy.toFixed(2),
    e.metrics.precision.toFixed(2),
    e.metrics.recall.toFixed(2),
    e.metrics.f1Score.toFixed(2),
    e.metrics.winRate.toFixed(2),
    e.metrics.profitFactor.toFixed(2),
    e.metrics.maxDrawdown.toFixed(2),
    e.metrics.calibrationScore.toFixed(2),
    e.compositeScore.toFixed(2),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
