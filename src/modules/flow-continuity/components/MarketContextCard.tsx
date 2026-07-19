"use client";

import React from "react";
import { useMarketContext } from "../../../contexts/MarketContext";
import { useRobot } from "../../../hooks/useRobot";

export const MarketContextCard: React.FC = () => {
  const { current: market } = useMarketContext();
  const { state } = useRobot();

  const probability = Math.round(
    state.lastAnalysis?.probability?.total ?? 0,
  );

  const probLevel =
    probability >= 85
      ? "High Confidence"
      : probability >= 70
        ? "Moderate"
        : probability > 0
          ? "Low"
          : "Awaiting Data";

  const trend = market?.trend?.direction ?? "sideways";
  const trendStrength = market?.trend?.strength ?? 0;
  const volatility = market?.volatility?.value ?? 0;
  const momentum = market?.momentum?.trend ?? "neutral";
  const session = market?.session ?? "--";

  const trendLabels: Record<string, string> = {
    up: "Uptrend",
    down: "Downtrend",
    sideways: "Sideways",
  };

  const trendColors: Record<string, string> = {
    up: "text-success",
    down: "text-danger",
    sideways: "text-muted-foreground",
  };

  const momentumLabels: Record<string, string> = {
    positive: "Positive",
    negative: "Negative",
    neutral: "Neutral",
  };

  const momentumColors: Record<string, string> = {
    positive: "text-success",
    negative: "text-danger",
    neutral: "text-muted-foreground",
  };

  const volLabel =
    volatility >= 0.7
      ? "High"
      : volatility >= 0.4
        ? "Medium"
        : "Low";

  const sessionLabels: Record<string, string> = {
    asian: "Asian",
    european: "European",
    american: "American",
  };

  return (
    <div
      className={`panel flex-1 min-w-0 p-3 border-l-[3px] ${probability >= 70 ? "border-l-success" : "border-l-border"}`}
    >
      <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        MARKET
        {session !== "--" && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/15 text-muted-foreground font-bold">
            {sessionLabels[session] ?? session}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-lg font-extrabold tracking-tight truncate ${probability >= 70 ? "text-success" : probability > 0 ? "text-warning" : "text-foreground"}`}
        >
          {probability}%
        </span>
        {probLevel !== "Awaiting Data" && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider shrink-0 ${probability >= 85 ? "bg-success/15 text-success" : probability >= 70 ? "bg-warning/15 text-warning" : "bg-muted/15 text-muted-foreground"}`}
          >
            {probLevel.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5">
        <span className={`text-[11px] font-medium ${trendColors[trend]}`}>
          {trendLabels[trend]}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Vol: {volLabel}
        </span>
        <span className={`text-[10px] font-semibold ${momentumColors[momentum]}`}>
          Bias: {momentumLabels[momentum]}
        </span>
      </div>
    </div>
  );
};
