"use client";

import React from "react";

interface AutoRefreshPanelProps {
  isAutoRefresh: boolean;
  onToggle: (value: boolean) => void;
  lastUpdate: Date;
  interval: number;
}

export const AutoRefreshPanel: React.FC<AutoRefreshPanelProps> = ({
  isAutoRefresh,
  onToggle,
  lastUpdate,
  interval,
}) => {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={isAutoRefresh}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-3 rounded border-border"
        />
        Auto-refresh
      </label>
      <span className="text-[9px] text-muted-foreground">
        {interval / 1000}s
      </span>
      <span className="text-[9px] text-muted-foreground">
        {lastUpdate.toLocaleTimeString("pt-BR")}
      </span>
    </div>
  );
};
