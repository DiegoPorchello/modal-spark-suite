import {
  Brain,
  Target,
  AlertTriangle,
  Lightbulb,
  HeartPulse,
} from "lucide-react";
import type {
  AdvisorContext,
  AdvisorRecommendation,
  AdvisorAlert,
  AdvisorOpportunity,
} from "../types/advisor-context.types";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge, type StatusTone } from "../../../components/ui/StatusBadge";

const STATUS_TONE: Record<AdvisorContext["overallStatus"], StatusTone> = {
  EXCELLENT: "success",
  GOOD: "success",
  WARNING: "warning",
  CRITICAL: "danger",
};

const STATUS_LABEL: Record<AdvisorContext["overallStatus"], string> = {
  EXCELLENT: "EXCELENTE",
  GOOD: "BOM",
  WARNING: "ATENÇÃO",
  CRITICAL: "CRÍTICO",
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  CRITICAL: { color: "text-danger", bg: "bg-danger/10" },
  HIGH: { color: "text-warning", bg: "bg-warning/10" },
  MEDIUM: { color: "text-warning", bg: "bg-warning/10" },
  LOW: { color: "text-info", bg: "bg-info/10" },
  INFO: { color: "text-info", bg: "bg-info/10" },
  WARNING: { color: "text-warning", bg: "bg-warning/10" },
  DANGER: { color: "text-danger", bg: "bg-danger/10" },
};

export function AdvisorPanel({ context }: { context: AdvisorContext | null }) {
  const hasData =
    context &&
    (context.recommendations.length > 0 ||
      context.alerts.length > 0 ||
      context.opportunities.length > 0);

  return (
    <div className="col-span-12">
      <PanelCard
        icon={Brain}
        title="Inteligência do Advisor"
        description="Recomendações, alertas e saúde do robô."
        status={
          context ? (
            <StatusBadge
              tone={STATUS_TONE[context.overallStatus]}
              label={STATUS_LABEL[context.overallStatus]}
            />
          ) : (
            <StatusBadge tone="neutral" label="SEM DADOS" />
          )
        }
      >
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
      </PanelCard>
    </div>
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
    { label: "Recomendações", value: context.recommendations.length, icon: Target, color: "text-info" },
    { label: "Alertas", value: context.alerts.length, icon: AlertTriangle, color: "text-warning" },
    { label: "Oportunidades", value: context.opportunities.length, icon: Lightbulb, color: "text-success" },
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
    <div className="col-span-4 p-3 rounded-lg bg-info/5 border border-info/10">
      <div className="flex items-center gap-2 mb-2">
        <Target className="size-3.5 text-info" />
        <span className="text-[10px] tracking-widest text-info font-semibold">PRIORIZE</span>
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
    <div className="col-span-4 p-3 rounded-lg bg-warning/5 border border-warning/10">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="size-3.5 text-warning" />
        <span className="text-[10px] tracking-widest text-warning font-semibold">⚠ EVITE</span>
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
    <div className="col-span-4 p-3 rounded-lg bg-success/5 border border-success/10">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-3.5 text-success" />
        <span className="text-[10px] tracking-widest text-success font-semibold">💡 OPORTUNIDADE</span>
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
      ? "stroke-success"
      : h.score >= 60
        ? "stroke-success"
        : h.score >= 40
          ? "stroke-warning"
          : h.score >= 20
            ? "stroke-warning"
            : "stroke-danger";

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
    <PanelCard
      icon={HeartPulse}
      title="Saúde do Robô"
      description="Pontuação de saúde e estabilidade."
      status={
        <StatusBadge
          tone={h.score >= 60 ? "success" : h.score >= 40 ? "warning" : "danger"}
          label={h.label}
        />
      }
      className="col-span-12"
    >
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
    </PanelCard>
  );
}
