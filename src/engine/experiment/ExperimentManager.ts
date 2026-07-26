/**
 * engine/experiment/ExperimentManager.ts
 *
 * PHASE XXIV — Experiment Framework & Optimization
 *
 * Gerencia a criação, controle e armazenamento de experimentos.
 * Fornece API para criar, listar, obter, cancelar e remover experimentos.
 */

import {
  ENGINE_VERSION,
  DATABASE_VERSION,
  PATTERN_CATALOG_VERSION,
} from "../statistics/signal-log";
import type {
  ExperimentConfig,
  ExperimentResult,
  ExperimentStatus,
  ExperimentMetrics,
  GridSearchConfig,
} from "./types";
import { EXPERIMENT_FRAMEWORK_VERSION } from "./types";

let _nextId = 0;

function generateExperimentId(): string {
  return `exp_${Date.now()}_${++_nextId}`;
}

export class ExperimentManager {
  private experiments: Map<string, ExperimentResult> = new Map();

  /**
   * Cria um novo experimento com configuração especificada.
   */
  createExperiment(
    overrides: Partial<ExperimentConfig> & {
      asset: string;
      timeframe: string;
      profile: string;
      historySize: number;
      probabilityWeight: number;
    },
  ): ExperimentResult {
    const id = generateExperimentId();
    const config: ExperimentConfig = {
      experimentId: id,
      experimentName: overrides.experimentName ?? `Experiment ${id}`,
      description: overrides.description ?? "",
      engineVersion: overrides.engineVersion ?? ENGINE_VERSION,
      databaseVersion: overrides.databaseVersion ?? DATABASE_VERSION,
      patternCatalogVersion: overrides.patternCatalogVersion ?? PATTERN_CATALOG_VERSION,
      historySize: overrides.historySize,
      probabilityWeight: overrides.probabilityWeight,
      asset: overrides.asset,
      timeframe: overrides.timeframe,
      profile: overrides.profile,
      startDate: overrides.startDate ?? new Date().toISOString(),
      endDate: overrides.endDate ?? "",
      engineOverrides: overrides.engineOverrides ?? {},
      candleDataPath: overrides.candleDataPath,
    };

    const result: ExperimentResult = {
      config,
      status: "created",
      metrics: this.emptyMetrics(),
      signalLogPath: "",
      startedAt: Date.now(),
      completedAt: null,
    };

    this.experiments.set(id, result);
    return result;
  }

  /**
   * Cria todos os experimentos para um GridSearch.
   * Retorna as configs geradas (não executa).
   */
  generateGridSearchConfigs(gridConfig: GridSearchConfig): ExperimentConfig[] {
    const configs: ExperimentConfig[] = [];
    const combos = this.cartesianProduct(gridConfig.dimensions.map((d) => d.values));

    for (const combo of combos) {
      const engineOverrides: Record<string, number> = {};
      let historySize = gridConfig.baseHistorySize;
      let probabilityWeight = gridConfig.baseProbabilityWeight;

      gridConfig.dimensions.forEach((dim, i) => {
        const val = combo[i];
        if (dim.field === "historySize") {
          historySize = val;
        } else if (dim.field === "probabilityWeight") {
          probabilityWeight = val;
        } else {
          engineOverrides[dim.field as string] = val;
        }
      });

      const id = generateExperimentId();
      configs.push({
        experimentId: id,
        experimentName: `${gridConfig.name} — ${combo.map((v, i) => `${gridConfig.dimensions[i].name}=${v}`).join(", ")}`,
        description: `Auto-generated grid search experiment`,
        engineVersion: ENGINE_VERSION,
        databaseVersion: DATABASE_VERSION,
        patternCatalogVersion: PATTERN_CATALOG_VERSION,
        historySize,
        probabilityWeight,
        asset: gridConfig.asset,
        timeframe: gridConfig.timeframe,
        profile: gridConfig.profile,
        startDate: new Date().toISOString(),
        endDate: "",
        engineOverrides: engineOverrides as Partial<Record<string, number>>,
        candleDataPath: gridConfig.candleDataPath,
      });
    }

    return configs;
  }

  /**
   * Registra o resultado de um experimento.
   */
  recordResult(result: ExperimentResult): void {
    this.experiments.set(result.config.experimentId, result);
  }

  /**
   * Atualiza o status de um experimento.
   */
  updateStatus(id: string, status: ExperimentStatus): void {
    const exp = this.experiments.get(id);
    if (!exp) return;
    exp.status = status;
    if (status === "completed" || status === "failed") {
      exp.completedAt = Date.now();
    }
  }

  /**
   * Retorna um experimento por ID.
   */
  get(id: string): ExperimentResult | undefined {
    return this.experiments.get(id);
  }

  /**
   * Retorna todos os experimentos.
   */
  getAll(): ExperimentResult[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Retorna experimentos por status.
   */
  getByStatus(status: ExperimentStatus): ExperimentResult[] {
    return this.getAll().filter((e) => e.status === status);
  }

  /**
   * Retorna experimentos completados.
   */
  getCompleted(): ExperimentResult[] {
    return this.getByStatus("completed");
  }

  /**
   * Remove um experimento.
   */
  remove(id: string): boolean {
    return this.experiments.delete(id);
  }

  /**
   * Limpa todos os experimentos.
   */
  clear(): void {
    this.experiments.clear();
  }

  /**
   * Retorna a contagem de experimentos.
   */
  count(): number {
    return this.experiments.size;
  }

  // ── Helpers ──

  private cartesianProduct(arrays: number[][]): number[][] {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restProduct = this.cartesianProduct(rest);
    const result: number[][] = [];
    for (const val of first) {
      for (const combo of restProduct) {
        result.push([val, ...combo]);
      }
    }
    return result;
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

/** Singleton global para uso na aplicação */
export const experimentManager = new ExperimentManager();
