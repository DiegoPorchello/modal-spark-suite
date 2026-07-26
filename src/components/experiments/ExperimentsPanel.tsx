import React, { useState, useCallback } from "react";
import {
  FlaskConical,
  Play,
  Square,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRobot } from "../../hooks/useRobot";
import {
  experimentManager,
  ExperimentRunner,
  ExperimentComparator,
  ExperimentRanking,
  CalibrationAnalyzer,
  DriftAnalyzer,
  OptimizationEngine,
  exportToJSON,
  exportToCSV,
} from "../../engine/experiment";
import type {
  ExperimentConfig,
  ExperimentResult,
  GridSearchConfig,
  RankingEntry,
} from "../../engine/experiment";
import { ENGINE_VERSION } from "../../engine/statistics/signal-log";
import { signalLogger } from "../../engine/statistics/signal-log";

// ═══════════════════════════════════════════════════════════════════
// Metric Card
// ═══════════════════════════════════════════════════════════════════

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "danger" | "warning" | "neutral";
}) {
  const color =
    accent === "success"
      ? "text-success"
      : accent === "danger"
        ? "text-danger"
        : accent === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ExperimentRow
// ═══════════════════════════════════════════════════════════════════

function ExperimentRow({
  result,
  isSelected,
  onSelect,
}: {
  result: ExperimentResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusIcon =
    result.status === "completed" ? (
      <CheckCircle2 className="size-4 text-success" />
    ) : result.status === "failed" ? (
      <XCircle className="size-4 text-danger" />
    ) : result.status === "running" ? (
      <Loader2 className="size-4 text-info animate-spin" />
    ) : (
      <span className="size-4 rounded-full border border-muted-foreground" />
    );

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${
        isSelected
          ? "bg-success/10 text-success border border-success/30"
          : "text-foreground hover:bg-accent/40"
      }`}
    >
      {statusIcon}
      <span className="flex-1 truncate font-medium">{result.config.experimentName}</span>
      {result.status === "completed" && (
        <span className="tabular-nums text-muted-foreground">
          {result.metrics.accuracy.toFixed(1)}%
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main ExperimentsPanel
// ═══════════════════════════════════════════════════════════════════

export function ExperimentsPanel() {
  const { state: robotState } = useRobot();
  const [experiments, setExperiments] = useState<ExperimentResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "ranking" | "calibration" | "drift" | "optimize"
  >("overview");

  const selected = experiments.find((e) => e.config.experimentId === selectedId);

  const handleCreateExperiment = useCallback(() => {
    const cfg = robotState.config;
    const hpCfg = cfg.hybridProbabilityConfig;
    const exp = experimentManager.createExperiment({
      experimentName: `Manual ${new Date().toLocaleTimeString("pt-BR")}`,
      description: "Manual experiment from dashboard",
      asset: cfg.asset ?? "EURUSD",
      timeframe: cfg.timeframes?.[0] ?? "M1",
      profile: cfg.operationProfile ?? "AUTO",
      historySize: hpCfg?.historySize ?? 2000,
      probabilityWeight: hpCfg?.probabilityWeight ?? 0.2,
      engineOverrides: hpCfg ?? {},
    });
    setExperiments((prev) => [...prev, exp]);
    setSelectedId(exp.config.experimentId);
  }, [robotState]);

  const handleRunGridSearch = useCallback(() => {
    const cfg = robotState.config;
    const hpCfg = cfg.hybridProbabilityConfig;
    const gridConfig: GridSearchConfig = {
      name: "Grid Search",
      description: "Automatic parameter sweep",
      asset: cfg.asset ?? "EURUSD",
      timeframe: cfg.timeframes?.[0] ?? "M1",
      profile: cfg.operationProfile ?? "AUTO",
      dimensions: [
        {
          name: "historySize",
          field: "historySize",
          values: [1000, 1500, 2000],
        },
        {
          name: "probWeight",
          field: "probabilityWeight",
          values: [0.1, 0.2, 0.3],
        },
      ],
      baseHistorySize: hpCfg?.historySize ?? 2000,
      baseProbabilityWeight: hpCfg?.probabilityWeight ?? 0.2,
      candleDataPath: "",
    };

    const configs = experimentManager.generateGridSearchConfigs(gridConfig);
    const newExps = configs.map((c) => {
      const result: ExperimentResult = {
        config: c,
        status: "created",
        metrics: {
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
        },
        signalLogPath: "",
        startedAt: Date.now(),
        completedAt: null,
      };
      experimentManager.recordResult(result);
      return result;
    });

    setExperiments((prev) => [...prev, ...newExps]);
  }, [robotState]);

  const handleAnalyzeExisting = useCallback(() => {
    const allSignals = signalLogger.getAll();
    if (allSignals.length === 0) return;

    const exp = experimentManager.createExperiment({
      experimentName: `Análise ${new Date().toLocaleTimeString("pt-BR")}`,
      description: "Analysis of existing signal log",
      asset: robotState.config.asset ?? "EURUSD",
      timeframe: robotState.config.timeframes?.[0] ?? "M1",
      profile: robotState.config.operationProfile ?? "AUTO",
      historySize: robotState.config.hybridProbabilityConfig?.historySize ?? 2000,
      probabilityWeight: robotState.config.hybridProbabilityConfig?.probabilityWeight ?? 0.2,
    });

    const runner = new ExperimentRunner();
    const result = runner.runFromEntries(exp.config, allSignals);
    experimentManager.recordResult(result);
    setExperiments((prev) => [...prev, result]);
    setSelectedId(result.config.experimentId);
  }, [robotState]);

  const handleExportJSON = useCallback(() => {
    const json = exportToJSON(experiments);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiments_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [experiments]);

  const handleExportCSV = useCallback(() => {
    const csv = exportToCSV(experiments);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiments_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [experiments]);

  const completed = experiments.filter((e) => e.status === "completed");
  const comparator = new ExperimentComparator(completed);
  const ranking = new ExperimentRanking(completed);

  return (
    <section className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <FlaskConical className="size-4 text-info" />
            EXPERIMENT FRAMEWORK — PHASE XXIV
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateExperiment}
              className="px-3 py-1.5 rounded-md text-xs bg-info/15 text-info border border-info/30 hover:bg-info/25 transition-colors"
            >
              + Novo Experimento
            </button>
            <button
              onClick={handleAnalyzeExisting}
              className="px-3 py-1.5 rounded-md text-xs bg-success/15 text-success border border-success/30 hover:bg-success/25 transition-colors"
            >
              Analisar Sinais
            </button>
            <button
              onClick={handleRunGridSearch}
              className="px-3 py-1.5 rounded-md text-xs bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 transition-colors"
            >
              Grid Search
            </button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          <MetricCard label="Total Experiments" value={String(experiments.length)} />
          <MetricCard label="Completed" value={String(completed.length)} accent="success" />
          <MetricCard
            label="Running"
            value={String(experiments.filter((e) => e.status === "running").length)}
          />
          <MetricCard
            label="Failed"
            value={String(experiments.filter((e) => e.status === "failed").length)}
            accent="danger"
          />
          <MetricCard
            label="Best Accuracy"
            value={
              completed.length > 0
                ? `${Math.max(...completed.map((e) => e.metrics.accuracy)).toFixed(1)}%`
                : "—"
            }
            accent="success"
          />
          <MetricCard
            label="Best Profit Factor"
            value={
              completed.length > 0
                ? Math.max(...completed.map((e) => e.metrics.profitFactor)).toFixed(2)
                : "—"
            }
            accent="success"
          />
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Experiment List */}
          <div className="col-span-12 md:col-span-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Experimentos ({experiments.length})
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {experiments.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8">
                  Nenhum experimento. Clique "Novo Experimento" ou "Analisa Sinais".
                </div>
              )}
              {experiments.map((exp) => (
                <ExperimentRow
                  key={exp.config.experimentId}
                  result={exp}
                  isSelected={selectedId === exp.config.experimentId}
                  onSelect={() => setSelectedId(exp.config.experimentId)}
                />
              ))}
            </div>
          </div>

          {/* Right: Details */}
          <div className="col-span-12 md:col-span-9">
            {!selected ? (
              <div className="text-center text-muted-foreground py-12 text-xs">
                Selecione um experimento para ver detalhes
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tabs */}
                <div className="flex gap-1 border-b border-border pb-1">
                  {(["overview", "ranking", "calibration", "drift", "optimize"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
                          activeTab === tab
                            ? "bg-success/10 text-success border border-success/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "overview"
                          ? "Visão Geral"
                          : tab === "ranking"
                            ? "Ranking"
                            : tab === "calibration"
                              ? "Calibração"
                              : tab === "drift"
                                ? "Drift"
                                : "Otimizar"}
                      </button>
                    ),
                  )}
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <MetricCard
                      label="Status"
                      value={selected.status.toUpperCase()}
                      accent={
                        selected.status === "completed"
                          ? "success"
                          : selected.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    />
                    <MetricCard
                      label="Accuracy"
                      value={`${selected.metrics.accuracy.toFixed(1)}%`}
                      accent={selected.metrics.accuracy >= 70 ? "success" : "danger"}
                    />
                    <MetricCard
                      label="Precision"
                      value={`${selected.metrics.precision.toFixed(1)}%`}
                    />
                    <MetricCard label="Recall" value={`${selected.metrics.recall.toFixed(1)}%`} />
                    <MetricCard
                      label="F1 Score"
                      value={`${selected.metrics.f1Score.toFixed(1)}%`}
                    />
                    <MetricCard
                      label="Win Rate"
                      value={`${selected.metrics.winRate.toFixed(1)}%`}
                    />
                    <MetricCard
                      label="Profit Factor"
                      value={selected.metrics.profitFactor.toFixed(2)}
                      accent={
                        selected.metrics.profitFactor >= 1.5
                          ? "success"
                          : selected.metrics.profitFactor >= 1.0
                            ? "warning"
                            : "danger"
                      }
                    />
                    <MetricCard
                      label="Max Drawdown"
                      value={selected.metrics.maxDrawdown.toFixed(0)}
                      accent={selected.metrics.maxDrawdown <= 10 ? "success" : "danger"}
                    />
                    <MetricCard
                      label="Net Profit"
                      value={`${selected.metrics.netProfit >= 0 ? "+" : ""}${selected.metrics.netProfit.toFixed(0)}`}
                      accent={selected.metrics.netProfit > 0 ? "success" : "danger"}
                    />
                    <MetricCard
                      label="Avg Decision Score"
                      value={selected.metrics.avgDecisionScore.toFixed(1)}
                    />
                    <MetricCard
                      label="Avg Probability Score"
                      value={selected.metrics.avgProbabilityScore.toFixed(1)}
                    />
                    <MetricCard
                      label="Calibration Score"
                      value={`${(selected.metrics.calibrationScore * 100).toFixed(0)}%`}
                      accent={selected.metrics.calibrationScore >= 0.8 ? "success" : "warning"}
                    />
                    <MetricCard
                      label="Signals Total"
                      value={String(selected.metrics.totalSignals)}
                    />
                    <MetricCard
                      label="Approved"
                      value={String(selected.metrics.approved)}
                      accent="success"
                    />
                    <MetricCard label="Blocked" value={String(selected.metrics.blocked)} />
                    <MetricCard
                      label="Avg Processing"
                      value={`${selected.metrics.avgProcessingTimeMs.toFixed(1)}ms`}
                    />
                    <MetricCard
                      label="Config: History"
                      value={String(selected.config.historySize)}
                    />
                    <MetricCard
                      label="Config: Prob Weight"
                      value={`${(selected.config.probabilityWeight * 100).toFixed(0)}%`}
                    />
                  </div>
                )}

                {/* Ranking Tab */}
                {activeTab === "ranking" && (
                  <div>
                    {completed.length < 2 ? (
                      <div className="text-center text-muted-foreground py-8 text-xs">
                        Execute ao menos 2 experimentos para gerar ranking
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          Ranking por Score Composto
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-2 text-muted-foreground">Rank</th>
                                <th className="text-left py-2 px-2 text-muted-foreground">Name</th>
                                <th className="text-right py-2 px-2 text-muted-foreground">
                                  Accuracy
                                </th>
                                <th className="text-right py-2 px-2 text-muted-foreground">
                                  Profit
                                </th>
                                <th className="text-right py-2 px-2 text-muted-foreground">F1</th>
                                <th className="text-right py-2 px-2 text-muted-foreground">
                                  Drawdown
                                </th>
                                <th className="text-right py-2 px-2 text-muted-foreground">
                                  Score
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {ranking.rank().map((entry) => (
                                <tr
                                  key={entry.experimentId}
                                  className="border-b border-border/50 hover:bg-accent/20"
                                >
                                  <td className="py-2 px-2 font-bold">#{entry.rank}</td>
                                  <td className="py-2 px-2 truncate max-w-[200px]">
                                    {entry.experimentName}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {entry.metrics.accuracy.toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {entry.metrics.profitFactor.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {entry.metrics.f1Score.toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {entry.metrics.maxDrawdown.toFixed(0)}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums font-bold text-success">
                                    {entry.compositeScore.toFixed(1)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Calibration Tab */}
                {activeTab === "calibration" && (
                  <div>
                    {selected.status !== "completed" ? (
                      <div className="text-center text-muted-foreground py-8 text-xs">
                        Experimento ainda não completou
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Execute o experimento com dados de candles para gerar relatório de
                        calibração completo.
                      </div>
                    )}
                  </div>
                )}

                {/* Drift Tab */}
                {activeTab === "drift" && (
                  <div>
                    {selected.status !== "completed" ? (
                      <div className="text-center text-muted-foreground py-8 text-xs">
                        Experimento ainda não completou
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Execute o experimento com dados históricos extensos para detectar drift de
                        performance.
                      </div>
                    )}
                  </div>
                )}

                {/* Optimize Tab */}
                {activeTab === "optimize" && (
                  <div>
                    {completed.length < 2 ? (
                      <div className="text-center text-muted-foreground py-8 text-xs">
                        Execute ao menos 2 experimentos para gerar recomendações de otimização
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(() => {
                          const optEngine = new OptimizationEngine(completed);
                          const report = optEngine.generate(selectedId!);
                          return report.suggestions.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-xs">
                              Nenhuma sugestão encontrada. Execute mais experimentos com diferentes
                              parâmetros.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Sugestões de Otimização
                              </div>
                              {report.suggestions.map((s, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-border bg-background/40 p-3"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{s.parameter}</span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded ${
                                        s.confidence === "high"
                                          ? "bg-success/15 text-success"
                                          : s.confidence === "medium"
                                            ? "bg-warning/15 text-warning"
                                            : "bg-danger/15 text-danger"
                                      }`}
                                    >
                                      {s.confidence.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground text-xs mb-1">
                                    {s.currentValue} →{" "}
                                    <span className="text-success font-medium">
                                      {s.suggestedValue}
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground text-[11px]">
                                    {s.justification}
                                  </div>
                                  <div className="text-muted-foreground text-[10px] mt-1">
                                    Expected: +{s.expectedImpact.accuracy.toFixed(1)}% accuracy, +
                                    {s.expectedImpact.profitFactor.toFixed(2)} PF
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Export Buttons */}
        {experiments.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Exportar:
            </span>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-md text-xs bg-background border border-border text-foreground hover:bg-accent/40 transition-colors"
            >
              <Download className="size-3 inline mr-1" />
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-md text-xs bg-background border border-border text-foreground hover:bg-accent/40 transition-colors"
            >
              <Download className="size-3 inline mr-1" />
              CSV
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
