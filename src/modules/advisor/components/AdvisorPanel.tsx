import {
  Brain,
  Target,
  AlertTriangle,
  Lightbulb,
  Shield,
} from "lucide-react";
import type {
  AdvisorContext,
  AdvisorRecommendation,
  AdvisorAlert,
  AdvisorOpportunity,
} from "../types/advisor-context.types";

const STATUS_CONFIG: Record<
  AdvisorContext["overallStatus"],
  { label: string; color: string; bg: string; icon: string }
> = {
  EXCELLENT: { label: "EXCELENTE", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: "🟢" },
  GOOD: { label: "BOM", color: "text-green-400", bg: "bg-green-400/10", icon: "🟢" },
  WARNING: { label: "ATENÇÃO", color: "text-amber-400", bg: "bg-amber-400/10", icon: "🟡" },
  CRITICAL: { label: "CRÍTICO", color: "text-red-400", bg: "bg-red-400/10", icon: "🔴" },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-400/10" },
  HIGH: { color: "text-orange-400", bg: "bg-orange-400/10" },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-400/10" },
  LOW: { color: "text-blue-400", bg: "bg-blue-400/10" },
  INFO: { color: "text-blue-400", bg: "bg-blue-400/10" },
  WARNING: { color: "text-amber-400", bg: "bg-amber-400/10" },
  DANGER: { color: "text-red-400", bg: "bg-red-400/10" },
};

export function AdvisorPanel({ context }: { context: AdvisorContext | null }) {
  const hasData =
    context &&
    (context.recommendations.length > 0 ||
      context.alerts.length > 0 ||
      context.opportunities.length > 0);

  return (
    <section className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="size-4 text-primary" />
          <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
            ADVISOR INTELLIGENCE
          </span>
          {context && (
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[context.overallStatus].bg} ${STATUS_CONFIG[context.overallStatus].color}`}>
              {STATUS_CONFIG[context.overallStatus].icon} {STATUS_CONFIG[context.overallStatus].label}
            </span>
          )}
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <StatusSummary context={context} />

            {context.recommendations.length > 0 && (
              <TopRecommendation rec={context.recommendations[0]} />
            )}

            {context.alerts.length > 0 && (
              <TopAlert alert={context.alerts[0]} />
            )}

            {context.opportunities.length > 0 && (
              <TopOpportunity opp={context.opportunities[0]} />
            )}

            <RobotHealthMini context={context} />
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center gap-2 py-2 text-muted-foreground">
      <Brain className="size-3.5 opacity-40" />
      <span className="text-[11px]">Aguardando dados de performance...</span>
    </div>
  );
}

function StatusSummary({ context }: { context: AdvisorContext }) {
  const items = [
    { label: "Recomendações", value: context.recommendations.length, icon: Target, color: "text-blue-400" },
    { label: "Alertas", value: context.alerts.length, icon: AlertTriangle, color: "text-amber-400" },
    { label: "Oportunidades", value: context.opportunities.length, icon: Lightbulb, color: "text-emerald-400" },
  ];

  return (
    <>
      {items.map((item) => (
        <div key={item.label} className="col-span-4 flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <item.icon className={`size-5 ${item.color}`} />
          <div>
            <div className="text-lg font-bold text-foreground">{item.value}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function TopRecommendation({ rec }: { rec: AdvisorRecommendation }) {
  const cfg = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.MEDIUM;

  return (
    <div className="col-span-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
      <div className="flex items-center gap-2 mb-2">
        <Target className="size-3.5 text-blue-400" />
        <span className="text-[10px] tracking-widest text-blue-400 font-semibold">PRIORIZE</span>
        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          {rec.priority}
        </span>
      </div>
      <div className="text-sm font-semibold text-foreground mb-1">{rec.title}</div>
      <div className="text-[11px] text-muted-foreground">{rec.description}</div>
    </div>
  );
}

function TopAlert({ alert }: { alert: AdvisorAlert }) {
  const cfg = PRIORITY_CONFIG[alert.severity] || PRIORITY_CONFIG.WARNING;

  return (
    <div className="col-span-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="size-3.5 text-amber-400" />
        <span className="text-[10px] tracking-widest text-amber-400 font-semibold">⚠ EVITE</span>
        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
          {alert.severity}
        </span>
      </div>
      <div className="text-sm font-semibold text-foreground mb-1">{alert.title}</div>
      <div className="text-[11px] text-muted-foreground">{alert.description}</div>
    </div>
  );
}

function TopOpportunity({ opp }: { opp: AdvisorOpportunity }) {
  return (
    <div className="col-span-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-emerald-400" />
        <span className="text-[10px] tracking-widest text-emerald-400 font-semibold">💡 OPORTUNIDADE</span>
      </div>
      <div className="text-sm font-semibold text-foreground mb-1">{opp.title}</div>
      <div className="text-[11px] text-muted-foreground">{opp.description}</div>
    </div>
  );
}

function RobotHealthMini({ context }: { context: AdvisorContext }) {
  const h = context.robotHealth;

  const ringColor =
    h.score >= 80
      ? "stroke-emerald-400"
      : h.score >= 60
        ? "stroke-green-400"
        : h.score >= 40
          ? "stroke-amber-400"
          : h.score >= 20
            ? "stroke-orange-400"
            : "stroke-red-400";

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (h.score / 100) * circumference;

  const breakdownItems = [
    { label: "Win Rate", value: h.breakdown.winRate, max: 25 },
    { label: "Profit Factor", value: h.breakdown.profitFactor, max: 25 },
    { label: "Latência", value: h.breakdown.latency, max: 20 },
    { label: "Loss Streak", value: h.breakdown.lossStreak, max: 15 },
    { label: "Consistência", value: h.breakdown.consistency, max: 15 },
  ];

  return (
    <div className="col-span-12 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="size-3.5 text-primary" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          SAÚDE DO ROBÔ
        </span>
        <span className={`ml-auto text-[10px] font-semibold ${h.score >= 60 ? "text-emerald-400" : h.score >= 40 ? "text-amber-400" : "text-red-400"}`}>
          {h.score}/100 — {h.label}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r={radius} fill="none" stroke="oklch(0.2 0.03 220)" strokeWidth="5" />
            <circle
              cx="35"
              cy="35"
              r={radius}
              fill="none"
              className={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 35 35)"
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-foreground">{h.score}</span>
            <span className="text-[8px] text-muted-foreground">{h.label}</span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-5 gap-3">
          {breakdownItems.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-[9px] text-muted-foreground mb-1">{item.label}</div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(item.value / item.max) * 100}%` }}
                />
              </div>
              <div className="text-[9px] text-foreground mt-0.5">
                {item.value.toFixed(1)}/{item.max}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
