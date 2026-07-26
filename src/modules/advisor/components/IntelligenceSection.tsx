import { useMemo } from "react";
import type { AdvisorContext } from "../types/advisor-context.types";
import type { PerformanceContext } from "../../performance/types/performance-context.types";
import type { AdvisorFeedEntry } from "../types/advisor-context.types";
import { AdvisorFeed } from "./AdvisorFeed";
import { PerformanceIntelligencePanel } from "../../performance/components/PerformanceIntelligencePanel";
import type { StatusTone } from "../../../components/ui/StatusBadge";

export const ADVISOR_TONE: Record<string, StatusTone> = {
  EXCELLENT: "success",
  GOOD: "success",
  WARNING: "warning",
  CRITICAL: "danger",
};

// ══════════════════════════════════════════════════════════════════════════
// PRIORITY SORT
// ══════════════════════════════════════════════════════════════════════════

const PRIORITY_ORDER: Record<string, number> = {
  DANGER: 0,
  CRITICAL: 0,
  WARNING: 1,
  HIGH: 1,
  MEDIUM: 2,
  SUCCESS: 2,
  LOW: 3,
  INFO: 4,
};

// ══════════════════════════════════════════════════════════════════════════
// MATURITY CALCULATION
// ══════════════════════════════════════════════════════════════════════════

interface MaturityFactors {
  tradeScore: number;
  dayScore: number;
  assetScore: number;
  hourScore: number;
  strategyScore: number;
  total: number;
}

function computeMaturity(ctx: PerformanceContext | null): MaturityFactors {
  if (!ctx || ctx.totalTrades === 0) {
    return { tradeScore: 0, dayScore: 0, assetScore: 0, hourScore: 0, strategyScore: 0, total: 0 };
  }

  // Trade quantity: 0-500 trades → 0-100%
  const tradeScore = Math.min(100, (ctx.totalTrades / 500) * 100);

  // Days analyzed: estimate from trade count (avg ~10 trades/day)
  const estimatedDays = Math.ceil(ctx.totalTrades / 10);
  const dayScore = Math.min(100, (estimatedDays / 30) * 100);

  // Asset diversity: count unique assets
  const assetCount = ctx.byAsset.length;
  const assetScore = Math.min(100, (assetCount / 5) * 100);

  // Hour diversity: count active hours
  const hourCount = ctx.byHour.filter((h) => h.totalTrades > 0).length;
  const hourScore = Math.min(100, (hourCount / 8) * 100);

  // Strategy diversity: count strategies used
  const strategyCount = ctx.byStrategy.length;
  const strategyScore = Math.min(100, (strategyCount / 4) * 100);

  // Weighted total
  const total =
    tradeScore * 0.50 +
    dayScore * 0.20 +
    assetScore * 0.15 +
    hourScore * 0.10 +
    strategyScore * 0.05;

  return {
    tradeScore: Math.round(tradeScore),
    dayScore: Math.round(dayScore),
    assetScore: Math.round(assetScore),
    hourScore: Math.round(hourScore),
    strategyScore: Math.round(strategyScore),
    total: Math.round(Math.min(100, total)),
  };
}

function getConfidenceLabel(pct: number): { label: string; color: string; icon: string } {
  if (pct >= 80) return { label: "Excelente", color: "text-info", icon: "🔵" };
  if (pct >= 60) return { label: "Alta", color: "text-success", icon: "🟢" };
  if (pct >= 40) return { label: "Moderada", color: "text-warning", icon: "🟡" };
  if (pct >= 20) return { label: "Baixa", color: "text-warning", icon: "🟠" };
  return { label: "Muito Baixa", color: "text-danger", icon: "🔴" };
}

// ══════════════════════════════════════════════════════════════════════════
// MATURITY BAR
// ══════════════════════════════════════════════════════════════════════════

function MaturityBar({ ctx }: { ctx: PerformanceContext | null }) {
  const m = useMemo(() => computeMaturity(ctx), [ctx]);
  const conf = useMemo(() => getConfidenceLabel(m.total), [m.total]);

  if (m.total === 0) {
    return (
      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] text-muted-foreground shrink-0">Maturidade dos dados</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[200px]" />
        <span className="text-[10px] text-muted-foreground shrink-0">0 ops · Dados insuficientes</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1">
      <span className="text-[10px] text-muted-foreground shrink-0">Maturidade dos dados</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[200px]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            m.total >= 80 ? "bg-info" :
            m.total >= 60 ? "bg-success" :
            m.total >= 40 ? "bg-warning" :
            m.total >= 20 ? "bg-warning" :
            "bg-danger"
          }`}
          style={{ width: `${m.total}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold shrink-0 ${conf.color}`}>
        {conf.icon} {conf.label}
      </span>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {m.total}%
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN SECTION
// ══════════════════════════════════════════════════════════════════════════

interface IntelligenceSectionProps {
  advisorContext: AdvisorContext | null;
  performanceContext: PerformanceContext | null;
  feedEntries: AdvisorFeedEntry[];
}

export function IntelligenceSection({
  advisorContext,
  performanceContext,
  feedEntries,
}: IntelligenceSectionProps) {
  const sortedFeed = useMemo(
    () =>
      [...feedEntries]
        .sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority] ?? 5;
          const pb = PRIORITY_ORDER[b.priority] ?? 5;
          if (pa !== pb) return pa - pb;
          return b.timestamp - a.timestamp;
        })
        .slice(0, 20),
    [feedEntries],
  );

  const hasFeed = sortedFeed.length > 0;
  const hasPerf = !!performanceContext;

  return (
    <section className="space-y-4">
      {/* Maturity Bar — when there's performance data */}
      {hasPerf && (
        <MaturityBar ctx={performanceContext} />
      )}

      {/* Feed — only when entries exist */}
      {hasFeed && <AdvisorFeed entries={sortedFeed} />}

      {/* Performance Intelligence — only when data exists */}
      {hasPerf && <PerformanceIntelligencePanel performanceContext={performanceContext} />}
    </section>
  );
}
