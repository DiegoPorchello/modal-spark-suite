import type { ComponentType, ReactNode } from "react";

export interface TabDef {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Optional state badge, e.g. "Ativo" or "Atualizado há 2s". */
  state?: string;
}

interface TabNavProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * Standardized tab bar: each tab shows an icon, a name and an optional
 * state badge. The active tab uses the brand accent. Smooth colour
 * transitions keep the switch feeling responsive without being loud.
 */
export function TabNav({ tabs, active, onChange, className = "" }: TabNavProps) {
  return (
    <div className={`tabbar ${className}`} role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`tab ${isActive ? "tab--active" : ""}`}
          >
            <Icon className="tab__icon" />
            {t.label}
            {t.state && <span className="tab__state">{t.state}</span>}
          </button>
        );
      })}
    </div>
  );
}
