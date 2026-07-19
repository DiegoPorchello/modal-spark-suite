import { useMemo } from "react";
import { Clock, Target, AlertTriangle, Lightbulb } from "lucide-react";
import type { AdvisorFeedEntry } from "../types/advisor-context.types";

const TYPE_CONFIG: Record<
  AdvisorFeedEntry["type"],
  { icon: typeof Target; color: string; bg: string; label: string }
> = {
  recommendation: { icon: Target, color: "text-blue-400", bg: "bg-blue-400/10", label: "Recomendação" },
  alert: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10", label: "Alerta" },
  opportunity: { icon: Lightbulb, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Oportunidade" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AdvisorFeed({ entries }: { entries: AdvisorFeedEntry[] }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20),
    [entries],
  );

  if (sorted.length === 0) {
    return (
      <div className="col-span-12 panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="size-4 text-primary" />
          <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
            FEED DE RECOMENDAÇÕES
          </span>
        </div>
        <div className="text-xs text-muted-foreground text-center py-4">
          Nenhuma recomendação registrada ainda.
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-12 panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-4 text-primary" />
        <span className="text-[10px] tracking-widest text-muted-foreground font-semibold">
          FEED DE RECOMENDAÇÕES
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {sorted.length} entradas
        </span>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
        {sorted.map((entry) => {
          const cfg = TYPE_CONFIG[entry.type];
          const Icon = cfg.icon;

          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className={`shrink-0 mt-0.5 p-1 rounded ${cfg.bg}`}>
                <Icon className={`size-3 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-xs font-medium text-foreground truncate">{entry.title}</div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">{entry.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
