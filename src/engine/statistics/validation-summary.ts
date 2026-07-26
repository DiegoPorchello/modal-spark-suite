/**
 * engine/statistics/validation-summary.ts
 *
 * PHASE XXIII.5 — Validation & Burn-in
 *
 * Lê signal_log.jsonl e calcula métricas de validação:
 * - Accuracy, Precision, Recall, F1 Score
 * - False Positive Rate, False Negative Rate
 * - Calibration (score vs winrate real)
 * - Drift detection (rolling window)
 * - Performance (processing time)
 * - Breakdown per asset, per timeframe
 */

import type { SignalLogEntry, SignalStatus, SignalResult } from "./signal-log";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ClassificationMetrics {
  tp: number; // approved + WIN
  fp: number; // approved + LOSS
  fn: number; // blocked but would have been WIN (only with replay data)
  tn: number; // blocked and would have been LOSS (only with replay data)
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
}

export interface CalibrationBucket {
  range: string; // "70-75", "75-80", etc.
  min: number;
  max: number;
  count: number;
  approvedCount: number;
  winCount: number;
  lossCount: number;
  actualWinRate: number; // winRate among approved signals in this bucket
}

export interface DriftPoint {
  windowStart: number; // timestamp
  windowEnd: number;
  signalCount: number;
  approvalRate: number;
  accuracy: number;
  avgDecisionScore: number;
}

export interface AssetBreakdown {
  asset: string;
  total: number;
  approved: number;
  blocked: number;
  accuracy: number;
  avgDecisionScore: number;
  avgProcessingTimeMs: number;
}

export interface TimeframeBreakdown {
  timeframe: string;
  total: number;
  approved: number;
  blocked: number;
  accuracy: number;
  avgDecisionScore: number;
}

export interface PerformanceMetrics {
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  maxProcessingTimeMs: number;
  minProcessingTimeMs: number;
}

export interface ValidationMetrics {
  summary: {
    total: number;
    approved: number;
    blocked: number;
    insufficientData: number;
    lowConfidence: number;
    technicalRejection: number;
    approvalRate: number;
    blockRate: number;
  };
  classification: ClassificationMetrics;
  calibration: CalibrationBucket[];
  drift: DriftPoint[];
  perAsset: AssetBreakdown[];
  perTimeframe: TimeframeBreakdown[];
  performance: PerformanceMetrics;
  versions: {
    engine: string[];
    database: string[];
    patternCatalog: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION SUMMARY
// ═══════════════════════════════════════════════════════════════════

export class ValidationSummary {
  private entries: SignalLogEntry[];

  constructor(entries: SignalLogEntry[]) {
    this.entries = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calcula todas as métricas de validação.
   */
  compute(): ValidationMetrics {
    return {
      summary: this.computeSummary(),
      classification: this.computeClassification(),
      calibration: this.computeCalibration(),
      drift: this.computeDrift(),
      perAsset: this.computePerAsset(),
      perTimeframe: this.computePerTimeframe(),
      performance: this.computePerformance(),
      versions: this.extractVersions(),
    };
  }

  // ── Summary ──

  private computeSummary() {
    const total = this.entries.length;
    const approved = this.entries.filter((e) => e.status === "APPROVED").length;
    const blocked = this.entries.filter((e) => e.status === "BLOCKED").length;
    const insufficientData = this.entries.filter((e) => e.status === "INSUFFICIENT_DATA").length;
    const lowConfidence = this.entries.filter((e) => e.status === "LOW_CONFIDENCE").length;
    const technicalRejection = this.entries.filter(
      (e) => e.status === "TECHNICAL_REJECTION",
    ).length;

    return {
      total,
      approved,
      blocked,
      insufficientData,
      lowConfidence,
      technicalRejection,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
      blockRate: total > 0 ? ((total - approved) / total) * 100 : 0,
    };
  }

  // ── Classification: Precision, Recall, F1, FPR, FNR ──

  private computeClassification(): ClassificationMetrics {
    const evaluated = this.entries.filter((e) => e.result === "WIN" || e.result === "LOSS");

    const approved = evaluated.filter((e) => e.status === "APPROVED");
    const blocked = evaluated.filter((e) => e.status !== "APPROVED");

    const tp = approved.filter((e) => e.result === "WIN").length;
    const fp = approved.filter((e) => e.result === "LOSS").length;

    // FN/TN only meaningful with replay data (historical candles where we know the outcome)
    // For live data, we can only measure approved signals
    const fn = blocked.filter((e) => e.result === "WIN").length;
    const tn = blocked.filter((e) => e.result === "LOSS").length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
    const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0;

    return {
      tp,
      fp,
      fn,
      tn,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      falseNegativeRate,
    };
  }

  // ── Calibration: score buckets vs actual win rate ──

  private computeCalibration(): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = [];
    const bucketSize = 5;
    const minScore = 0;
    const maxScore = 100;

    for (let low = minScore; low < maxScore; low += bucketSize) {
      const high = low + bucketSize;
      const inBucket = this.entries.filter(
        (e) => e.scores.decisionScore >= low && e.scores.decisionScore < high,
      );
      const approved = inBucket.filter((e) => e.status === "APPROVED");
      const wins = approved.filter((e) => e.result === "WIN").length;
      const losses = approved.filter((e) => e.result === "LOSS").length;
      const evaluated = wins + losses;

      buckets.push({
        range: `${low}-${high}`,
        min: low,
        max: high,
        count: inBucket.length,
        approvedCount: approved.length,
        winCount: wins,
        lossCount: losses,
        actualWinRate: evaluated > 0 ? (wins / evaluated) * 100 : 0,
      });
    }

    return buckets;
  }

  // ── Drift Detection: rolling window comparison ──

  private computeDrift(windowSize: number = 50): DriftPoint[] {
    if (this.entries.length < windowSize) return [];

    const points: DriftPoint[] = [];
    for (let i = 0; i <= this.entries.length - windowSize; i += Math.floor(windowSize / 2)) {
      const window = this.entries.slice(i, i + windowSize);
      const approved = window.filter((e) => e.status === "APPROVED");
      const evaluated = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");
      const wins = evaluated.filter((e) => e.result === "WIN").length;

      points.push({
        windowStart: window[0].timestamp,
        windowEnd: window[window.length - 1].timestamp,
        signalCount: window.length,
        approvalRate: (approved.length / window.length) * 100,
        accuracy: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        avgDecisionScore: window.reduce((s, e) => s + e.scores.decisionScore, 0) / window.length,
      });
    }

    return points;
  }

  // ── Per-Asset Breakdown ──

  private computePerAsset(): AssetBreakdown[] {
    const assetMap = new Map<string, SignalLogEntry[]>();
    for (const e of this.entries) {
      const arr = assetMap.get(e.asset) ?? [];
      arr.push(e);
      assetMap.set(e.asset, arr);
    }

    const breakdowns: AssetBreakdown[] = [];
    for (const [asset, entries] of assetMap) {
      const approved = entries.filter((e) => e.status === "APPROVED");
      const evaluated = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");
      const wins = evaluated.filter((e) => e.result === "WIN").length;

      breakdowns.push({
        asset,
        total: entries.length,
        approved: approved.length,
        blocked: entries.length - approved.length,
        accuracy: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        avgDecisionScore: entries.reduce((s, e) => s + e.scores.decisionScore, 0) / entries.length,
        avgProcessingTimeMs: entries.reduce((s, e) => s + e.processingTimeMs, 0) / entries.length,
      });
    }

    return breakdowns.sort((a, b) => b.total - a.total);
  }

  // ── Per-Timeframe Breakdown ──

  private computePerTimeframe(): TimeframeBreakdown[] {
    const tfMap = new Map<string, SignalLogEntry[]>();
    for (const e of this.entries) {
      const arr = tfMap.get(e.timeframe) ?? [];
      arr.push(e);
      tfMap.set(e.timeframe, arr);
    }

    const breakdowns: TimeframeBreakdown[] = [];
    for (const [tf, entries] of tfMap) {
      const approved = entries.filter((e) => e.status === "APPROVED");
      const evaluated = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");
      const wins = evaluated.filter((e) => e.result === "WIN").length;

      breakdowns.push({
        timeframe: tf,
        total: entries.length,
        approved: approved.length,
        blocked: entries.length - approved.length,
        accuracy: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        avgDecisionScore: entries.reduce((s, e) => s + e.scores.decisionScore, 0) / entries.length,
      });
    }

    return breakdowns.sort((a, b) => a.timeframe.localeCompare(b.timeframe));
  }

  // ── Performance Metrics ──

  private computePerformance(): PerformanceMetrics {
    const times = this.entries.map((e) => e.processingTimeMs).sort((a, b) => a - b);
    const len = times.length;

    return {
      avgProcessingTimeMs: len > 0 ? times.reduce((a, b) => a + b, 0) / len : 0,
      p50ProcessingTimeMs: len > 0 ? times[Math.floor(len * 0.5)] : 0,
      p95ProcessingTimeMs: len > 0 ? times[Math.floor(len * 0.95)] : 0,
      p99ProcessingTimeMs: len > 0 ? times[Math.floor(len * 0.99)] : 0,
      maxProcessingTimeMs: len > 0 ? times[len - 1] : 0,
      minProcessingTimeMs: len > 0 ? times[0] : 0,
    };
  }

  // ── Versions ──

  private extractVersions() {
    return {
      engine: [...new Set(this.entries.map((e) => e.engineVersion))],
      database: [...new Set(this.entries.map((e) => e.databaseVersion))],
      patternCatalog: [...new Set(this.entries.map((e) => e.patternCatalogVersion))],
    };
  }

  // ── Pretty Print ──

  static formatReport(metrics: ValidationMetrics): string {
    const lines: string[] = [];
    const { summary: s, classification: c, performance: p } = metrics;

    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  PHASE XXIII.5 — VALIDATION & BURN-IN REPORT");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");

    lines.push("── SUMMARY ──");
    lines.push(`  Total signals:        ${s.total}`);
    lines.push(`  Approved:             ${s.approved} (${s.approvalRate.toFixed(1)}%)`);
    lines.push(`  Blocked:              ${s.blocked} (${s.blockRate.toFixed(1)}%)`);
    lines.push(`  Insufficient Data:    ${s.insufficientData}`);
    lines.push(`  Low Confidence:       ${s.lowConfidence}`);
    lines.push(`  Technical Rejection:  ${s.technicalRejection}`);
    lines.push("");

    lines.push("── CLASSIFICATION (evaluated signals) ──");
    lines.push(`  TP (approved+WIN):    ${c.tp}`);
    lines.push(`  FP (approved+LOSS):   ${c.fp}`);
    lines.push(`  FN (blocked+WIN):     ${c.fn}`);
    lines.push(`  TN (blocked+LOSS):    ${c.tn}`);
    lines.push(`  Precision:            ${(c.precision * 100).toFixed(1)}%`);
    lines.push(`  Recall:               ${(c.recall * 100).toFixed(1)}%`);
    lines.push(`  F1 Score:             ${(c.f1Score * 100).toFixed(1)}%`);
    lines.push(`  False Positive Rate:  ${(c.falsePositiveRate * 100).toFixed(1)}%`);
    lines.push(`  False Negative Rate:  ${(c.falseNegativeRate * 100).toFixed(1)}%`);
    lines.push("");

    lines.push("── CALIBRATION (score bucket → actual win rate) ──");
    for (const bucket of metrics.calibration) {
      if (bucket.approvedCount > 0) {
        lines.push(
          `  ${bucket.range.padEnd(8)} | ${String(bucket.approvedCount).padStart(4)} approved | ${String(bucket.winCount).padStart(3)}W ${String(bucket.lossCount).padStart(3)}L | WR: ${bucket.actualWinRate.toFixed(1)}%`,
        );
      }
    }
    lines.push("");

    if (metrics.drift.length > 0) {
      lines.push("── DRIFT (rolling window) ──");
      for (const d of metrics.drift) {
        const start = new Date(d.windowStart).toLocaleTimeString("pt-BR");
        const end = new Date(d.windowEnd).toLocaleTimeString("pt-BR");
        lines.push(
          `  ${start}→${end} | ${String(d.signalCount).padStart(3)} signals | approval: ${d.approvalRate.toFixed(0)}% | accuracy: ${d.accuracy.toFixed(1)}% | avgScore: ${d.avgDecisionScore.toFixed(1)}`,
        );
      }
      lines.push("");
    }

    if (metrics.perAsset.length > 0) {
      lines.push("── PER ASSET ──");
      for (const a of metrics.perAsset) {
        lines.push(
          `  ${a.asset.padEnd(12)} | ${String(a.total).padStart(5)} total | ${String(a.approved).padStart(4)} approved | accuracy: ${a.accuracy.toFixed(1)}% | avgScore: ${a.avgDecisionScore.toFixed(1)} | avgTime: ${a.avgProcessingTimeMs.toFixed(1)}ms`,
        );
      }
      lines.push("");
    }

    if (metrics.perTimeframe.length > 0) {
      lines.push("── PER TIMEFRAME ──");
      for (const tf of metrics.perTimeframe) {
        lines.push(
          `  ${tf.timeframe.padEnd(6)} | ${String(tf.total).padStart(5)} total | ${String(tf.approved).padStart(4)} approved | accuracy: ${tf.accuracy.toFixed(1)}% | avgScore: ${tf.avgDecisionScore.toFixed(1)}`,
        );
      }
      lines.push("");
    }

    lines.push("── PERFORMANCE ──");
    lines.push(`  Avg processing time:   ${p.avgProcessingTimeMs.toFixed(2)}ms`);
    lines.push(`  P50:                   ${p.p50ProcessingTimeMs.toFixed(2)}ms`);
    lines.push(`  P95:                   ${p.p95ProcessingTimeMs.toFixed(2)}ms`);
    lines.push(`  P99:                   ${p.p99ProcessingTimeMs.toFixed(2)}ms`);
    lines.push(`  Min:                   ${p.minProcessingTimeMs.toFixed(2)}ms`);
    lines.push(`  Max:                   ${p.maxProcessingTimeMs.toFixed(2)}ms`);
    lines.push("");

    lines.push("── VERSIONS ──");
    lines.push(`  Engine:         ${metrics.versions.engine.join(", ")}`);
    lines.push(`  Database:       ${metrics.versions.database.join(", ")}`);
    lines.push(`  Pattern Catalog: ${metrics.versions.patternCatalog.join(", ")}`);
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");

    return lines.join("\n");
  }
}
