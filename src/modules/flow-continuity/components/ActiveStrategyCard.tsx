"use client";

import React from "react";
import { Target, CheckCircle2, AlertCircle } from "lucide-react";
import { useRobot } from "../../../hooks/useRobot";
import { strategyManager } from "../../../services/strategy-manager";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";

export const ActiveStrategyCard: React.FC = () => {
  const { state } = useRobot();
  const profile = strategyManager.getActiveProfile();

  const score = Math.round(
    state.lastAnalysis?.probability?.total ?? state.lastAnalysis?.score?.total ?? 0,
  );

  const filters = state.lastAnalysis?.filters ?? [];
  const filtersPassed = filters.filter((f) => f.passed).length;
  const filtersTotal = filters.length;

  const eligible = strategyManager.meetsThresholds(
    score,
    state.lastAnalysis?.probability?.total ?? 0,
    filtersPassed,
  );

  const modeTone: Record<string, "info" | "success" | "warning"> = {
    conservative: "info",
    balanced: "success",
    aggressive: "warning",
  };
  const tone = modeTone[profile.mode] ?? "success";

  const scoreTone = score >= 70 ? "text-success" : score > 0 ? "text-warning" : "text-foreground";

  return (
    <PanelCard
      icon={Target}
      title="Estratégia Ativa"
      description={profile.name}
      status={
        <StatusBadge
          tone={eligible.eligible ? "success" : "warning"}
          label={eligible.eligible ? "READY" : "PENDING"}
          pulse={eligible.eligible}
        />
      }
      className="flex-1 min-w-0"
    >
      <div className="flex items-center gap-2">
        <span className={`metric-primary ${scoreTone}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground/70 font-medium">
          {score >= 70 ? "Acima" : score > 0 ? "Abaixo" : "Sem"} limite
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {filtersTotal > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">{filtersPassed}</span>
            {" / "}
            <span>{filtersTotal}</span>
            {" filtros aprovados"}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Sem dados de filtro</span>
        )}
        <span
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
            eligible.eligible ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
          }`}
        >
          {eligible.eligible ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3" /> PRONTO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="size-3" /> FILTROS PENDENTES
            </span>
          )}
        </span>
      </div>
    </PanelCard>
  );
};
