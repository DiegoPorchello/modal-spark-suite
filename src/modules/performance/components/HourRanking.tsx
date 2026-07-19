import type { HourPerformance } from "../types/performance-context.types";

export function HourRanking({ hours }: { hours: HourPerformance[] }) {
  const sorted = [...hours].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        MELHORES HORÁRIOS
      </h3>
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            Nenhum horário registrado
          </p>
        )}
        {sorted.map((h) => (
          <div
            key={h.hour}
            className="flex items-center gap-2 p-2 rounded-md bg-secondary/50"
          >
            <span className="text-xs font-mono font-bold w-8">
              {String(h.hour).padStart(2, "0")}h
            </span>
            <div className="flex-1">
              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    h.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.abs(h.winRate))}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xs font-bold ${
                  h.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {h.netProfit >= 0 ? "+" : ""}R${h.netProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {h.winRate}% WR · {h.totalTrades} ops
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
