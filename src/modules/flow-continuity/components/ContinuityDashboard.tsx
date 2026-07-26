"use client";

import React, { useState, useEffect } from "react";
import { ScoreMeter } from "./ScoreMeter";
import { SignalBadge } from "./SignalBadge";
import { FilterIndicator } from "./FilterIndicator";
import { RealTimeChart } from "./RealTimeChart";
import { StructureAnalysis } from "./StructureAnalysis";
import { OperationCard } from "./OperationCard";
import { useRobot } from "../../../hooks/useRobot";

export const ContinuityDashboard: React.FC = () => {
  const { state, engine } = useRobot();
  const [activeOperation, setActiveOperation] = useState(null);
  const [showOperationModal, setShowOperationModal] = useState(false);

  useEffect(() => {
    const handleEngineEvent = (event: any) => {
      if (event.operation) {
        setActiveOperation(event.operation);
        setShowOperationModal(true);
      }
    };

    if (engine?.on) {
      const unsubscribe = engine.on(handleEngineEvent);
      return () => unsubscribe();
    }
  }, [engine]);

  const closeOperationModal = () => {
    setShowOperationModal(false);
    setTimeout(() => setActiveOperation(null), 300);
  };

  const cancelOperation = () => {
    closeOperationModal();
  };

  const getRobotStatusColor = () => {
    switch (state.status) {
      case "running": return "bg-success/20 text-success border-success/40";
      case "paused": return "bg-warning/20 text-warning border-warning/40";
      case "stopped": return "bg-gray-500/20 text-gray-400 border-gray-500/40";
      default: return "bg-info/20 text-info border-info/40";
    }
  };

  const getRobotStatusLabel = () => {
    switch (state.status) {
      case "running": return "ROBO EM ANDAMENTO";
      case "paused": return "ROBO PAUSADO";
      case "stopped": return "ROBO PARADO";
      default: return "INDISPONÍVEL";
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-3">
          <div className="panel p-4 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="text-lg">🧠</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-foreground">FLUXO DE CONTINUIDADE</h3>
                <p className="text-[10px] text-muted-foreground">Análise de padrões PRO</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">ATIVO ATUAL:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastScannedAsset || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">DIREÇÃO:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.trend?.direction || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">TIMEFRAME:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.selectedTimeframe || "M1"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">SCORE FINAL:</span>
                <span className="text-xs font-mono font-bold text-success">
                  {state.lastAnalysis?.score?.total ? Math.round(state.lastAnalysis.score.total * 100) : "—"}/100
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">CLASSIFICAÇÃO:</span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${state.lastAnalysis?.score?.classification === "EXCELLENT" ? "bg-success/20 text-success" : state.lastAnalysis?.score?.classification === "GOOD" ? "bg-success/20 text-success" : state.lastAnalysis?.score?.classification === "FAIR" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}
                >
                  {state.lastAnalysis?.score?.classification?.toUpperCase() || "AGUARDANDO"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">CONTINUIDADE:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.continuityStrength != null ? `${(state.lastAnalysis.continuityStrength * 100).toFixed(1)}%` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">DOMINÂNCIA:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.dominance ? `${(Math.abs(state.lastAnalysis.dominance) * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>

            <div className="panel p-4 mt-4">
              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">STATUS:</span>
                <div
                  className={`px-2 py-1 rounded-full text-[9px] font-bold border ${getRobotStatusColor()} flex items-center gap-1.5`}
                >
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  {getRobotStatusLabel()}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">ATIVO ATUAL:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastScannedAsset || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">DIREÇÃO:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.trend?.direction || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">TIMEFRAME:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.selectedTimeframe || "M1"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">SCORE FINAL:</span>
                <span className="text-xs font-mono font-bold text-success">
                  {state.lastAnalysis?.score?.total ? Math.round(state.lastAnalysis.score.total * 100) : "—"}/100
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">CLASSIFICAÇÃO:</span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${state.lastAnalysis?.score?.classification === "EXCELLENT" ? "bg-success/20 text-success" : state.lastAnalysis?.score?.classification === "GOOD" ? "bg-success/20 text-success" : state.lastAnalysis?.score?.classification === "FAIR" ? "bg-warning/20 text-warning" : "bg-danger/20 text-danger"}`}
                >
                  {state.lastAnalysis?.score?.classification?.toUpperCase() || "AGUARDANDO"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">CONTINUIDADE:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.continuityStrength != null ? `${(state.lastAnalysis.continuityStrength * 100).toFixed(1)}%` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                <span className="text-[10px] text-muted-foreground font-semibold">DOMINÂNCIA:</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {state.lastAnalysis?.dominance ? `${(Math.abs(state.lastAnalysis.dominance) * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-4 mt-4">
            <h4 className="text-[10px] tracking-widest text-muted-foreground mb-3 uppercase">
              Indicadores de Decisão
            </h4>

            <div className="space-y-3">
              {state.lastAnalysis?.score && (
                <div className="flex items-center justify-center">
                  <ScoreMeter
                    score={Math.round((state.lastAnalysis?.score?.total ?? 0) * 100)}
                    classification={(state.lastAnalysis?.score?.classification ?? "POOR").toUpperCase() as any}
                    label="Score Final"
                    animated={true}
                    size="medium"
                  />
                </div>
              )}

              {state.lastAnalysis?.continuityStrength != null && (
                <div className="flex justify-center">
                  <SignalBadge
                    direction={state.lastAnalysis?.trend?.direction === "UPTREND" ? "CALL" : state.lastAnalysis?.trend?.direction === "DOWNTREND" ? "PUT" : null}
                    timeframe={state.selectedTimeframe || "M1"}
                    status={(state.lastAnalysis?.continuityStrength ?? 0) > 0 ? "ready" : "blocked"}
                    size="medium"
                  />
                </div>
              )}

              {state.lastAnalysis?.score?.classification && (
                <div className="space-y-2">
                  <FilterIndicator
                    label="Continuidade"
                    value={`${(state.lastAnalysis?.score?.continuityScore ?? 0).toFixed(1)}%`}
                    status={(state.lastAnalysis?.score?.continuityScore ?? 0) >= 80 ? "good" : (state.lastAnalysis?.score?.continuityScore ?? 0) >= 60 ? "warning" : "error"}
                    size="medium"
                  />

                  <FilterIndicator
                    label="Dominância"
                    value={`${(state.lastAnalysis?.score?.dominanceScore ?? 0).toFixed(1)}%`}
                    status={(state.lastAnalysis?.score?.dominanceScore ?? 0) >= 80 ? "good" : (state.lastAnalysis?.score?.dominanceScore ?? 0) >= 60 ? "warning" : "error"}
                    size="medium"
                  />

                  <FilterIndicator
                    label="Força"
                    value={`${(state.lastAnalysis?.score?.strengthScore ?? 0).toFixed(1)}%`}
                    status={(state.lastAnalysis?.score?.strengthScore ?? 0) >= 80 ? "good" : (state.lastAnalysis?.score?.strengthScore ?? 0) >= 60 ? "warning" : "error"}
                    size="medium"
                  />

                  <FilterIndicator
                    label="Estrutura"
                    value={`${(state.lastAnalysis?.score?.structureScore ?? 0).toFixed(1)}%`}
                    status={(state.lastAnalysis?.score?.structureScore ?? 0) >= 80 ? "good" : (state.lastAnalysis?.score?.structureScore ?? 0) >= 60 ? "warning" : "error"}
                    size="medium"
                  />

                  <FilterIndicator
                    label="Histórico"
                    value={`${(state.lastAnalysis?.score?.historyScore ?? 0).toFixed(1)}%`}
                    status={(state.lastAnalysis?.score?.historyScore ?? 0) >= 80 ? "good" : (state.lastAnalysis?.score?.historyScore ?? 0) >= 60 ? "warning" : "error"}
                    size="medium"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-9">
          <RealTimeChart height={400} autoRefreshInterval={5000} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <StructureAnalysis animated={true} />

            <div className="panel p-4">
              <h4 className="text-[10px] tracking-widest text-muted-foreground mb-3 uppercase">Análise de Risco</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Stop Loss:</span>
                  <span className="text-xs font-mono font-bold text-danger">
                    {state.config.stopLoss?.toFixed(2) || "0.00"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Target Profit:</span>
                  <span className="text-xs font-mono font-bold text-success">
                    {state.config.targetProfit?.toFixed(2) || "0.00"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Max Level:</span>
                  <span className="text-xs font-mono font-bold text-info">
                    {state.config.maxLevel || "15"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Payout:</span>
                  <span className="text-xs font-mono font-bold text-warning">
                    {(state.config.payout * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Initial Stake:</span>
                  <span className="text-xs font-mono font-bold text-primary">
                    R$ {state.config.initialStake?.toFixed(2) || "0.00"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded bg-muted/10 border border-border">
                  <span className="text-[10px] text-muted-foreground font-semibold">Account Type:</span>
                  <span
                    className={`text-xs font-mono font-bold ${state.config.accountType === "demo" ? "text-warning" : "text-success"}`}
                  >
                    {state.config.accountType?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOperationModal && activeOperation && (
        <OperationCard
          operation={activeOperation}
          onClose={closeOperationModal}
          onCancel={cancelOperation}
        />
      )}
    </div>
  );
};