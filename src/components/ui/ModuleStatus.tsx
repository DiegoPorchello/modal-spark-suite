import type { ReactNode } from "react";

export type ModuleState = "online" | "offline" | "waiting";

interface ModuleStatusProps {
  label: string;
  state: ModuleState;
  /** Optional trailing node (e.g. raw value). */
  value?: ReactNode;
  className?: string;
}

const STATE_TEXT: Record<ModuleState, string> = {
  online: "ONLINE",
  offline: "OFFLINE",
  waiting: "AGUARDANDO",
};

/**
 * Standardized module status row.
 * Green  → online / healthy / approved
 * Red    → offline / error
 * Amber  → waiting / attention
 * Never plain text: always a colored pill with a status dot.
 */
export function ModuleStatus({ label, state, value, className = "" }: ModuleStatusProps) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 ${className}`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-xs font-semibold">
        <span className={`status-pill status-pill--${state}`}>
          <span className={`status-pill__dot status-pill__dot--${state}`} />
          {STATE_TEXT[state]}
        </span>
        {value}
      </span>
    </div>
  );
}
