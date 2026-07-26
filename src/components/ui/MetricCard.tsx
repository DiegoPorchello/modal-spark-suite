import type { ComponentType, ReactNode } from "react";

type Accent = "success" | "danger" | "warning" | "info" | "neutral";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  flag?: string;
  /** Drives value colour + left accent border. */
  accent?: Accent;
  /** Show a pulsing dot before the value (live / online). */
  live?: boolean;
  className?: string;
}

const ACCENT_TEXT: Record<Accent, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-foreground",
};

const ACCENT_BORDER: Record<Accent, string> = {
  success: "border-l-success",
  danger: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-info",
  neutral: "border-l-border",
};

/**
 * Canonical KPI tile used across the dashboard top row.
 * Hierarchy is fixed: tertiary label → primary value → secondary sub.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  flag,
  accent = "neutral",
  live = false,
  className = "",
}: MetricCardProps) {
  const subTone =
    sub && sub.startsWith("+")
      ? "text-success"
      : sub && sub.startsWith("-")
        ? "text-danger"
        : "text-muted-foreground";

  return (
    <div
      className={`panel flex-1 min-w-0 p-3 border-l-[3px] ${ACCENT_BORDER[accent]} ${className}`}
    >
      <div className="metric-tertiary mb-2 flex items-center gap-1.5 uppercase tracking-widest">
        {flag && <span className="text-sm leading-none">{flag}</span>}
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {label}
      </div>
      <div className="flex items-center gap-2">
        {live && <span className="size-2.5 rounded-full bg-success animate-pulse shrink-0" />}
        <span className={`metric-primary ${ACCENT_TEXT[accent]} truncate`}>{value}</span>
      </div>
      {sub && <div className={`metric-secondary mt-1.5 ${subTone}`}>{sub}</div>}
    </div>
  );
}
