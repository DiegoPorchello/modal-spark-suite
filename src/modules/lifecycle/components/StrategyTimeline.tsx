/**
 * StrategyTimeline
 *
 * Visual timeline showing the lifecycle states of a strategy.
 * Highlights the current state.
 */

import React from "react";
import {
  StrategyState,
  STRATEGY_STATE_INFO,
  type StrategyTimelineEntry,
} from "../types/strategy-lifecycle.types";

interface StrategyTimelineProps {
  timeline: StrategyTimelineEntry[];
  currentState: StrategyState;
  compact?: boolean;
}

const STATE_ORDER: StrategyState[] = [
  StrategyState.MONITORING,
  StrategyState.PREPARING,
  StrategyState.READY,
  StrategyState.CONFIRMED,
  StrategyState.EXECUTING,
  StrategyState.ACTIVE,
  StrategyState.COMPLETED,
];

const STATE_COLORS: Record<StrategyState, { bg: string; ring: string; text: string }> = {
  [StrategyState.IDLE]:       { bg: "bg-muted/40", ring: "ring-muted-foreground/30", text: "text-muted-foreground" },
  [StrategyState.MONITORING]: { bg: "bg-info/20", ring: "ring-info/50", text: "text-info" },
  [StrategyState.PREPARING]:  { bg: "bg-warning/20", ring: "ring-warning/50", text: "text-warning" },
  [StrategyState.READY]:      { bg: "bg-info/20", ring: "ring-info/50", text: "text-info" },
  [StrategyState.CONFIRMED]:  { bg: "bg-success/20", ring: "ring-success/50", text: "text-success" },
  [StrategyState.EXECUTING]:  { bg: "bg-primary/20", ring: "ring-primary/50", text: "text-primary" },
  [StrategyState.ACTIVE]:     { bg: "bg-success/20", ring: "ring-success/50", text: "text-success" },
  [StrategyState.COMPLETED]:  { bg: "bg-success/30", ring: "ring-success/50", text: "text-success" },
  [StrategyState.CANCELLED]:  { bg: "bg-danger/20", ring: "ring-danger/50", text: "text-danger" },
  [StrategyState.LEARNING]:   { bg: "bg-primary/20", ring: "ring-primary/50", text: "text-primary" },
};

export function StrategyTimeline({ timeline, currentState, compact = false }: StrategyTimelineProps) {
  const reachedStates = new Set(timeline.map((e) => e.state));

  return (
    <div className="flex items-center gap-1">
      {STATE_ORDER.map((state, idx) => {
        const info = STRATEGY_STATE_INFO[state];
        const colors = STATE_COLORS[state];
        const isReached = reachedStates.has(state);
        const isCurrent = state === currentState;
        const isLast = idx === STATE_ORDER.length - 1;

        return (
          <React.Fragment key={state}>
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`
                  size-6 rounded-full flex items-center justify-center text-[10px] font-medium
                  transition-all duration-300
                  ${isCurrent
                    ? `${colors.bg} ${colors.text} ring-2 ${colors.ring}`
                    : isReached
                      ? `${colors.bg} ${colors.text}`
                      : "bg-muted/30 text-muted-foreground/40"
                  }
                `}
              >
                {info.label.charAt(0)}
              </div>
              {!compact && (
                <span
                  className={`text-[8px] leading-none ${
                    isCurrent ? colors.text : "text-muted-foreground/40"
                  }`}
                >
                  {info.label}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={`h-px flex-1 min-w-3 ${
                  isReached && !isCurrent ? "bg-primary/40" : "bg-muted/30"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
