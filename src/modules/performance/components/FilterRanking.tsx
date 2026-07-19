import type { FilterPerformance } from "../types/performance-context.types";

export function FilterRanking({ filters }: { filters: FilterPerformance[] }) {
  const sorted = [...filters].sort(
    (a, b) => b.approvalWinRate - a.approvalWinRate
  );

  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        RANKING DE FILTROS
      </h3>
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            Nenhum filtro registrado
          </p>
        )}
        {sorted.map((f, i) => (
          <div
            key={f.filterName}
            className="p-2 rounded-md bg-secondary/50"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold text-muted-foreground w-4">
                {i + 1}
              </span>
              <span className="text-xs font-semibold flex-1 truncate">
                {f.filterName}
              </span>
              <span
                className={`text-xs font-bold ${
                  f.approvalWinRate >= 60
                    ? "text-emerald-400"
                    : f.approvalWinRate >= 40
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {f.approvalWinRate}% WR
              </span>
            </div>
            <div className="flex gap-1 ml-6">
              <div className="flex-1">
                <div className="text-[8px] text-muted-foreground mb-0.5">
                  Aprovado ({f.totalApprovals})
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${f.approvalWinRate}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[8px] text-muted-foreground mb-0.5">
                  Rejeitado ({f.totalRejections})
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${f.rejectionWinRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
