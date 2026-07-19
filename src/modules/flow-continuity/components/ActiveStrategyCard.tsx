"use client";

import React from "react";
import { useRobot } from "../../../hooks/useRobot";
import { strategyManager } from "../../../services/strategy-manager";

export const ActiveStrategyCard: React.FC = () => {
  const { state } = useRobot();
  const profile = strategyManager.getActiveProfile();

  const score = Math.round(
    state.lastAnalysis?.probability?.total ??
      state.lastAnalysis?.score?.total ??
      0,
  );

  const filters = state.lastAnalysis?.filters ?? [];
  const filtersPassed = filters.filter((f) => f.passed).length;
  const filtersTotal = filters.length;

  const eligible = strategyManager.meetsThresholds(
    score,
    state.lastAnalysis?.probability?.total ?? 0,
    filtersPassed,
  );

  const modeColors: Record<string, string> = {
    conservative: "text-blue-400 bg-blue-500/15 border-blue-500/40",
    balanced: "text-green-400 bg-green-500/15 border-green-500/40",
    aggressive: "text-orange-400 bg-orange-500/15 border-orange-500/40",
  };

  const modeIcons: Record<string, string> = {
    conservative: "🛡",
    balanced: "⚖",
    aggressive: "🔥",
  };

  const profileSubtitle = (() => {
    if (eligible.eligible) return "Profile Stable";
    if (filtersTotal > 0 && filtersPassed < filtersTotal) return "Filters Pending";
    if (score < 70) return "Below Threshold";
    return "Awaiting Confirmation";
  })();

  const statusLabel = (() => {
    if (eligible.eligible) return "READY";
    if (filtersTotal > 0) return "FILTERS PENDING";
    if (score > 0) return "LOW SCORE";
    return "WAITING";
  })();

  return (
    <div
      className={`panel flex-1 min-w-0 p-3 border-l-[3px] ${eligible.eligible ? "border-l-success" : "border-l-border"}`}
    >
      <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider border ${modeColors[profile.mode] ?? modeColors.balanced}`}>
          {modeIcons[profile.mode]} {profile.name.toUpperCase()}
        </span>
        <span className="text-[9px] text-muted-foreground/70 font-medium">
          {profileSubtitle}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-lg font-extrabold tracking-tight truncate ${score >= 70 ? "text-success" : score > 0 ? "text-warning" : "text-foreground"}`}
        >
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground/70 font-medium">
          {score >= 70 ? "Above" : score > 0 ? "Below" : "No"} Threshold
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1.5">
        {filtersTotal > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">{filtersPassed}</span>
            {" / "}
            <span>{filtersTotal}</span>
            {" Filters Approved"}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            No filter data
          </span>
        )}
        <span
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${eligible.eligible ? "bg-success/15 text-success" : "bg-muted/15 text-muted-foreground"}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
};
