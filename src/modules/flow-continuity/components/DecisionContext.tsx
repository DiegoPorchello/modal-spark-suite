/**
 * DecisionContext.tsx
 * Displays the full reasoning behind a trading decision:
 * - Decision reason
 * - Approved filters
 * - Rejected filters
 * - Execution trigger
 * - Confidence
 * - Market conditions
 */

import React from "react";
import type { DecisionContext as DecisionContextType } from "../types/decision-context.types";

interface DecisionContextPanelProps {
  context: DecisionContextType | null;
}

const DECISION_COLORS: Record<string, string> = {
  CALL: "text-emerald-400",
  PUT: "text-red-400",
  WAIT: "text-amber-400",
  REJECT: "text-zinc-400",
};

const DECISION_BG: Record<string, string> = {
  CALL: "bg-emerald-500/10",
  PUT: "bg-red-500/10",
  WAIT: "bg-amber-500/10",
  REJECT: "bg-zinc-500/10",
};

const CONFIDENCE_LABEL = (c: number): string => {
  if (c >= 0.8) return "High";
  if (c >= 0.5) return "Medium";
  return "Low";
};

const CONFIDENCE_COLOR = (c: number): string => {
  if (c >= 0.8) return "text-emerald-400";
  if (c >= 0.5) return "text-amber-400";
  return "text-zinc-400";
};

export const DecisionContextPanel: React.FC<DecisionContextPanelProps> = ({
  context,
}) => {
  if (!context) {
    return (
      <div className="panel p-4">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          DECISION CONTEXT
        </div>
        <div className="text-xs text-muted-foreground">No decision recorded yet.</div>
      </div>
    );
  }

  return (
    <div className="panel p-4 space-y-3">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-1">
        DECISION CONTEXT
      </div>

      {/* Decision + Score */}
      <div className={`rounded p-2 ${DECISION_BG[context.decision]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-bold ${DECISION_COLORS[context.decision]}`}>
            {context.decision}
          </span>
          <span className="text-xs text-muted-foreground">
            Score {context.finalScore}/{context.minimumScore}
          </span>
        </div>
        <div className="text-xs text-foreground/70 mt-1">
          {context.decisionReason}
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Confidence</span>
        <span className={CONFIDENCE_COLOR(context.confidence)}>
          {CONFIDENCE_LABEL(context.confidence)} ({Math.round(context.confidence * 100)}%)
        </span>
      </div>

      {/* Market Conditions */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-secondary/40 rounded p-1.5 text-center">
          <div className="text-[10px] text-muted-foreground">TREND</div>
          <div className="font-medium mt-0.5">{context.trend}</div>
        </div>
        <div className="bg-secondary/40 rounded p-1.5 text-center">
          <div className="text-[10px] text-muted-foreground">VOLATILITY</div>
          <div className="font-medium mt-0.5">{context.volatility}</div>
        </div>
        <div className="bg-secondary/40 rounded p-1.5 text-center">
          <div className="text-[10px] text-muted-foreground">BIAS</div>
          <div className="font-medium mt-0.5">{context.bias}</div>
        </div>
      </div>

      {/* Strategy */}
      <div className="bg-secondary/40 rounded p-2 text-xs">
        <div className="text-[10px] text-muted-foreground">STRATEGY</div>
        <div className="font-medium mt-0.5">{context.strategyName}</div>
      </div>

      {/* Approved Filters */}
      {context.approvedFilters.length > 0 && (
        <div className="bg-emerald-500/5 rounded p-2">
          <div className="text-[10px] text-emerald-400 font-semibold mb-1">
            APPROVED ({context.approvedFilters.length})
          </div>
          <div className="space-y-0.5">
            {context.approvedFilters.map((f) => (
              <div key={f.id} className="text-[11px] text-foreground/70">
                {f.name}: <span className="text-emerald-400">{f.contribution}/{f.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Filters */}
      {context.rejectedFilters.length > 0 && (
        <div className="bg-red-500/5 rounded p-2">
          <div className="text-[10px] text-red-400 font-semibold mb-1">
            REJECTED ({context.rejectedFilters.length})
          </div>
          <div className="space-y-0.5">
            {context.rejectedFilters.map((f) => (
              <div key={f.id} className="text-[11px] text-foreground/70">
                {f.name}: <span className="text-red-400">{f.contribution}/{f.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Trigger */}
      <div className="bg-secondary/40 rounded p-2 text-xs">
        <div className="text-[10px] text-muted-foreground">EXECUTION TRIGGER</div>
        <div className="font-medium mt-0.5">{context.executionTrigger}</div>
      </div>
    </div>
  );
};
