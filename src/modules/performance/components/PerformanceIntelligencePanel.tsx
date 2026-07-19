import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  Clock,
  Zap,
  Activity,
  BarChart3,
  Filter,
  Flame,
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Star,
} from "lucide-react";
import type { PerformanceContext, PerformanceInsight, RobotHealthScore, HeatmapData, PerformanceTrend } from "../types/performance-context.types";

// ══════════════════════════════════════════════════════════════════════════
// ROBOT HEALTH SCORE CARD
// ══════════════════════════════════════════════════════════════════════════

function RobotHealthCard({ health }: { health: RobotHealthScore }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (health.score / 100) * circumference;

  const ringColor =
    health.score >= 80
      ? "stroke-emerald-400"
      : health.score >= 60
        ? "stroke-green-400"
        : health.score >= 40
          ? "stroke-amber-400"
          : health.score >= 20
            ? "stroke-orange-400"
            : "stroke-red-400";

  const breakdownItems = [
    { label: "Win Rate", value: health.breakdown.winRate, max: 25 },
    { label: "Profit Factor", value: health.breakdown.profitFactor, max: 25 },
    { label: "Latência", value: health.breakdown.latency, max: 20 },
    { label: "Sequência Loss", value: health.breakdown.lossStreak, max: 15 },
    { label: "Consistência", value: health.breakdown.consistency, max: 15 },
  ];

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="size-4 text-primary" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          ROBOT HEALTH SCORE
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative shrink-0">
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={radius} fill="none" stroke="oklch(0.2 0.03 220)" strokeWidth="8" />
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              className={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 65 65)"
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold text-foreground">{health.score}</span>
            <span className={`text-[10px] font-bold ${health.color}`}>{health.label}</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2">
          {breakdownItems.map((item) => {
            const pct = Math.min(100, (item.value / item.max) * 100);
            const barColor =
              pct >= 80
                ? "bg-emerald-400"
                : pct >= 50
                  ? "bg-green-400"
                  : pct >= 30
                    ? "bg-amber-400"
                    : "bg-red-400";
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-[9px] mb-0.5">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground">
                    {item.value.toFixed(1)}/{item.max}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// PERFORMANCE INTELLIGENCE SUMMARY
// ══════════════════════════════════════════════════════════════════════════

function PerformanceSummaryCard({ ctx }: { ctx: PerformanceContext }) {
  const metrics = [
    { label: "WIN RATE", value: `${ctx.winRate}%`, color: ctx.winRate >= 50 ? "text-emerald-400" : "text-red-400" },
    { label: "PROFIT FACTOR", value: `${ctx.profitFactor}x`, color: ctx.profitFactor >= 1.5 ? "text-emerald-400" : ctx.profitFactor >= 1 ? "text-amber-400" : "text-red-400" },
    { label: "ROI", value: `${ctx.roi}%`, color: ctx.roi >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "EXPECTANCY", value: `R$ ${ctx.expectancy.toFixed(2)}`, color: ctx.expectancy >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "TOTAL TRADES", value: String(ctx.totalTrades), color: "text-foreground" },
    { label: "LUCRO LÍQUIDO", value: `R$ ${ctx.netProfit.toFixed(2)}`, color: ctx.netProfit >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "SCORE MÉDIO", value: String(ctx.averageScore), color: "text-primary" },
    { label: "CONFIANÇA MÉDIA", value: `${ctx.averageConfidence}%`, color: "text-primary" },
  ];

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="size-4 text-primary" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          PERFORMANCE INTELLIGENCE
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="p-2.5 rounded-lg bg-secondary/30">
            <div className="text-[8px] tracking-widest text-muted-foreground mb-1">{m.label}</div>
            <div className={`text-sm font-extrabold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STRATEGY RANKING
// ══════════════════════════════════════════════════════════════════════════

function StrategyRanking({ strategies }: { strategies: PerformanceContext["byStrategy"] }) {
  const sorted = useMemo(() => [...strategies].sort((a, b) => b.winRate - a.winRate || b.netProfit - a.netProfit), [strategies]);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="size-4 text-amber-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          TOP ESTRATÉGIAS
        </span>
      </div>
      <div className="text-[8px] text-muted-foreground grid grid-cols-12 gap-1 px-2 pb-1.5 border-b border-border tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-4">NOME</span>
        <span className="col-span-2 text-right">WIN RATE</span>
        <span className="col-span-2 text-right">OPS</span>
        <span className="col-span-3 text-right">LUCRO</span>
      </div>
      <div className="divide-y divide-border/50 max-h-[200px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados de operações...
          </div>
        )}
        {sorted.map((s, i) => (
          <div key={s.strategyId} className="grid grid-cols-12 gap-1 px-2 py-2 text-[10px] hover:bg-accent/20">
            <span className="col-span-1 font-bold text-amber-400">{i + 1}</span>
            <span className="col-span-4 font-medium truncate">{s.strategyName}</span>
            <span className={`col-span-2 text-right font-mono font-bold ${s.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              {s.winRate}%
            </span>
            <span className="col-span-2 text-right font-mono">{s.totalTrades}</span>
            <span className={`col-span-3 text-right font-mono font-bold ${s.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              R$ {s.netProfit.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ASSET RANKING
// ══════════════════════════════════════════════════════════════════════════

function AssetRanking({ assets }: { assets: PerformanceContext["byAsset"] }) {
  const sorted = useMemo(() => [...assets].sort((a, b) => b.winRate - a.winRate || b.netProfit - a.netProfit), [assets]);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="size-4 text-blue-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          MELHORES ATIVOS
        </span>
      </div>
      <div className="text-[8px] text-muted-foreground grid grid-cols-12 gap-1 px-2 pb-1.5 border-b border-border tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-4">ATIVO</span>
        <span className="col-span-3 text-right">WIN RATE</span>
        <span className="col-span-2 text-right">PROFIT</span>
        <span className="col-span-2 text-right">OPS</span>
      </div>
      <div className="divide-y divide-border/50 max-h-[200px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados de operações...
          </div>
        )}
        {sorted.map((a, i) => (
          <div key={a.asset} className="grid grid-cols-12 gap-1 px-2 py-2 text-[10px] hover:bg-accent/20">
            <span className="col-span-1 font-bold text-blue-400">{i + 1}</span>
            <span className="col-span-4 font-mono font-medium">{a.asset}</span>
            <span className={`col-span-3 text-right font-mono font-bold ${a.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              {a.winRate}%
            </span>
            <span className={`col-span-2 text-right font-mono font-bold ${a.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              R$ {a.netProfit.toFixed(2)}
            </span>
            <span className="col-span-2 text-right font-mono">{a.totalTrades}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HOUR RANKING
// ══════════════════════════════════════════════════════════════════════════

function HourRanking({ hours }: { hours: PerformanceContext["byHour"] }) {
  const sorted = useMemo(() => [...hours].sort((a, b) => b.netProfit - a.netProfit), [hours]);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-4 text-purple-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          MELHORES HORÁRIOS
        </span>
      </div>
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados de operações...
          </div>
        )}
        {sorted.map((h) => {
          const barWidth = Math.min(100, Math.abs(h.netProfit) * 5);
          const barColor = h.netProfit >= 0 ? "bg-emerald-400" : "bg-red-400";
          return (
            <div key={h.hour} className="flex items-center gap-2 text-[10px]">
              <span className="w-[32px] font-mono font-bold text-muted-foreground">{h.hour}h</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`w-[60px] text-right font-mono font-bold ${h.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                R$ {h.netProfit.toFixed(2)}
              </span>
              <span className="w-[36px] text-right font-mono text-muted-foreground">{h.winRate}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FILTER RANKING
// ══════════════════════════════════════════════════════════════════════════

function FilterRanking({ filters }: { filters: PerformanceContext["byFilter"] }) {
  const sorted = useMemo(() => [...filters].sort((a, b) => b.approvalWinRate - a.approvalWinRate), [filters]);

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="size-4 text-cyan-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          RANKING DE FILTROS
        </span>
      </div>
      <div className="space-y-2 max-h-[220px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados de operações...
          </div>
        )}
        {sorted.map((f) => {
          const barWidth = f.approvalWinRate;
          const barColor =
            f.approvalWinRate >= 70
              ? "bg-emerald-400"
              : f.approvalWinRate >= 50
                ? "bg-amber-400"
                : "bg-red-400";
          return (
            <div key={f.filterName} className="p-2 rounded bg-secondary/30">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-medium truncate">{f.filterName}</span>
                <span className={`font-mono font-bold ${f.approvalWinRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                  {f.approvalWinRate}%
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
                <span>Aprovações: {f.totalApprovals}</span>
                <span>Rejeições: {f.totalRejections}</span>
                <span>Contribuição: {f.averageContribution}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// HEATMAP COMPONENT
// ══════════════════════════════════════════════════════════════════════════

function HeatmapPanel({ heatmap }: { heatmap: HeatmapData }) {
  const maxValue = useMemo(() => {
    const vals = heatmap.cells.filter((c) => c.value > 0).map((c) => c.value);
    return vals.length > 0 ? Math.max(...vals) : 100;
  }, [heatmap]);

  function getHeatColor(value: number): string {
    if (value === 0) return "bg-secondary/30";
    const intensity = value / maxValue;
    if (intensity >= 0.8) return "bg-emerald-500/60";
    if (intensity >= 0.6) return "bg-emerald-500/40";
    if (intensity >= 0.4) return "bg-amber-500/40";
    if (intensity >= 0.2) return "bg-orange-500/30";
    return "bg-red-500/20";
  }

  if (heatmap.rows.length === 0 || heatmap.cols.length === 0) {
    return null;
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="size-4 text-orange-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          {heatmap.title}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Header */}
          <div className="flex">
            <div className="w-[50px] shrink-0" />
            {heatmap.cols.map((col) => (
              <div
                key={col}
                className="w-[70px] shrink-0 text-center text-[7px] font-bold text-muted-foreground px-1 pb-1 truncate"
                title={col}
              >
                {col.length > 8 ? col.slice(0, 8) + "…" : col}
              </div>
            ))}
          </div>
          {/* Rows */}
          {heatmap.rows.map((row) => (
            <div key={row} className="flex items-center">
              <div className="w-[50px] shrink-0 text-[8px] font-bold text-muted-foreground pr-1 text-right">
                {row}
              </div>
              {heatmap.cols.map((col) => {
                const cell = heatmap.cells.find((c) => c.row === row && c.col === col);
                return (
                  <div
                    key={`${row}-${col}`}
                    className={`w-[70px] shrink-0 h-[28px] flex items-center justify-center text-[8px] font-mono font-bold rounded m-[1px] ${getHeatColor(cell?.value ?? 0)} text-foreground/80 cursor-default`}
                    title={cell?.label ?? "Sem dados"}
                  >
                    {cell?.value ?? 0}%
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TRENDS COMPONENT
// ══════════════════════════════════════════════════════════════════════════

function TrendsPanel({ trends }: { trends: PerformanceTrend[] }) {
  const TrendIcon = ({ direction }: { direction: "up" | "down" | "stable" }) => {
    if (direction === "up") return <ArrowUp className="size-3 text-emerald-400" />;
    if (direction === "down") return <ArrowDown className="size-3 text-red-400" />;
    return <Minus className="size-3 text-muted-foreground" />;
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-4 text-emerald-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          TENDÊNCIAS
        </span>
      </div>
      <div className="space-y-2">
        {trends.map((t) => (
          <div key={t.label} className="p-2 rounded bg-secondary/30">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-medium">{t.label}</span>
              <TrendIcon direction={t.direction} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              <div>
                <div className="text-muted-foreground">Atual</div>
                <div className="font-mono font-bold">{t.current}</div>
              </div>
              <div>
                <div className="text-muted-foreground">7 dias</div>
                <div className="font-mono">{t.previous7d}</div>
              </div>
              <div>
                <div className="text-muted-foreground">30 dias</div>
                <div className="font-mono">{t.previous30d}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// INSIGHTS COMPONENT
// ══════════════════════════════════════════════════════════════════════════

function InsightsPanel({ insights }: { insights: PerformanceInsight[] }) {
  const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
    SUCCESS: {
      icon: <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />,
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
    },
    INFO: {
      icon: <Brain className="size-3.5 text-blue-400 shrink-0" />,
      bg: "bg-blue-500/5",
      border: "border-blue-500/20",
      text: "text-blue-400",
    },
    WARNING: {
      icon: <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />,
      bg: "bg-amber-500/5",
      border: "border-amber-500/20",
      text: "text-amber-400",
    },
    DANGER: {
      icon: <AlertTriangle className="size-3.5 text-red-400 shrink-0" />,
      bg: "bg-red-500/5",
      border: "border-red-500/20",
      text: "text-red-400",
    },
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Star className="size-4 text-amber-400" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          INSIGHTS
        </span>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {insights.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Aguardando dados para gerar insights...
          </div>
        )}
        {insights.map((insight) => {
          const config = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.INFO;
          return (
            <div
              key={insight.id}
              className={`p-2.5 rounded-lg border ${config.bg} ${config.border}`}
            >
              <div className="flex items-start gap-2">
                {config.icon}
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-bold ${config.text}`}>{insight.title}</div>
                  <div className="text-[9px] text-foreground/70 mt-0.5">{insight.description}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PANEL (exported)
// ══════════════════════════════════════════════════════════════════════════

export function PerformanceIntelligencePanel({
  performanceContext,
}: {
  performanceContext: PerformanceContext | null;
}) {
  if (!performanceContext) {
    return (
      <div className="panel col-span-12 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="size-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-wide">PERFORMANCE INTELLIGENCE</h3>
        </div>
        <div className="text-xs text-muted-foreground text-center py-8">
          Inicie o robô para gerar dados de performance...
        </div>
      </div>
    );
  }

  const ctx = performanceContext;

  return (
    <div className="space-y-4">
      {/* Row 1: Health Score + Performance Summary */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <RobotHealthCard health={ctx.robotHealth} />
        </div>
        <div className="col-span-9">
          <PerformanceSummaryCard ctx={ctx} />
        </div>
      </section>

      {/* Row 2: Insights */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <InsightsPanel insights={ctx.insights} />
        </div>
      </section>

      {/* Row 3: Rankings (Strategy + Asset + Hour) */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <StrategyRanking strategies={ctx.byStrategy} />
        </div>
        <div className="col-span-4">
          <AssetRanking assets={ctx.byAsset} />
        </div>
        <div className="col-span-4">
          <HourRanking hours={ctx.byHour} />
        </div>
      </section>

      {/* Row 4: Filter Ranking + Trends */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-6">
          <FilterRanking filters={ctx.byFilter} />
        </div>
        <div className="col-span-6">
          <TrendsPanel trends={ctx.trends} />
        </div>
      </section>

      {/* Row 5: Heatmaps */}
      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-4">
          <HeatmapPanel heatmap={ctx.heatmaps.hourStrategy} />
        </div>
        <div className="col-span-4">
          <HeatmapPanel heatmap={ctx.heatmaps.assetHour} />
        </div>
        <div className="col-span-4">
          <HeatmapPanel heatmap={ctx.heatmaps.dayWeek} />
        </div>
      </section>
    </div>
  );
}
