/**
 * engine/experiment/CalibrationReport.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Avalia se a confiança (decision score) realmente corresponde ao win rate real.
 * Exemplo: sinais com 90% de confiança deveriam ter ~90% de win rate.
 * Gera alertas quando houver descalibração significativa.
 */

import type { SignalLogEntry, SignalStatus } from "../statistics/signal-log";
import type { CalibrationBucket, CalibrationReport, CalibrationAlert } from "./types";

export class CalibrationAnalyzer {
  /**
   * Gera relatório de calibração a partir de signal log entries.
   */
  analyze(experimentId: string, entries: SignalLogEntry[]): CalibrationReport {
    const approved = entries.filter(
      (e) => e.status === "APPROVED" && (e.result === "WIN" || e.result === "LOSS"),
    );

    const buckets = this.buildBuckets(approved);
    const overallError = this.computeOverallError(buckets);
    const alerts = this.detectAlerts(buckets);

    return {
      experimentId,
      buckets,
      overallCalibrationError: overallError,
      isCalibrated: overallError < 0.15,
      alerts,
    };
  }

  private buildBuckets(approved: SignalLogEntry[]): CalibrationBucket[] {
    const buckets: CalibrationBucket[] = [];
    const bucketSize = 5;

    for (let low = 0; low < 100; low += bucketSize) {
      const high = low + bucketSize;
      const inBucket = approved.filter(
        (e) => e.scores.decisionScore >= low && e.scores.decisionScore < high,
      );
      const wins = inBucket.filter((e) => e.result === "WIN").length;
      const losses = inBucket.filter((e) => e.result === "LOSS").length;
      const count = wins + losses;
      const actualWinRate = count > 0 ? (wins / count) * 100 : 0;
      const expectedWinRate = low + bucketSize / 2;

      buckets.push({
        range: `${low}-${high}`,
        min: low,
        max: high,
        count: inBucket.length,
        approvedCount: inBucket.length,
        winCount: wins,
        lossCount: losses,
        actualWinRate,
        expectedWinRate,
        delta: actualWinRate - expectedWinRate,
      });
    }

    return buckets;
  }

  private computeOverallError(buckets: CalibrationBucket[]): number {
    const withData = buckets.filter((b) => b.approvedCount >= 3);
    if (withData.length === 0) return 0;

    const totalWeight = withData.reduce((s, b) => s + b.approvedCount, 0);
    const weightedError = withData.reduce(
      (s, b) => s + Math.abs(b.delta) * (b.approvedCount / totalWeight),
      0,
    );

    return weightedError / 100;
  }

  private detectAlerts(buckets: CalibrationBucket[]): CalibrationAlert[] {
    const alerts: CalibrationAlert[] = [];

    for (const bucket of buckets) {
      if (bucket.approvedCount < 5) continue;

      const absDelta = Math.abs(bucket.delta);

      if (absDelta > 25) {
        alerts.push({
          bucket: bucket.range,
          expected: bucket.expectedWinRate,
          actual: bucket.actualWinRate,
          severity: "critical",
          message: `Bucket ${bucket.range}: expected ~${bucket.expectedWinRate.toFixed(0)}% WR, got ${bucket.actualWinRate.toFixed(0)}% (Δ ${bucket.delta > 0 ? "+" : ""}${bucket.delta.toFixed(1)}%)`,
        });
      } else if (absDelta > 15) {
        alerts.push({
          bucket: bucket.range,
          expected: bucket.expectedWinRate,
          actual: bucket.actualWinRate,
          severity: "warning",
          message: `Bucket ${bucket.range}: slight descalibration — expected ${bucket.expectedWinRate.toFixed(0)}%, got ${bucket.actualWinRate.toFixed(0)}%`,
        });
      } else if (absDelta > 10) {
        alerts.push({
          bucket: bucket.range,
          expected: bucket.expectedWinRate,
          actual: bucket.actualWinRate,
          severity: "info",
          message: `Bucket ${bucket.range}: minor deviation — expected ${bucket.expectedWinRate.toFixed(0)}%, got ${bucket.actualWinRate.toFixed(0)}%`,
        });
      }
    }

    return alerts;
  }

  /**
   * Formata relatório de calibração como texto.
   */
  formatReport(report: CalibrationReport): string {
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  CALIBRATION REPORT");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`  Calibration Error: ${(report.overallCalibrationError * 100).toFixed(1)}%`);
    lines.push(`  Is Calibrated:     ${report.isCalibrated ? "YES ✓" : "NO ✗"}`);
    lines.push("");

    lines.push("  Range   | Expected | Actual  | Delta   | Samples");
    lines.push("  ─────────┼──────────┼─────────┼─────────┼────────");

    for (const b of report.buckets) {
      if (b.approvedCount < 2) continue;
      const deltaStr = `${b.delta > 0 ? "+" : ""}${b.delta.toFixed(1)}%`;
      lines.push(
        `  ${b.range.padEnd(8)} | ${b.expectedWinRate.toFixed(0).padStart(6)}%  | ${b.actualWinRate.toFixed(0).padStart(5)}%  | ${deltaStr.padStart(7)} | ${b.approvedCount}`,
      );
    }

    lines.push("");

    if (report.alerts.length > 0) {
      lines.push("── ALERTS ──");
      for (const a of report.alerts) {
        const icon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
        lines.push(`  ${icon} ${a.message}`);
      }
    }

    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
  }
}
