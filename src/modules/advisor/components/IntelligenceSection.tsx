import { useRef, useEffect, useMemo } from "react";
import {
  Brain,
  Activity,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { AdvisorContext } from "../types/advisor-context.types";
import type { PerformanceContext } from "../../performance/types/performance-context.types";
import type { AdvisorFeedEntry } from "../types/advisor-context.types";
import { AdvisorFeed } from "./AdvisorFeed";
import { PerformanceIntelligencePanel } from "../../performance/components/PerformanceIntelligencePanel";

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
  if (pct >= 80) return { label: "Excelente", color: "text-blue-400", icon: "🔵" };
  if (pct >= 60) return { label: "Alta", color: "text-emerald-400", icon: "🟢" };
  if (pct >= 40) return { label: "Moderada", color: "text-amber-400", icon: "🟡" };
  if (pct >= 20) return { label: "Baixa", color: "text-orange-400", icon: "🟠" };
  return { label: "Muito Baixa", color: "text-red-400", icon: "🔴" };
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
            m.total >= 80 ? "bg-blue-400" :
            m.total >= 60 ? "bg-emerald-400" :
            m.total >= 40 ? "bg-amber-400" :
            m.total >= 20 ? "bg-orange-400" :
            "bg-red-400"
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
// TREND INDICATOR
// ══════════════════════════════════════════════════════════════════════════

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <Minus className="size-3 text-muted-foreground" />;
  if (diff > 0) return (
    <span className="text-[10px] font-mono font-semibold text-emerald-400">
      ▲ +{diff}
    </span>
  );
  return (
    <span className="text-[10px] font-mono font-semibold text-red-400">
      ▼ {diff}
    </span>
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
  const prevScoreRef = useRef<number | null>(null);

  useEffect(() => {
    if (advisorContext?.robotHealth?.score) {
      const timer = setTimeout(() => {
        prevScoreRef.current = advisorContext.robotHealth.score;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [advisorContext?.robotHealth?.score]);

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
    <section className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-1">
        <Brain className="size-4 text-primary" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          INTELLIGENCE
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Line 1: Compact status cards — ALWAYS visible */}
      <section className="grid grid-cols-12 gap-4">
        {/* ── Robot Health ── */}
        <div className="col-span-4 panel p-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="oklch(0.2 0.03 220)" strokeWidth="4" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                className={
                  !advisorContext?.robotHealth || advisorContext.robotHealth.score === 0
                    ? "stroke-muted"
                    : advisorContext.robotHealth.score >= 80 ? "stroke-emerald-400"
                    : advisorContext.robotHealth.score >= 60 ? "stroke-green-400"
                    : advisorContext.robotHealth.score >= 40 ? "stroke-amber-400"
                    : "stroke-red-400"
                }
                strokeWidth="4" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 18}
                strokeDashoffset={advisorContext?.robotHealth
                  ? 2 * Math.PI * 18 - (advisorContext.robotHealth.score / 100) * 2 * Math.PI * 18
                  : 2 * Math.PI * 18}
                transform="rotate(-90 22 22)"
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-foreground">
                {advisorContext?.robotHealth ? advisorContext.robotHealth.score : "—"}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">ROBOT HEALTH</span>
              {advisorContext?.robotHealth && prevScoreRef.current !== null && (
                <TrendIndicator
                  current={advisorContext.robotHealth.score}
                  previous={prevScoreRef.current}
                />
              )}
            </div>
            <div className="text-xs font-medium text-foreground truncate">
              {advisorContext?.robotHealth ? advisorContext.robotHealth.label : "Aguardando"}
            </div>
          </div>
        </div>

        {/* ── Advisor ── */}
        <div className="col-span-4 panel p-3 flex items-center gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-primary/10">
            <Brain className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-muted-foreground font-semibold">ADVISOR</div>
            {!advisorContext ? (
              <div className="text-xs text-muted-foreground">Aguardando...</div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  advisorContext.overallStatus === "EXCELLENT" ? "bg-emerald-400/10 text-emerald-400" :
                  advisorContext.overallStatus === "GOOD" ? "bg-green-400/10 text-green-400" :
                  advisorContext.overallStatus === "WARNING" ? "bg-amber-400/10 text-amber-400" :
                  "bg-red-400/10 text-red-400"
                }`}>
                  {advisorContext.overallStatus === "EXCELLENT" ? "🟢" :
                   advisorContext.overallStatus === "GOOD" ? "🟢" :
                   advisorContext.overallStatus === "WARNING" ? "🟡" : "🔴"}
                  {" "}{advisorContext.overallStatus}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {advisorContext.recommendations.length} recomendações
                  {advisorContext.alerts.length > 0 && ` · ${advisorContext.alerts.length} alerta${advisorContext.alerts.length > 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Performance ── */}
        <div className="col-span-4 panel p-3 flex items-center gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-blue-500/10">
            <Activity className="size-4 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-muted-foreground font-semibold">PERFORMANCE</div>
            {!performanceContext ? (
              <div className="text-xs text-muted-foreground">0 operações</div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground">
                  {performanceContext.totalTrades} ops
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className={`text-sm font-bold ${
                  performanceContext.winRate >= 60 ? "text-emerald-400" :
                  performanceContext.winRate >= 50 ? "text-amber-400" : "text-red-400"
                }`}>
                  Win Rate {performanceContext.winRate.toFixed(0)}%
                </span>
                {performanceContext.netProfit !== 0 && (
                  <>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className={`text-[10px] font-mono font-semibold ${
                      performanceContext.netProfit > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {performanceContext.netProfit > 0 ? "+" : ""}{performanceContext.netProfit.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Maturity Bar — when there's performance data */}
      {hasPerf && (
        <MaturityBar ctx={performanceContext} />
      )}

      {/* Line 2: Feed — only when entries exist */}
      {hasFeed && <AdvisorFeed entries={sortedFeed} />}

      {/* Line 3: Performance Intelligence — only when data exists */}
      {hasPerf && <PerformanceIntelligencePanel performanceContext={performanceContext} />}
    </section>
  );
}
