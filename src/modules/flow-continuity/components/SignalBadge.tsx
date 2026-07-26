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
          bg: "bg-success/15",
          border: "border-success/40",
          text: "text-success",
          icon: "⬆️",
          label: "CALL",
        };
      case "PUT":
        return {
          bg: "bg-danger/15",
          border: "border-danger/40",
          text: "text-danger",
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
          border: "border-success/60",
        };
      case "blocked":
        return {
          pulse: false,
          label: "BLOQUEADO",
          border: "border-warning/60",
        };
      case "pending":
        return {
          pulse: false,
          label: "PENDENTE",
          border: "border-info/60",
        };
      case "ready":
        return {
          pulse: true,
          label: "PRONTO",
          border: "border-primary/60",
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
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
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
          (statusConfig.pulse ? "bg-success/10 text-success" : "bg-warning/10 text-warning")
        }
      >
        {statusConfig.label}
      </div>
    </div>
  );
};