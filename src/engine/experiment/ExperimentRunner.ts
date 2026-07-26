/**
 * engine/experiment/ExperimentRunner.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Executor independente de experimentos.
 * Faz replay de dados de candles através do HybridProbabilityEngine,
 * registrando sinais via SignalLogger e gerando métricas via ValidationSummary.
 *
 * FLUXO:
 *   Experiment Config
 *   → Load Candle Data
 *   → Sliding Window Replay
 *   → HybridProbabilityEngine.analyze()
 *   → Signal Logger
 *   → Outcome Determination (WIN/LOSS/DRAW)
 *   → Validation Summary → Experiment Metrics
 */

import { HybridProbabilityEngine } from "../decision/HybridProbabilityEngine";
import type { HybridProbabilityConfig } from "../decision/HybridProbabilityEngine";
import type { Candle } from "../../market/types";
import { JsonlSignalStorage } from "../statistics/signal-log";
import type { SignalLogEntry } from "../statistics/signal-log";
import { ValidationSummary } from "../statistics/validation-summary";
import type { ValidationMetrics } from "../statistics/validation-summary";
import type { ExperimentConfig, ExperimentResult, ExperimentMetrics } from "./types";

const DEFAULT_CONFIG: HybridProbabilityConfig = {
  flowIndexWindow: 20,
  adxMin: 25,
  atrMin: 1.0,
  ema200Enabled: true,
  flowIndexMin: 0.55,
  minScore: 75,
  historySize: 2000,
  probabilityWeight: 0.2,
};

export class ExperimentRunner {
  /**
   * Executa um experimento individual.
   * Retorna o resultado com métricas calculadas.
   */
  async run(config: ExperimentConfig, candleData: Candle[]): Promise<ExperimentResult> {
    const result: ExperimentResult = {
      config,
      status: "running",
      metrics: this.emptyMetrics(),
      signalLogPath: "",
      startedAt: Date.now(),
      completedAt: null,
    };

    try {
      const engineConfig: HybridProbabilityConfig = {
        ...DEFAULT_CONFIG,
        ...config.engineOverrides,
        historySize: config.historySize,
        probabilityWeight: config.probabilityWeight,
      };

      const engine = new HybridProbabilityEngine();
      const signals: SignalLogEntry[] = [];
      const step = Math.max(1, Math.floor(config.historySize * 0.1));

      const minCandles = config.historySize + 50;
      if (candleData.length < minCandles) {
        result.status = "failed";
        result.error = `Insufficient candle data: need ${minCandles}, got ${candleData.length}`;
        result.completedAt = Date.now();
        return result;
      }

      let nextId = 0;

      for (let i = config.historySize; i < candleData.length - 50; i += step) {
        const window = candleData.slice(i - config.historySize, i);
        const analysis = engine.analyze(window, config.asset, config.timeframe);

        const nextCandle = candleData[i];
        const entryPrice = window[window.length - 1]?.close ?? 0;
        const outcomePrice = nextCandle?.close ?? entryPrice;

        let result: "WIN" | "LOSS" | "DRAW" | "PENDING" | null = "PENDING";
        if (analysis.status === "liberado" && analysis.direction) {
          if (analysis.direction === "CALL") {
            result =
              outcomePrice > entryPrice ? "WIN" : outcomePrice < entryPrice ? "LOSS" : "DRAW";
          } else {
            result =
              outcomePrice < entryPrice ? "WIN" : outcomePrice > entryPrice ? "LOSS" : "DRAW";
          }
        }

        const signalEntry: SignalLogEntry = {
          id: `exp_${Date.now()}_${++nextId}`,
          timestamp: Date.now(),
          engineVersion: config.engineVersion,
          databaseVersion: config.databaseVersion,
          patternCatalogVersion: config.patternCatalogVersion,
          asset: config.asset,
          timeframe: config.timeframe,
          status: analysis.signalStatus,
          direction: analysis.direction,
          blockedReasons: analysis.blockedReasons,
          setup: analysis.setup,
          indicators: analysis.indicators,
          pattern: {
            id: "",
            name: "",
            occurrences: analysis.historicalPatterns,
            winRate: analysis.historicalWinrate ?? 0,
            confidence: analysis.probabilityScore.breakdown.confidence,
          },
          scores: {
            technicalScore: analysis.technicalScore.total,
            probabilityScore: analysis.probabilityScore.total,
            decisionScore: analysis.decisionScore.total,
            probabilityWeight: config.probabilityWeight,
          },
          filters: analysis.signalFilters,
          config: engineConfig,
          candlesUsed: analysis.candlesUsed,
          processingTimeMs: analysis.processingTimeMs,
          result,
          orderId: null,
          decisionId: null,
          decisionTree: analysis.decisionTree,
        };

        signals.push(signalEntry);
      }

      result.signalLogPath = `experiments/${config.experimentId}.jsonl`;
      result.metrics = this.calculateMetrics(signals, config);
      result.status = "completed";
      result.completedAt = Date.now();
    } catch (err) {
      result.status = "failed";
      result.error = err instanceof Error ? err.message : String(err);
      result.completedAt = Date.now();
    }

    return result;
  }

  /**
   * Executa um experimento usando o ValidationSummary existente.
   */
  runFromEntries(config: ExperimentConfig, entries: SignalLogEntry[]): ExperimentResult {
    const result: ExperimentResult = {
      config,
      status: "completed",
      metrics: this.calculateMetrics(entries, config),
      signalLogPath: "",
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
    return result;
  }

  /**
   * Calcula métricas de experimento a partir de signal log entries.
   */
  calculateMetrics(entries: SignalLogEntry[], config: ExperimentConfig): ExperimentMetrics {
    if (entries.length === 0) return this.emptyMetrics();

    const approved = entries.filter((e) => e.status === "APPROVED");
    const blocked = entries.filter((e) => e.status !== "APPROVED");

    const evaluated = entries.filter((e) => e.result === "WIN" || e.result === "LOSS");
    const approvedEvaluated = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");

    const wins = evaluated.filter((e) => e.result === "WIN").length;
    const losses = evaluated.filter((e) => e.result === "LOSS").length;
    const draws = entries.filter((e) => e.result === "DRAW").length;

    const tp = approvedEvaluated.filter((e) => e.result === "WIN").length;
    const fp = approvedEvaluated.filter((e) => e.result === "LOSS").length;
    const fn = blocked.filter((e) => e.result === "WIN").length;

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const avgDecisionScore =
      entries.reduce((s, e) => s + e.scores.decisionScore, 0) / entries.length;
    const avgProbabilityScore =
      entries.reduce((s, e) => s + e.scores.probabilityScore, 0) / entries.length;
    const avgTechnicalScore =
      entries.reduce((s, e) => s + e.scores.technicalScore, 0) / entries.length;

    let netProfit = 0;
    let maxDrawdown = 0;
    let peak = 0;
    const profits: number[] = [];

    for (const entry of approvedEvaluated) {
      const profit = entry.result === "WIN" ? 1 : -1;
      profits.push(profit);
      netProfit += profit;
      peak = Math.max(peak, netProfit);
      maxDrawdown = Math.max(maxDrawdown, peak - netProfit);
    }

    const profitFactor = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0;
    const avgProfit = approvedEvaluated.length > 0 ? netProfit / approvedEvaluated.length : 0;

    return {
      totalSignals: entries.length,
      approved: approved.length,
      blocked: blocked.length,
      insufficientData: entries.filter((e) => e.status === "INSUFFICIENT_DATA").length,
      lowConfidence: entries.filter((e) => e.status === "LOW_CONFIDENCE").length,
      technicalRejection: entries.filter((e) => e.status === "TECHNICAL_REJECTION").length,
      accuracy: evaluated.length > 0 ? (wins / evaluated.length) * 100 : 0,
      precision: precision * 100,
      recall: recall * 100,
      f1Score: f1Score * 100,
      winRate: approvedEvaluated.length > 0 ? (tp / approvedEvaluated.length) * 100 : 0,
      totalWins: wins,
      totalLosses: losses,
      totalDraws: draws,
      profitFactor,
      maxDrawdown,
      avgProfit,
      netProfit,
      avgDecisionScore,
      avgProbabilityScore,
      avgTechnicalScore,
      avgProcessingTimeMs: entries.reduce((s, e) => s + e.processingTimeMs, 0) / entries.length,
      calibrationScore: this.computeCalibrationScore(approved),
      driftScore: 0,
    };
  }

  private computeCalibrationScore(approved: SignalLogEntry[]): number {
    const withResults = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");
    if (withResults.length < 5) return 0;

    let totalError = 0;
    let buckets = 0;

    for (let low = 0; low < 100; low += 10) {
      const inBucket = withResults.filter(
        (e) => e.scores.decisionScore >= low && e.scores.decisionScore < low + 10,
      );
      if (inBucket.length < 3) continue;

      const expected = (low + 5) / 100;
      const actualWinRate = inBucket.filter((e) => e.result === "WIN").length / inBucket.length;
      totalError += Math.abs(expected - actualWinRate);
      buckets++;
    }

    return buckets > 0 ? 1 - totalError / buckets : 0;
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
