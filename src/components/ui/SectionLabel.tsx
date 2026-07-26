import type { ComponentType, ReactNode } from "react";

interface SectionLabelProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Standardized section label used inside every panel:
 * icon · uppercase title · optional hint/action · divider.
 * Enforces visual consistency for secondary information headers.
 */
export function SectionLabel({
  icon: Icon,
  title,
  hint,
  action,
  className = "",
}: SectionLabelProps) {
  return (
    <div className={`section-label ${className}`}>
      {Icon && <Icon className="section-label__icon" />}
      <span className="section-label__title">{title}</span>
      {hint && <span className="section-label__hint">{hint}</span>}
      {action}
      <div className="section-label__divider" />
    </div>
  );
}
