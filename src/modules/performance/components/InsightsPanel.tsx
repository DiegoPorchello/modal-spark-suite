import type { PerformanceInsight } from "../types/performance-context.types";

const SEVERITY_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string; borderColor: string }
> = {
  SUCCESS: {
    icon: "✓",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  INFO: {
    icon: "ℹ",
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
  },
  WARNING: {
    icon: "⚠",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
  DANGER: {
    icon: "✕",
    color: "text-danger",
    bgColor: "bg-danger/10",
    borderColor: "border-danger/20",
  },
};

function InsightItem({ insight }: { insight: PerformanceInsight }) {
  const config = SEVERITY_CONFIG[insight.severity] ?? SEVERITY_CONFIG.INFO;

  return (
    <div
      className={`flex items-start gap-2 p-2 rounded-md border ${config.bgColor} ${config.borderColor}`}
    >
      <span className={`text-sm mt-0.5 ${config.color}`}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold">{insight.title}</div>
        <div className="text-[9px] text-muted-foreground mt-0.5">
          {insight.description}
        </div>
      </div>
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: PerformanceInsight[] }) {
  if (insights.length === 0) {
    return (
      <div className="panel p-4">
        <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
          INSIGHTS
        </h3>
        <p className="text-[10px] text-muted-foreground text-center py-4">
          Nenhum insight disponível ainda
        </p>
      </div>
    );
  }

  const sorted = [...insights].sort((a, b) => {
    const order = { DANGER: 0, WARNING: 1, SUCCESS: 2, INFO: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        INSIGHTS
      </h3>
      <div className="space-y-2">
        {sorted.map((insight) => (
          <InsightItem key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
