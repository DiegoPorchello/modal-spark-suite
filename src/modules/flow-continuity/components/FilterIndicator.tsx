"use client";

import React from "react";

interface FilterIndicatorProps {
  label: string;
  value: string | number;
  status: "good" | "warning" | "error" | "info";
  icon?: React.ReactNode;
  size?: "small" | "medium" | "large";
}

export const FilterIndicator: React.FC<FilterIndicatorProps> = ({
  label,
  value,
  status = "info",
  icon,
  size = "medium",
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case "good":
        return {
          bg: "bg-success/15",
          border: "border-success/40",
          text: "text-success",
          glow: "shadow-success/30",
          label: "✅",
        };
      case "warning":
        return {
          bg: "bg-warning/15",
          border: "border-warning/40",
          text: "text-warning",
          glow: "shadow-warning/30",
          label: "⚠️",
        };
      case "error":
        return {
          bg: "bg-danger/15",
          border: "border-danger/40",
          text: "text-danger",
          glow: "shadow-danger/30",
          label: "❌",
        };
      case "info":
        return {
          bg: "bg-info/15",
          border: "border-info/40",
          text: "text-info",
          glow: "shadow-info/30",
          label: "ℹ️",
        };
    }
  };

  const sizeClasses = {
    small: { container: "px-2 py-1", label: "text-[9px]", value: "text-xs", icon: "size-3" },
    medium: { container: "px-3 py-1.5", label: "text-[10px]", value: "text-xs", icon: "size-3.5" },
    large: { container: "px-4 py-2", label: "text-xs", value: "text-sm", icon: "size-4" },
  };

  const config = getStatusConfig();

  return (
    <div
      className={
        "rounded-md " +
        sizeClasses[size].container +
        " border " +
        config.border +
        " " +
        config.bg +
        " " +
        config.text +
        " font-semibold tracking-wider flex items-center gap-1.5 " +
        config.glow
      }
    >
      {icon || <span>{config.label}</span>}
      <div className="flex flex-col">
        <span className={sizeClasses[size].label + " text-muted-foreground uppercase tracking-wider"}>{label}</span>
        <span className={sizeClasses[size].value + " font-mono font-bold"}>{value}</span>
      </div>
    </div>
  );
};