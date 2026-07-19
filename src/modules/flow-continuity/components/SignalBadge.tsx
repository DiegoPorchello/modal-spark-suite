"use client";

import React from "react";

interface SignalBadgeProps {
  direction?: "CALL" | "PUT" | null;
  timeframe?: string;
  status?: "active" | "blocked" | "pending" | "ready";
  size?: "small" | "medium" | "large";
}

export const SignalBadge: React.FC<SignalBadgeProps> = ({
  direction = null,
  timeframe = "M1",
  status = "pending",
  size = "medium",
}) => {
  const getDirectionConfig = () => {
    switch (direction) {
      case "CALL":
        return {
          bg: "bg-green-500/15",
          border: "border-green-500/40",
          text: "text-green-400",
          icon: "⬆️",
          label: "CALL",
        };
      case "PUT":
        return {
          bg: "bg-red-500/15",
          border: "border-red-500/40",
          text: "text-red-400",
          icon: "⬇️",
          label: "PUT",
        };
      default:
        return {
          bg: "bg-muted/15",
          border: "border-muted/40",
          text: "text-muted-foreground",
          icon: "⏳",
          label: "AGUARDANDO",
        };
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "active":
        return {
          pulse: true,
          label: "ATIVO",
          border: "border-green-500/60",
        };
      case "blocked":
        return {
          pulse: false,
          label: "BLOQUEADO",
          border: "border-yellow-500/60",
        };
      case "pending":
        return {
          pulse: false,
          label: "PENDENTE",
          border: "border-blue-500/60",
        };
      case "ready":
        return {
          pulse: true,
          label: "PRONTO",
          border: "border-purple-500/60",
        };
      default:
        return {
          pulse: false,
          label: "INDEFINIDO",
          border: "border-muted/60",
        };
    }
  };

  const config = getDirectionConfig();
  const statusConfig = getStatusConfig();

  const sizeClasses = {
    small: { badge: "px-2 py-1 text-xs", icon: "text-sm", timeframe: "text-[9px]" },
    medium: { badge: "px-3 py-1.5 text-xs", icon: "text-base", timeframe: "text-[10px]" },
    large: { badge: "px-4 py-2 text-sm", icon: "text-lg", timeframe: "text-xs" },
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={
          "rounded-full " +
          sizeClasses[size].badge +
          " border " +
          config.border +
          " " +
          config.bg +
          " " +
          config.text +
          " font-semibold tracking-wider flex items-center gap-1.5"
        }
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
        {statusConfig.pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
        )}
      </div>

      {timeframe && (
        <div className={sizeClasses[size].timeframe + " text-muted-foreground font-mono font-medium"}>{timeframe}</div>
      )}

      <div
        className={
          "px-2 py-0.5 rounded text-[9px] font-semibold tracking-wider " +
          statusConfig.border +
          " " +
          (statusConfig.pulse ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400")
        }
      >
        {statusConfig.label}
      </div>
    </div>
  );
};