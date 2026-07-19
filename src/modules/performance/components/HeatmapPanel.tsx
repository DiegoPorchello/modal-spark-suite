import type { HeatmapData } from "../types/performance-context.types";

function getHeatColor(value: number): string {
  if (value >= 70) return "bg-emerald-500/80 text-white";
  if (value >= 60) return "bg-emerald-500/50 text-white";
  if (value >= 50) return "bg-emerald-500/30";
  if (value >= 40) return "bg-amber-500/30";
  if (value >= 30) return "bg-amber-500/50";
  if (value > 0) return "bg-red-500/30";
  return "bg-secondary text-muted-foreground";
}

function HeatmapGrid({ data }: { data: HeatmapData }) {
  if (data.rows.length === 0 || data.cols.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground text-center py-4">
        Sem dados suficientes
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[9px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-muted-foreground" />
            {data.cols.map((col) => (
              <th
                key={col}
                className="p-1 text-center text-muted-foreground font-normal max-w-16 truncate"
                title={col}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row}>
              <td className="p-1 text-muted-foreground font-mono">{row}</td>
              {data.cols.map((col) => {
                const cell = data.cells.find(
                  (c) => c.row === row && c.col === col
                );
                const value = cell?.value ?? 0;
                const label = cell?.label ?? "—";
                return (
                  <td key={col} className="p-0.5">
                    <div
                      className={`rounded px-1 py-1 text-center font-mono ${getHeatColor(value)}`}
                      title={`${row} × ${col}: ${label}`}
                    >
                      {value > 0 ? `${value}%` : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HeatmapPanel({
  hourStrategy,
  assetHour,
  dayWeek,
}: {
  hourStrategy: HeatmapData;
  assetHour: HeatmapData;
  dayWeek: HeatmapData;
}) {
  return (
    <div className="panel p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">
        HEATMAPS
      </h3>
      <div className="space-y-4">
        <div>
          <h4 className="text-[9px] text-muted-foreground mb-1">
            {hourStrategy.title}
          </h4>
          <HeatmapGrid data={hourStrategy} />
        </div>
        <div>
          <h4 className="text-[9px] text-muted-foreground mb-1">
            {assetHour.title}
          </h4>
          <HeatmapGrid data={assetHour} />
        </div>
        <div>
          <h4 className="text-[9px] text-muted-foreground mb-1">
            {dayWeek.title}
          </h4>
          <HeatmapGrid data={dayWeek} />
        </div>
      </div>
    </div>
  );
}
