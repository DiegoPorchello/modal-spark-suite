import type { StrategyPerformance } from "../types/performance-context.types";

export function StrategyRanking({
  strategies,
}: {
  strategies: StrategyPerformance[];
}) {
  const sorted = [...strategies].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        TOP ESTRATÉGIAS
      </h3>
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            Nenhuma estratégia registrada
          </p>
        )}
        {sorted.map((s, i) => (
          <div
            key={s.strategyId}
            className="flex items-center gap-2 p-2 rounded-md bg-secondary/50"
          >
            <span
              className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                i === 0
                  ? "bg-warning/20 text-warning"
                  : i === 1
                    ? "bg-gray-400/20 text-gray-400"
                    : i === 2
                      ? "bg-warning/20 text-warning"
                      : "bg-secondary text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{s.strategyName}</div>
              <div className="text-[9px] text-muted-foreground">
                {s.totalTrades} ops · {s.wins}W/{s.losses}L
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xs font-bold ${
                  s.netProfit >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {s.netProfit >= 0 ? "+" : ""}R${s.netProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {s.winRate}% WR
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
