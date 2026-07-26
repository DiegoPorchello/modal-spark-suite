import type { PerformanceContext } from "../types/performance-context.types";

function MetricBadge({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-md bg-secondary/50">
      <span className="text-[9px] text-muted-foreground tracking-widest uppercase">
        {label}
      </span>
      <span className={`text-sm font-bold ${color ?? "text-foreground"}`}>
        {value}
        {suffix && <span className="text-[10px] ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}

function WinRateBar({ winRate }: { winRate: number }) {
  const color =
    winRate >= 60
      ? "bg-success"
      : winRate >= 50
        ? "bg-warning"
        : "bg-danger";
  return (
    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, winRate)}%` }}
      />
    </div>
  );
}

export function PerformanceIntelligenceCard({
  data,
}: {
  data: PerformanceContext;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="panel col-span-12 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold tracking-widest text-primary">
          PERFORMANCE INTELLIGENCE
        </h3>
        <span className="text-[9px] text-muted-foreground font-mono">
          {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
        </span>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-3">
        <MetricBadge
          label="Win Rate"
          value={`${data.winRate}%`}
          color={data.winRate >= 50 ? "text-success" : "text-danger"}
        />
        <MetricBadge
          label="Profit Factor"
          value={`${data.profitFactor}x`}
          color={
            data.profitFactor >= 1.5
              ? "text-success"
              : data.profitFactor >= 1
                ? "text-warning"
                : "text-danger"
          }
        />
        <MetricBadge
          label="ROI"
          value={`${data.roi}%`}
          color={data.roi >= 0 ? "text-success" : "text-danger"}
        />
        <MetricBadge
          label="Expectancy"
          value={fmt(data.expectancy)}
          color={data.expectancy >= 0 ? "text-success" : "text-danger"}
        />
        <MetricBadge label="Total Trades" value={data.totalTrades} />
        <MetricBadge
          label="Lucro Líquido"
          value={fmt(data.netProfit)}
          color={data.netProfit >= 0 ? "text-success" : "text-danger"}
        />
        <MetricBadge label="Score Médio" value={data.averageScore} />
        <MetricBadge
          label="Confiança Média"
          value={`${Math.round(data.averageConfidence * 100)}%`}
        />
      </div>

      <WinRateBar winRate={data.winRate} />

      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>W: {data.wins}</span>
        <span>L: {data.losses}</span>
        <span>D: {data.draws}</span>
        <span>
          Gross: {fmt(data.grossProfit)} / {fmt(data.grossLoss)}
        </span>
      </div>
    </div>
  );
}
