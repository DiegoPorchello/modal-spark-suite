import type { ComponentType, ReactNode } from "react";

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  pulse?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-info/10 text-info border-info/30",
  neutral: "bg-muted/40 text-muted-foreground border-border",
};

const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground/50",
};

/**
 * Standardized status pill.
 * Green  → success / online / approved / win / healthy
 * Red    → danger  / offline / blocked / loss / error
 * Amber  → warning / waiting / attention / alert
 * Blue   → info    / informational
 */
export function StatusBadge({ tone, label, pulse, className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      <span
        className={`size-1.5 rounded-full ${TONE_DOT[tone]} ${pulse ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
