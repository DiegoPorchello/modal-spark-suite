/**
 * DirectionScoreAudit — Sistema de auditoria matemática do calcDirectionScore()
 *
 * Coleta dados de cada decisão para análise estatística:
 * - Média, desvio padrão, mediana, máx, mín de CALL/PUT
 * - Correlação Score Total × Direction Score
 * - Heatmap de distribuição
 * - Simulação de thresholds
 * - Identificação de gargalos
 */

export interface AuditEntry {
  timestamp: number;
  asset: string;
  timeframe: string;
  scoreTotal: number;
  band: string;
  trendScore: number;
  trendDirection: string;
  structureScore: number;
  priceActionScore: number;
  smartMoneyScore: number;
  momentumScore: number;
  callScore: number;
  putScore: number;
  minDirection: number;
  result: "CALL" | "PUT" | "NO_CLEAR_DIRECTION" | "LOW_SCORE" | "SIDEWAYS_MARKET" | "MICRO_REVERSAL" | "TREND_VETO" | "MOMENTUM_VETO";
  blockedReason: string | null;
}

export interface AuditStats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
}

export interface BandStats {
  band: string;
  count: number;
  callStats: AuditStats;
  putStats: AuditStats;
  passRate: number;
}

export interface CorrelationResult {
  scoreVsCall: number;
  scoreVsPut: number;
  callVsPut: number;
}

export interface HeatmapCell {
  scoreRange: string;
  directionRange: string;
  count: number;
  percentage: number;
}

export interface SimulationResult {
  threshold: number;
  wouldPass: number;
  total: number;
  passRate: number;
  deltaVsCurrent: number;
}

export interface BottleneckInfo {
  reason: string;
  count: number;
  percentage: number;
}

export interface AuditReport {
  generatedAt: string;
  totalDecisions: number;
  stats: {
    call: AuditStats;
    put: AuditStats;
    scoreTotal: AuditStats;
  };
  bandStats: BandStats[];
  correlation: CorrelationResult;
  heatmap: HeatmapCell[];
  simulations: SimulationResult[];
  bottlenecks: BottleneckInfo[];
  conclusion: {
    thresholdCompatible: boolean;
    explanation: string;
    recommendation: string;
  };
}

export class DirectionScoreAudit {
  private static _entries: AuditEntry[] = [];
  private static readonly MAX_ENTRIES = 10000;

  static record(entry: AuditEntry): void {
    this._entries.push(entry);
    if (this._entries.length > this.MAX_ENTRIES) {
      this._entries = this._entries.slice(-this.MAX_ENTRIES);
    }
  }

  static getEntries(): AuditEntry[] {
    return [...this._entries];
  }

  static clear(): void {
    this._entries = [];
  }

  static calculateStats(values: number[]): AuditStats {
    if (values.length === 0) {
      return { count: 0, mean: 0, median: 0, stdDev: 0, min: 0, max: 0, p25: 0, p75: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const median = count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    const p25 = sorted[Math.floor(count * 0.25)];
    const p75 = sorted[Math.floor(count * 0.75)];
    const min = sorted[0];
    const max = sorted[count - 1];

    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return { count, mean, median, stdDev, min, max, p25, p75 };
  }

  static calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);

    const sumX = xSlice.reduce((a, b) => a + b, 0);
    const sumY = ySlice.reduce((a, b) => a + b, 0);
    const sumXY = xSlice.reduce((acc, xi, i) => acc + xi * ySlice[i], 0);
    const sumX2 = xSlice.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = ySlice.reduce((acc, yi) => acc + yi * yi, 0);

    const num = n * sumXY - sumX * sumY;
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return den === 0 ? 0 : num / den;
  }

  static generateReport(): AuditReport {
    const entries = this._entries;
    const totalDecisions = entries.length;

    if (totalDecisions === 0) {
      return this.emptyReport();
    }

    // Filtrar apenas decisões com score >= 60 (que passaram para cálculo de direção)
    const directionEntries = entries.filter(e =>
      e.result === "CALL" || e.result === "PUT" || e.result === "NO_CLEAR_DIRECTION"
    );

    // Stats gerais
    const callScores = directionEntries.map(e => e.callScore);
    const putScores = directionEntries.map(e => e.putScore);
    const scoreTotals = directionEntries.map(e => e.scoreTotal);

    const stats = {
      call: this.calculateStats(callScores),
      put: this.calculateStats(putScores),
      scoreTotal: this.calculateStats(scoreTotals),
    };

    // Stats por faixa de score
    const bandStats = this.calculateBandStats(directionEntries);

    // Correlação
    const correlation: CorrelationResult = {
      scoreVsCall: this.calculateCorrelation(scoreTotals, callScores),
      scoreVsPut: this.calculateCorrelation(scoreTotals, putScores),
      callVsPut: this.calculateCorrelation(callScores, putScores),
    };

    // Heatmap
    const heatmap = this.generateHeatmap(directionEntries);

    // Simulações
    const simulations = this.simulateThresholds(directionEntries);

    // Gargalos
    const bottlenecks = this.identifyBottlenecks(entries);

    // Conclusão
    const conclusion = this.generateConclusion(stats, simulations, bottlenecks);

    return {
      generatedAt: new Date().toISOString(),
      totalDecisions,
      stats,
      bandStats,
      correlation,
      heatmap,
      simulations,
      bottlenecks,
      conclusion,
    };
  }

  private static calculateBandStats(entries: AuditEntry[]): BandStats[] {
    const bands = ["NAO_OPERAR", "FRACO", "OBSERVACAO", "ENTRADA_PERMITIDA", "ENTRADA_FORTE"];

    return bands.map(band => {
      const bandEntries = entries.filter(e => e.band === band);
      const callScores = bandEntries.map(e => e.callScore);
      const putScores = bandEntries.map(e => e.putScore);

      const passCount = bandEntries.filter(e =>
        e.result === "CALL" || e.result === "PUT"
      ).length;

      return {
        band,
        count: bandEntries.length,
        callStats: this.calculateStats(callScores),
        putStats: this.calculateStats(putScores),
        passRate: bandEntries.length > 0 ? (passCount / bandEntries.length) * 100 : 0,
      };
    });
  }

  private static generateHeatmap(entries: AuditEntry[]): HeatmapCell[] {
    const scoreRanges = ["60-69", "70-79", "80-89", "90-100"];
    const directionRanges = ["0-14", "15-29", "30-44", "45-59", "60-74", "75-100"];

    const cells: HeatmapCell[] = [];

    for (const scoreRange of scoreRanges) {
      const [sMin, sMax] = scoreRange.split("-").map(Number);
      const scoreEntries = entries.filter(e => e.scoreTotal >= sMin && e.scoreTotal <= sMax);

      for (const dirRange of directionRanges) {
        const [dMin, dMax] = dirRange.split("-").map(Number);

        // Contar CALL neste range
        const callCount = scoreEntries.filter(e =>
          e.callScore >= dMin && e.callScore <= dMax
        ).length;

        // Contar PUT neste range
        const putCount = scoreEntries.filter(e =>
          e.putScore >= dMin && e.putScore <= dMax
        ).length;

        const totalInRange = callCount + putCount;
        const percentage = scoreEntries.length > 0
          ? (totalInRange / (scoreEntries.length * 2)) * 100
          : 0;

        cells.push({
          scoreRange,
          directionRange: dirRange,
          count: totalInRange,
          percentage,
        });
      }
    }

    return cells;
  }

  private static simulateThresholds(entries: AuditEntry[]): SimulationResult[] {
    const thresholds = [40, 35, 30, 25];
    const currentThreshold = 30;

    return thresholds.map(threshold => {
      const wouldPass = entries.filter(e => {
        const maxDir = Math.max(e.callScore, e.putScore);
        return maxDir >= threshold;
      }).length;

      const currentPass = entries.filter(e => {
        const maxDir = Math.max(e.callScore, e.putScore);
        return maxDir >= currentThreshold;
      }).length;

      return {
        threshold,
        wouldPass,
        total: entries.length,
        passRate: entries.length > 0 ? (wouldPass / entries.length) * 100 : 0,
        deltaVsCurrent: wouldPass - currentPass,
      };
    });
  }

  private static identifyBottlenecks(entries: AuditEntry[]): BottleneckInfo[] {
    const reasons: Record<string, number> = {};

    for (const entry of entries) {
      const reason = entry.result;
      reasons[reason] = (reasons[reason] || 0) + 1;
    }

    const total = entries.length;

    return Object.entries(reasons)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private static generateConclusion(
    stats: { call: AuditStats; put: AuditStats; scoreTotal: AuditStats },
    simulations: SimulationResult[],
    bottlenecks: BottleneckInfo[]
  ): AuditReport["conclusion"] {
    const noClearDir = bottlenecks.find(b => b.reason === "NO_CLEAR_DIRECTION");
    const noClearDirPct = noClearDir?.percentage ?? 0;

    // Verificar se o threshold é compatível
    const sim40 = simulations.find(s => s.threshold === 40);
    const sim35 = simulations.find(s => s.threshold === 35);

    const passRateAt40 = sim40?.passRate ?? 0;
    const passRateAt35 = sim35?.passRate ?? 0;

    // Critérios de conclusão
    const highBlockRate = noClearDirPct > 30;
    const callMeanLow = stats.call.mean < 40;
    const bigGapAt40 = passRateAt40 - passRateAt40 > 20;

    const thresholdCompatible = !highBlockRate && !callMeanLow;

    let explanation = "";
    let recommendation = "";

    if (thresholdCompatible) {
      explanation = `O threshold de 30 é compatível. ` +
        `CALL médio = ${stats.call.mean.toFixed(1)}, ` +
        `bloqueio por NO_CLEAR_DIRECTION = ${noClearDirPct.toFixed(1)}%. ` +
        `A maioria das decisões atinge o mínimo.`;
      recommendation = "Manter threshold atual (30).";
    } else {
      explanation = `O threshold de 30 NÃO é compatível. ` +
        `CALL médio = ${stats.call.mean.toFixed(1)} (mínimo 30), ` +
        `bloqueio por NO_CLEAR_DIRECTION = ${noClearDirPct.toFixed(1)}%. ` +
        `Com threshold 40, libera ${sim40?.wouldPass ?? 0} operações (${passRateAt40.toFixed(1)}%). ` +
        `Com threshold 35, libera ${sim35?.wouldPass ?? 0} operações (${passRateAt35.toFixed(1)}%).`;

      if (passRateAt40 > 70) {
        recommendation = "Recomendar threshold 40 (ganho significativo com baixo risco).";
      } else if (passRateAt35 > 70) {
        recommendation = "Recomendar threshold 35 (ganho moderado).";
      } else {
        recommendation = "Revisar calcDirectionScore() — distribuição muito dispersa.";
      }
    }

    return {
      thresholdCompatible,
      explanation,
      recommendation,
    };
  }

  private static emptyReport(): AuditReport {
    return {
      generatedAt: new Date().toISOString(),
      totalDecisions: 0,
      stats: {
        call: this.calculateStats([]),
        put: this.calculateStats([]),
        scoreTotal: this.calculateStats([]),
      },
      bandStats: [],
      correlation: { scoreVsCall: 0, scoreVsPut: 0, callVsPut: 0 },
      heatmap: [],
      simulations: [],
      bottlenecks: [],
      conclusion: {
        thresholdCompatible: true,
        explanation: "Nenhuma decisão coletada ainda.",
        recommendation: "Aguardar dados.",
      },
    };
  }
}
