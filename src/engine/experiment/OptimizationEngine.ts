/**
 * engine/experiment/OptimizationEngine.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Gera recomendações automáticas de otimização baseadas nos resultados
 * de múltiplos experimentos. Identifica parâmetros que podem ser melhorados
 * e quantifica o impacto esperado.
 */

import type { ExperimentResult, ExperimentMetrics } from "./types";
import type { OptimizationSuggestion, OptimizationReport } from "./types";

const PARAM_RANGES: Record<string, { min: number; max: number; step: number }> = {
  historySize: { min: 500, max: 3000, step: 100 },
  probabilityWeight: { min: 0.05, max: 0.5, step: 0.05 },
  adxMin: { min: 15, max: 40, step: 5 },
  atrMin: { min: 0.5, max: 3.0, step: 0.5 },
  flowIndexMin: { min: 0.3, max: 0.8, step: 0.05 },
  minScore: { min: 60, max: 90, step: 5 },
  flowIndexWindow: { min: 10, max: 50, step: 10 },
};

export class OptimizationEngine {
  private results: ExperimentResult[];

  constructor(results: ExperimentResult[]) {
    this.results = results.filter((r) => r.status === "completed");
  }

  /**
   * Gera relatório completo de otimização.
   */
  generate(currentId: string): OptimizationReport {
    const current = this.results.find((r) => r.config.experimentId === currentId);
    if (!current) {
      return {
        experimentId: currentId,
        currentMetrics: this.emptyMetrics(),
        suggestions: [],
        generatedAt: Date.now(),
      };
    }

    const suggestions: OptimizationSuggestion[] = [];

    const histSuggestion = this.analyzeParameter(
      "historySize",
      current.config.historySize,
      current.metrics,
    );
    if (histSuggestion) suggestions.push(histSuggestion);

    const pwSuggestion = this.analyzeParameter(
      "probabilityWeight",
      current.config.probabilityWeight,
      current.metrics,
    );
    if (pwSuggestion) suggestions.push(pwSuggestion);

    const adxSuggestion = this.analyzeParameter(
      "adxMin",
      current.config.engineOverrides.adxMin ?? 25,
      current.metrics,
    );
    if (adxSuggestion) suggestions.push(adxSuggestion);

    const atrSuggestion = this.analyzeParameter(
      "atrMin",
      current.config.engineOverrides.atrMin ?? 1.0,
      current.metrics,
    );
    if (atrSuggestion) suggestions.push(atrSuggestion);

    const fiSuggestion = this.analyzeParameter(
      "flowIndexMin",
      current.config.engineOverrides.flowIndexMin ?? 0.55,
      current.metrics,
    );
    if (fiSuggestion) suggestions.push(fiSuggestion);

    const msSuggestion = this.analyzeParameter(
      "minScore",
      current.config.engineOverrides.minScore ?? 75,
      current.metrics,
    );
    if (msSuggestion) suggestions.push(msSuggestion);

    return {
      experimentId: currentId,
      currentMetrics: current.metrics,
      suggestions,
      generatedAt: Date.now(),
    };
  }

  private analyzeParameter(
    paramName: string,
    currentValue: number,
    currentMetrics: ExperimentMetrics,
  ): OptimizationSuggestion | null {
    const related = this.results.filter((r) => {
      const paramValue = this.getParamValue(r, paramName);
      return paramValue !== null && paramValue !== currentValue;
    });

    if (related.length < 2) return null;

    const better = related.filter((r) => {
      return (
        r.metrics.accuracy > currentMetrics.accuracy ||
        r.metrics.profitFactor > currentMetrics.profitFactor
      );
    });

    if (better.length === 0) return null;

    const bestRelated = better.reduce((best, r) =>
      r.metrics.accuracy + r.metrics.profitFactor * 10 >
      best.metrics.accuracy + best.metrics.profitFactor * 10
        ? r
        : best,
    );

    const suggestedValue = this.getParamValue(bestRelated, paramName);
    if (suggestedValue === null) return null;

    const accuracyDelta = bestRelated.metrics.accuracy - currentMetrics.accuracy;
    const profitDelta = bestRelated.metrics.profitFactor - currentMetrics.profitFactor;
    const drawdownDelta = bestRelated.metrics.maxDrawdown - currentMetrics.maxDrawdown;

    const confidence =
      accuracyDelta > 5
        ? ("high" as const)
        : accuracyDelta > 2
          ? ("medium" as const)
          : ("low" as const);

    return {
      parameter: paramName,
      currentValue,
      suggestedValue,
      justification: `Experiment ${bestRelated.config.experimentId.slice(-6)} with ${paramName}=${suggestedValue} achieved +${accuracyDelta.toFixed(1)}% accuracy`,
      expectedImpact: {
        accuracy: accuracyDelta,
        profitFactor: profitDelta,
        drawdown: drawdownDelta,
      },
      confidence,
    };
  }

  private getParamValue(result: ExperimentResult, paramName: string): number | null {
    switch (paramName) {
      case "historySize":
        return result.config.historySize;
      case "probabilityWeight":
        return result.config.probabilityWeight;
      default: {
        const val =
          result.config.engineOverrides[paramName as keyof typeof result.config.engineOverrides];
        return typeof val === "number" ? val : null;
      }
    }
  }

  /**
   * Formata relatório de otimização como texto.
   */
  formatReport(report: OptimizationReport): string {
    const lines: string[] = [];
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  OPTIMIZATION SUGGESTIONS");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`  Current Accuracy:      ${report.currentMetrics.accuracy.toFixed(1)}%`);
    lines.push(`  Current Profit Factor: ${report.currentMetrics.profitFactor.toFixed(2)}`);
    lines.push(`  Current Max Drawdown:  ${report.currentMetrics.maxDrawdown.toFixed(0)}`);
    lines.push("");

    if (report.suggestions.length === 0) {
      lines.push("  No optimization suggestions found.");
      lines.push("  Run more experiments to generate recommendations.");
    } else {
      for (const s of report.suggestions) {
        const confIcon = s.confidence === "high" ? "🟢" : s.confidence === "medium" ? "🟡" : "🔴";
        lines.push(`  ${confIcon} ${s.parameter}:`);
        lines.push(`     Current:     ${s.currentValue}`);
        lines.push(`     Suggested:   ${s.suggestedValue}`);
        lines.push(`     Justification: ${s.justification}`);
        lines.push(
          `     Expected: +${s.expectedImpact.accuracy.toFixed(1)}% accuracy, +${s.expectedImpact.profitFactor.toFixed(2)} PF, ${s.expectedImpact.drawdown > 0 ? "+" : ""}${s.expectedImpact.drawdown.toFixed(0)} drawdown`,
        );
        lines.push("");
      }
    }

    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
  }

  private emptyMetrics(): ExperimentMetrics {
    return {
      totalSignals: 0,
      approved: 0,
      blocked: 0,
      insufficientData: 0,
      lowConfidence: 0,
      technicalRejection: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      winRate: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      avgProfit: 0,
      netProfit: 0,
      avgDecisionScore: 0,
      avgProbabilityScore: 0,
      avgTechnicalScore: 0,
      avgProcessingTimeMs: 0,
      calibrationScore: 0,
      driftScore: 0,
    };
  }
}
