import type { PerformanceTrend } from "../types/performance-context.types";

function TrendArrow({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "up") return <span className="text-emerald-400">↑</span>;
  if (direction === "down") return <span className="text-red-400">↓</span>;
  return <span className="text-muted-foreground">→</span>;
}

function TrendCompare({
  label,
  current,
  previous7d,
  previous30d,
  direction,
}: PerformanceTrend) {
  const fmt = (v: number) => {
    if (Math.abs(v) >= 1000) return v.toLocaleString("pt-BR");
    if (Math.abs(v) < 10) return v.toFixed(2);
    return v.toFixed(0);
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
      <TrendArrow direction={direction} />
      <div className="flex-1">
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[9px] text-muted-foreground">
          Hoje: <span className="text-foreground">{fmt(current)}</span> · 7d:{" "}
          <span className="text-foreground">{fmt(previous7d)}</span> · 30d:{" "}
          <span className="text-foreground">{fmt(previous30d)}</span>
        </div>
      </div>
      <span
        className={`text-[9px] font-bold ${
          direction === "up"
            ? "text-emerald-400"
            : direction === "down"
              ? "text-red-400"
              : "text-muted-foreground"
        }`}
      >
        {direction === "up" ? "MELHORANDO" : direction === "down" ? "PIORANDO" : "ESTÁVEL"}
      </span>
    </div>
  );
}

export function TrendsPanel({ trends }: { trends: PerformanceTrend[] }) {
  if (trends.length === 0) {
    return (
      <div className="panel p-4">
        <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
          TENDÊNCIAS
        </h3>
        <p className="text-[10px] text-muted-foreground text-center py-4">
          Dados insuficientes para tendências
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        TENDÊNCIAS
      </h3>
      <div className="space-y-2">
        {trends.map((t) => (
          <TrendCompare key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}
