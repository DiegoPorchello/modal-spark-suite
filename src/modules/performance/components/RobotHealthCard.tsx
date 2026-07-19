import type { RobotHealthScore } from "../types/performance-context.types";

export function RobotHealthCard({ health }: { health: RobotHealthScore }) {
  const r = 54;
  const C = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, health.score));

  return (
    <div className="panel p-4 flex flex-col items-center gap-2">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground">
        ROBOT HEALTH
      </h3>
      <div className="relative size-28">
        <svg viewBox="0 0 120 120" className="size-28 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            stroke="oklch(0.3 0.03 220)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            stroke={
              health.score >= 80
                ? "oklch(0.7 0.2 155)"
                : health.score >= 60
                  ? "oklch(0.8 0.15 85)"
                  : health.score >= 40
                    ? "oklch(0.75 0.15 70)"
                    : "oklch(0.65 0.2 25)"
            }
            strokeWidth="8"
            fill="none"
            strokeDasharray={C}
            strokeDashoffset={C - (C * pct) / 100}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono">{health.score}</span>
          <span className={`text-[9px] font-bold ${health.color}`}>{health.label}</span>
        </div>
      </div>
      <div className="w-full space-y-1 text-[9px]">
        <BreakdownBar label="Win Rate" value={health.breakdown.winRate} max={25} />
        <BreakdownBar label="Profit Factor" value={health.breakdown.profitFactor} max={25} />
        <BreakdownBar label="Latência" value={health.breakdown.latency} max={20} />
        <BreakdownBar label="Sequência Loss" value={health.breakdown.lossStreak} max={15} />
        <BreakdownBar label="Consistência" value={health.breakdown.consistency} max={15} />
      </div>
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted-foreground font-mono">
        {Math.round(value)}
      </span>
    </div>
  );
}
