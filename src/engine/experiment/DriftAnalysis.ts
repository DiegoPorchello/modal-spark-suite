/**
 * engine/experiment/DriftAnalysis.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Detecta degradação de performance ao longo do tempo.
 * Compara períodos recentes vs históricos para identificar drift.
 */

import type { SignalLogEntry } from "../statistics/signal-log";
import type { DriftPoint, DriftAnalysis, DriftAlert } from "./types";

export class DriftAnalyzer {
  /**
   * Analisa drift em um conjunto de signal log entries.
   * Compara janelas recentes vs históricas.
   */
  analyze(experimentId: string, entries: SignalLogEntry[], windowSize: number = 50): DriftAnalysis {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const points = this.buildDriftPoints(sorted, windowSize);
    const { hasDrift, magnitude } = this.detectDrift(points);
    const alerts = this.generateAlerts(points);

    return {
      experimentId,
      points,
      hasDrift,
      driftMagnitude: magnitude,
      alerts,
    };
  }

  private buildDriftPoints(entries: SignalLogEntry[], windowSize: number): DriftPoint[] {
    if (entries.length < windowSize) return [];

    const points: DriftPoint[] = [];
    const step = Math.max(1, Math.floor(windowSize / 2));

    for (let i = 0; i <= entries.length - windowSize; i += step) {
      const window = entries.slice(i, i + windowSize);
      const approved = window.filter((e) => e.status === "APPROVED");
      const evaluated = window.filter((e) => e.result === "WIN" || e.result === "LOSS");
      const wins = evaluated.filter((e) => e.result === "WIN").length;

      points.push({
        windowStart: window[0].timestamp,
        windowEnd: window[window.length - 1].timestamp,
        signalCount: window.length,
        approvalRate: (approved.length / window.length) * 100,
        accuracy: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
        avgDecisionScore: window.reduce((s, e) => s + e.scores.decisionScore, 0) / window.length,
        winRate:
          approved.length > 0
            ? (approved.filter((e) => e.result === "WIN").length /
                approved.filter((e) => e.result === "WIN" || e.result === "LOSS").length) *
              100
            : 0,
      });
    }

    return points;
  }

  private detectDrift(points: DriftPoint[]): {
    hasDrift: boolean;
    magnitude: number;
  } {
    if (points.length < 4) return { hasDrift: false, magnitude: 0 };

    const recent = points.slice(-3);
    const historical = points.slice(0, -3);

    if (historical.length === 0 || recent.length === 0) {
      return { hasDrift: false, magnitude: 0 };
    }

    const avgRecentAccuracy = recent.reduce((s, p) => s + p.accuracy, 0) / recent.length;
    const avgHistoricalAccuracy =
      historical.reduce((s, p) => s + p.accuracy, 0) / historical.length;

    const avgRecentWinRate = recent.reduce((s, p) => s + p.winRate, 0) / recent.length;
    const avgHistoricalWinRate = historical.reduce((s, p) => s + p.winRate, 0) / historical.length;

    const accuracyDelta = avgHistoricalAccuracy - avgRecentAccuracy;
    const winRateDelta = avgHistoricalWinRate - avgRecentWinRate;

    const magnitude = Math.max(accuracyDelta, winRateDelta);
    const hasDrift = magnitude > 10;

    return { hasDrift, magnitude };
  }

  private generateAlerts(points: DriftPoint[]): DriftAlert[] {
    const alerts: DriftAlert[] = [];
    if (points.length < 4) return alerts;

    const recent = points.slice(-3);
    const historical = points.slice(0, -3);

    if (historical.length === 0) return alerts;

    const metrics: { name: string; accessor: (p: DriftPoint) => number }[] = [
      { name: "accuracy", accessor: (p) => p.accuracy },
      { name: "winRate", accessor: (p) => p.winRate },
      { name: "approvalRate", accessor: (p) => p.approvalRate },
    ];

    for (const m of metrics) {
      const recentAvg = recent.reduce((s, p) => s + m.accessor(p), 0) / recent.length;
      const histAvg = historical.reduce((s, p) => s + m.accessor(p), 0) / historical.length;

      const change = histAvg - recentAvg;

      if (change > 15) {
        alerts.push({
          metric: m.name,
          recentValue: recentAvg,
          historicalValue: histAvg,
          change,
          severity: "critical",
          message: `${m.name} dropped ${change.toFixed(1)}pp — from ${histAvg.toFixed(1)}% to ${recentAvg.toFixed(1)}%`,
        });
      } else if (change > 8) {
        alerts.push({
          metric: m.name,
          recentValue: recentAvg,
          historicalValue: histAvg,
          change,
          severity: "warning",
          message: `${m.name} declining: ${histAvg.toFixed(1)}% → ${recentAvg.toFixed(1)}% (${change.toFixed(1)}pp drop)`,
        });
      } else if (change > 5) {
        alerts.push({
          metric: m.name,
          recentValue: recentAvg,
          historicalValue: histAvg,
          change,
          severity: "info",
          message: `${m.name} slight decline: ${histAvg.toFixed(1)}% → ${recentAvg.toFixed(1)}%`,
        });
      }
    }

    return alerts;
  }

  /**
   * Formata relatório de drift como texto.
   */
  formatReport(analysis: DriftAnalysis): string {
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  DRIFT ANALYSIS REPORT");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`  Drift Detected: ${analysis.hasDrift ? "YES ⚠️" : "NO ✓"}`);
    lines.push(`  Drift Magnitude: ${analysis.driftMagnitude.toFixed(1)}pp`);
    lines.push("");

    if (analysis.points.length > 0) {
      lines.push("  Window                  | Signals | Approval | Accuracy | WinRate");
      lines.push("  ────────────────────────┼─────────┼──────────┼──────────┼────────");

      for (const p of analysis.points.slice(-10)) {
        const start = new Date(p.windowStart).toLocaleString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const end = new Date(p.windowEnd).toLocaleString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        lines.push(
          `  ${start}→${end}   | ${String(p.signalCount).padStart(5)}  | ${p.approvalRate.toFixed(0).padStart(6)}%  | ${p.accuracy.toFixed(1).padStart(6)}%  | ${p.winRate.toFixed(1).padStart(5)}%`,
        );
      }
    }

    lines.push("");

    if (analysis.alerts.length > 0) {
      lines.push("── ALERTS ──");
      for (const a of analysis.alerts) {
        const icon = a.severity === "critical" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵";
        lines.push(`  ${icon} ${a.message}`);
      }
    }

    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
  }
}
