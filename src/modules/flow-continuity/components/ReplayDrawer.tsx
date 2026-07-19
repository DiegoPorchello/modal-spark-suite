import { useState, useEffect, useCallback } from "react";
import { X, Play, Pause, SkipForward, RotateCcw, Brain, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { ReplayContext } from "../types/replay-context.types";

const STEP_LABELS: Record<string, string> = {
  "market.classified": "Mercado classificado",
  "strategy.selected": "Estratégia selecionada",
  "score.calculated": "Score calculado",
  "filters.approved": "Filtros aprovados",
  "decision.made": "Decisão tomada",
  "order.sent": "Ordem enviada",
  "broker.confirmed": "Broker confirmou",
  "trade.opened": "Operação aberta",
  "trade.closed": "Operação encerrada",
};

const STEP_COLORS: Record<string, string> = {
  "market.classified": "bg-blue-500",
  "strategy.selected": "bg-purple-500",
  "score.calculated": "bg-amber-500",
  "filters.approved": "bg-emerald-500",
  "decision.made": "bg-cyan-500",
  "order.sent": "bg-orange-500",
  "broker.confirmed": "bg-green-500",
  "trade.opened": "bg-blue-400",
  "trade.closed": "bg-emerald-400",
};

const STEP_DOT_COLORS: Record<string, string> = {
  "market.classified": "border-blue-500 bg-blue-500",
  "strategy.selected": "border-purple-500 bg-purple-500",
  "score.calculated": "border-amber-500 bg-amber-500",
  "filters.approved": "border-emerald-500 bg-emerald-500",
  "decision.made": "border-cyan-500 bg-cyan-500",
  "order.sent": "border-orange-500 bg-orange-500",
  "broker.confirmed": "border-green-500 bg-green-500",
  "trade.opened": "border-blue-400 bg-blue-400",
  "trade.closed": "border-emerald-400 bg-emerald-400",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildNarrative(ctx: ReplayContext): string {
  const d = ctx.decisionContext;
  const o = ctx.operationContext;
  const lines: string[] = [];
  const timeStr = formatTime(d.timestamp);

  lines.push(`Às ${timeStr} o mercado foi classificado como ${d.trend}.`);
  lines.push(`A estratégia selecionada foi ${d.strategyName}.`);
  lines.push(`O ScoreEngine calculou ${d.finalScore} pontos.`);
  lines.push(`A estratégia aprovou ${d.approvedFilters.length} filtros.`);
  lines.push(`A decisão foi ${d.decision}.`);
  lines.push(`A ordem foi enviada ao broker.`);
  if (o.brokerResponseTime > 0) {
    lines.push(`O broker confirmou a execução em ${o.brokerResponseTime} ms.`);
  }
  if (ctx.result === "WIN") {
    lines.push(`Após ${Math.round(ctx.durationMs / 1000)} segundos a operação foi encerrada como WIN.`);
    lines.push(`Lucro obtido: R$ ${o.profit.toFixed(2)}.`);
  } else if (ctx.result === "LOSS") {
    lines.push(`Após ${Math.round(ctx.durationMs / 1000)} segundos a operação foi encerrada como LOSS.`);
    lines.push(`Prejuízo: R$ ${Math.abs(o.profit).toFixed(2)}.`);
  } else if (ctx.result === "BREAKEVEN") {
    lines.push(`A operação foi encerrada como empate.`);
  }
  return lines.join("\n");
}

function ScoreBar({ score, label }: { score: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 85 ? "bg-success" : pct >= 70 ? "bg-success/80" : pct >= 60 ? "bg-warning" : pct >= 40 ? "bg-orange-500" : "bg-danger";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] tracking-widest text-muted-foreground">{label || "SCORE"}</span>
        <span className="text-[11px] font-bold font-mono">{score}/100</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[8px] tracking-widest text-muted-foreground">CONFIANÇA</span>
        <span className="text-[11px] font-bold font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ease-out ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReplayDrawer({
  context,
  onClose,
}: {
  context: ReplayContext;
  onClose: () => void;
}) {
  const d = context.decisionContext;
  const o = context.operationContext;
  const [playing, setPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showNarrative, setShowNarrative] = useState(false);

  const resultColor = context.result === "WIN" ? "text-success" : context.result === "LOSS" ? "text-danger" : context.result === "BREAKEVEN" ? "text-warning" : "text-muted-foreground";
  const resultBg = context.result === "WIN" ? "bg-success/10" : context.result === "LOSS" ? "bg-danger/10" : "bg-secondary";
  const profitColor = context.profit > 0 ? "text-success" : context.profit < 0 ? "text-danger" : "text-muted-foreground";
  const profitSign = context.profit > 0 ? "+" : "";
  const durationSec = Math.round(context.durationMs / 1000);

  const totalSteps = context.timeline.length;

  const resetAnimation = useCallback(() => {
    setVisibleCount(0);
    setPlaying(false);
    setShowNarrative(false);
  }, []);

  const skipToEnd = useCallback(() => {
    setVisibleCount(totalSteps);
    setPlaying(false);
    setTimeout(() => setShowNarrative(true), 300);
  }, [totalSteps]);

  useEffect(() => {
    if (!playing || visibleCount >= totalSteps) {
      if (visibleCount >= totalSteps && playing) {
        setPlaying(false);
        setTimeout(() => setShowNarrative(true), 400);
      }
      return;
    }
    const timer = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [playing, visibleCount, totalSteps]);

  const handlePlay = useCallback(() => {
    if (visibleCount >= totalSteps) {
      resetAnimation();
      setTimeout(() => setPlaying(true), 200);
    } else {
      setPlaying(true);
    }
  }, [visibleCount, totalSteps, resetAnimation]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[520px] max-w-[95vw] h-full bg-card border-l border-border shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="size-4 text-primary" />
              <h2 className="text-sm font-bold">REPLAY COMPLETO</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={resetAnimation}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Reiniciar"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>{d.asset}</span>
            <span>•</span>
            <span>{d.timeframe}</span>
            <span>•</span>
            <span>{formatTime(context.operationStartTime)}</span>
            <span>•</span>
            <span>{durationSec}s</span>
          </div>
        </div>

        {/* Result Banner */}
        <div className={`px-5 py-4 ${resultBg}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-xl font-bold ${resultColor}`}>{context.result}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{o.direction} • {d.strategyName}</div>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${profitColor}`}>{profitSign}R$ {context.profit.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Score: {o.score}/100</div>
            </div>
          </div>
        </div>

        {/* 3-Column Summary */}
        <div className="px-5 py-4 border-b border-border">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/40 rounded-lg p-2.5">
              <div className="text-[8px] tracking-widest text-muted-foreground mb-1.5">TIMELINE</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Mercado</span><span className="font-medium">{d.trend}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Volatilidade</span><span className="font-medium">{d.volatility}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Bias</span><span className="font-medium">{d.bias}</span></div>
              </div>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2.5">
              <div className="text-[8px] tracking-widest text-muted-foreground mb-1.5">DECISÃO</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Score</span><span className="font-medium">{d.finalScore}/{d.minimumScore}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Filtros</span><span className="font-medium">{d.approvedFilters.length}/{d.approvedFilters.length + d.rejectedFilters.length}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Confiança</span><span className="font-medium">{Math.round(d.confidence * 100)}%</span></div>
              </div>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2.5">
              <div className="text-[8px] tracking-widest text-muted-foreground mb-1.5">OPERAÇÃO</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Latência</span><span className="font-medium">{o.executionLatency}ms</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Broker</span><span className="font-medium">{o.brokerResponseTime}ms</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">Expiração</span><span className="font-medium">{o.expiration}s</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Score + Confidence Bars */}
        <div className="px-5 py-4 border-b border-border space-y-3">
          <ScoreBar score={o.score} />
          <ConfidenceBar value={d.confidence} />
        </div>

        {/* Playback Controls + Animated Timeline */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] tracking-widest text-muted-foreground">CRONOLOGIA COMPLETA</div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePlay}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  playing ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
                {playing ? "Pausar" : visibleCount >= totalSteps ? "Replay" : "▶ Assistir"}
              </button>
              <button
                onClick={skipToEnd}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-[10px] font-semibold hover:bg-secondary/80 transition-colors"
              >
                <SkipForward className="size-3" />
              </button>
            </div>
          </div>

          <div className="relative">
            {context.timeline.map((event, i) => {
              const isVisible = i < visibleCount;
              const isCurrent = i === visibleCount - 1 && playing;
              const isLast = i === context.timeline.length - 1;
              const dotColor = STEP_DOT_COLORS[event.step] || "border-muted-foreground bg-muted-foreground";

              return (
                <div
                  key={event.stepIndex}
                  className={`flex items-start gap-3 pb-4 transition-all duration-300 ${
                    isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`size-3 rounded-full border-2 shrink-0 transition-all duration-300 ${
                      isVisible ? dotColor : "border-border bg-transparent"
                    } ${isCurrent ? "ring-2 ring-primary/30 ring-offset-1 ring-offset-card" : ""}`} />
                    {!isLast && (
                      <div className={`w-0.5 flex-1 mt-1 transition-all duration-500 ${
                        i < visibleCount - 1 ? "bg-border" : "bg-border/30"
                      }`} />
                    )}
                  </div>

                  <div className={`flex-1 ${isLast ? "" : "pb-2 border-b border-border/40"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold transition-colors duration-300 ${
                        isVisible ? "text-foreground/90" : "text-foreground/30"
                      }`}>
                        {STEP_LABELS[event.step] || event.step}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-0.5 transition-colors duration-300 ${
                      isVisible ? "text-foreground/60" : "text-foreground/20"
                    }`}>
                      {event.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress indicator */}
          {playing && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/40">
              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(visibleCount / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground font-mono">{visibleCount}/{totalSteps}</span>
            </div>
          )}
        </div>

        {/* Filters - Confirmados / Rejeitados / Pendentes */}
        <div className="px-5 py-4 border-t border-border">
          <div className="text-[9px] tracking-widest text-muted-foreground mb-3">FILTROS</div>

          {/* Confirmados */}
          {d.approvedFilters.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="size-3 text-success" />
                <span className="text-[10px] font-semibold text-success">Confirmados ({d.approvedFilters.length})</span>
              </div>
              <div className="space-y-1">
                {d.approvedFilters.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-[10px] bg-success/5 border border-success/10 rounded-lg px-2.5 py-1.5">
                    <span className="text-foreground/80">{f.name}</span>
                    <span className="text-success font-mono font-bold">+{f.contribution}/{f.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejeitados */}
          {d.rejectedFilters.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <XCircle className="size-3 text-danger" />
                <span className="text-[10px] font-semibold text-danger">Rejeitados ({d.rejectedFilters.length})</span>
              </div>
              <div className="space-y-1">
                {d.rejectedFilters.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-[10px] bg-danger/5 border border-danger/10 rounded-lg px-2.5 py-1.5">
                    <span className="text-foreground/80">{f.name}</span>
                    <span className="text-danger font-mono font-bold">{f.contribution}/{f.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendentes */}
          {d.pendingFilters.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="size-3 text-warning" />
                <span className="text-[10px] font-semibold text-warning">Pendentes ({d.pendingFilters.length})</span>
              </div>
              <div className="space-y-1">
                {d.pendingFilters.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-[10px] bg-warning/5 border border-warning/10 rounded-lg px-2.5 py-1.5">
                    <span className="text-foreground/80">{f.name}</span>
                    <span className="text-warning font-mono font-bold">{f.contribution}/{f.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Explain Button + Narrative */}
        <div className="px-5 py-4 border-t border-border">
          {!showNarrative ? (
            <button
              onClick={() => setShowNarrative(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold hover:bg-primary/15 transition-all duration-200"
            >
              <Brain className="size-4" />
              Explicar esta operação
            </button>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-[9px] tracking-widest text-primary mb-2">NARRATIVA DA IA</div>
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <Brain className="size-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">
                    {buildNarrative(context)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
