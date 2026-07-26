import type { AssetPerformance } from "../types/performance-context.types";

export function AssetRanking({ assets }: { assets: AssetPerformance[] }) {
  const sorted = [...assets].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        MELHORES ATIVOS
      </h3>
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            Nenhum ativo registrado
          </p>
        )}
        {sorted.map((a, i) => (
          <div
            key={a.asset}
            className="flex items-center gap-2 p-2 rounded-md bg-secondary/50"
          >
            <span className="text-xs font-bold text-muted-foreground w-4">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">{a.asset}</div>
              <div className="text-[9px] text-muted-foreground">
                {a.totalTrades} ops · {a.wins}W/{a.losses}L
              </div>
            </div>
            <div className="text-right">
              <div
                className={`text-xs font-bold ${
                  a.netProfit >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {a.netProfit >= 0 ? "+" : ""}R${a.netProfit.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {a.winRate}% WR
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
