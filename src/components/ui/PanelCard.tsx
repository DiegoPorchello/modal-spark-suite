import type { ComponentType, ReactNode } from "react";

interface PanelCardProps {
  /** Single module icon (lucide). */
  icon?: ComponentType<{ className?: string }>;
  /** Primary title (information level 1). */
  title: string;
  /** Short description (state / purpose). */
  description?: string;
  /** Current state node, typically a <StatusBadge />. */
  status?: ReactNode;
  /** Optional secondary node on the right (e.g. controls). */
  headerExtra?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
  /** Enable subtle hover elevation. */
  hover?: boolean;
}

/**
 * Canonical panel wrapper used by every module of the NEXOR platform.
 * Enforces a consistent header (icon · title · description · status),
 * uniform spacing, border radius and typography hierarchy.
 */
export function PanelCard({
  icon: Icon,
  title,
  description,
  status,
  headerExtra,
  className = "",
  bodyClassName = "",
  children,
  hover = false,
}: PanelCardProps) {
  return (
    <div className={`panel fade-in p-4 ${hover ? "hover-elevate" : ""} ${className}`}>
      <header className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-border">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && (
            <div className="size-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="size-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold tracking-wide text-foreground leading-tight truncate">
              {title}
            </h3>
            {description && (
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          {status}
        </div>
      </header>
      <div className={bodyClassName || "text-sm text-foreground/90"}>{children}</div>
    </div>
  );
}
