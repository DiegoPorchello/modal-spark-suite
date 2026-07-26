import { Play, TrendingUp, CheckCircle2, Trophy, RotateCcw } from "lucide-react";
import type { ReplayContext } from "../types/replay-context.types";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const STEP_LABELS: Record<string, string> = {
  "market.classified": "Mercado analisado",
  "strategy.selected": "Estratégia",
  "score.calculated": "Score",
  "filters.approved": "Filtros",
  "decision.made": "Decisão",
  "order.sent": "Ordem enviada",
  "broker.confirmed": "Broker confirmou",
  "trade.opened": "Operação aberta",
  "trade.closed": "Resultado",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  "market.classified": <TrendingUp className="size-3" />,
  "strategy.selected": <RotateCcw className="size-3" />,
  "score.calculated": <span className="text-[10px] font-bold">🎯</span>,
  "filters.approved": <CheckCircle2 className="size-3" />,
  "decision.made": <span className="text-[10px] font-bold">⚖️</span>,
  "order.sent": <span className="text-[10px]">📤</span>,
  "broker.confirmed": <CheckCircle2 className="size-3" />,
  "trade.opened": <Play className="size-3" />,
  "trade.closed": <Trophy className="size-3" />,
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ScoreBarInline({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 85 ? "bg-success" : pct >= 70 ? "bg-success/80" : pct >= 60 ? "bg-warning" : pct >= 40 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex-1 bg-secondary/40 rounded p-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] text-muted-foreground">SCORE</div>
        <div className="text-[10px] font-bold font-mono">{score}</div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfidenceBarInline({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex-1 bg-secondary/40 rounded p-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[8px] text-muted-foreground">CONFIANÇA</div>
        <div className="text-[10px] font-bold font-mono">{pct}%</div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReplayCard({
  context,
  onOpenDrawer,
}: {
  context: ReplayContext;
  onOpenDrawer: () => void;
}) {
  const d = context.decisionContext;
  const o = context.operationContext;
  const resultColor = context.result === "WIN" ? "text-success" : context.result === "LOSS" ? "text-danger" : context.result === "BREAKEVEN" ? "text-warning" : "text-muted-foreground";
  const resultBg = context.result === "WIN" ? "bg-success/10" : context.result === "LOSS" ? "bg-danger/10" : context.result === "BREAKEVEN" ? "bg-warning/10" : "bg-secondary";
  const profitColor = context.profit > 0 ? "text-success" : context.profit < 0 ? "text-danger" : "text-muted-foreground";
  const profitSign = context.profit > 0 ? "+" : "";
  const durationSec = Math.round(context.durationMs / 1000);

  return (
    <PanelCard
      icon={Play}
      title="Replay da Última Operação"
      description="Reconstrução da operação monitorada."
      status={
        <StatusBadge
          tone={context.result === "WIN" ? "success" : context.result === "LOSS" ? "danger" : context.result === "BREAKEVEN" ? "warning" : "neutral"}
          label={context.result || "AGUARDANDO"}
        />
      }
      headerExtra={
        <button
          onClick={onOpenDrawer}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors"
        >
          <Play className="size-2.5" />
          Assistir
        </button>
      }
    >

      {/* Result Header */}
      <div className={`rounded-lg p-3 mb-3 ${resultBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${resultColor}`}>{context.result}</span>
            <div>
              <div className="text-[10px] text-muted-foreground">{d.asset}</div>
              <div className="text-[11px] font-semibold">{o.direction}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-bold ${profitColor}`}>{profitSign}R$ {context.profit.toFixed(2)}</div>
            <div className="text-[9px] text-muted-foreground">{durationSec}s</div>
          </div>
        </div>
      </div>

      {/* Timeline Summary */}
      <div className="space-y-1.5">
        {context.timeline.slice(0, 7).map((event, i) => {
          const isLast = i === Math.min(context.timeline.length - 1, 6);
          return (
            <div key={event.stepIndex} className="flex items-center gap-2">
              <div className="flex items-center justify-center size-5 rounded-full bg-secondary/60 text-primary shrink-0">
                {STEP_ICONS[event.step] || <span className="text-[9px]">📌</span>}
              </div>
              <div className={`flex-1 flex items-center justify-between ${isLast ? "" : "border-b border-border/40 pb-1.5"}`}>
                <span className="text-[10px] text-foreground/80">{STEP_LABELS[event.step] || event.step}</span>
                <span className="text-[9px] text-muted-foreground font-mono">{formatTime(event.timestamp)}</span>
              </div>
            </div>
          );
        })}
        {context.timeline.length > 7 && (
          <div className="text-[9px] text-muted-foreground text-center pt-1">+ {context.timeline.length - 7} eventos</div>
        )}
      </div>

      {/* Score + Confidence Bars */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <ScoreBarInline score={o.score} />
        <ConfidenceBarInline value={d.confidence} />
      </div>
    </PanelCard>
  );
}
