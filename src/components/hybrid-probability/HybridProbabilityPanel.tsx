import React from "react";
import { useRobot } from "../../hooks/useRobot";
import type {
  HybridProbabilityConfig,
  FlowIndexWindow,
} from "../../engine/decision/HybridProbabilityEngine";

const WINDOWS: FlowIndexWindow[] = [10, 20, 30, 40, 50];

function StatusBadge({ liberado }: { liberado: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded-md text-xs font-bold tracking-wider ${
        liberado
          ? "bg-success/15 text-success border border-success/30"
          : "bg-danger/15 text-danger border border-danger/30"
      }`}
    >
      {liberado ? "LIBERADO" : "BLOQUEADO"}
    </span>
  );
}

function ScoreCell({
  label,
  score,
  max,
  detail,
  colorClass,
}: {
  label: string;
  score: number;
  max: number;
  detail: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className={`text-lg font-bold ${colorClass}`}>
        {score}/{max}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={detail}>
        {detail}
      </div>
    </div>
  );
}

export function HybridProbabilityPanel() {
  const { state, updateConfig } = useRobot();
  const op = state.config.operationProfile;
  if (op !== "HYBRID_PROBABILITY") return null;

  const hp = state.lastAnalysis?.hybridProbability;
  const cfg = state.config.hybridProbabilityConfig;
  if (!cfg) return null;

  // Resolve optional config with defaults
  const trendWeight = cfg.trendWeight ?? 0.20;
  const momentumWeight = cfg.momentumWeight ?? 0.35;
  const flowWeight = cfg.flowWeight ?? 0.15;
  const databaseWeight = cfg.databaseWeight ?? 0.15;
  const exhaustionWeight = cfg.exhaustionWeight ?? 0.15;
  const minProbability = cfg.minProbability ?? cfg.minScore ?? 65;

  const setCfg = (patch: Partial<HybridProbabilityConfig>) =>
    updateConfig({ hybridProbabilityConfig: { ...cfg, ...patch } });

  const liberado = hp?.status === "liberado";

  const trendFilter = hp?.filters.find((f) => f.id === "trend");
  const momentumFilter = hp?.filters.find((f) => f.id === "momentum");
  const flowFilter = hp?.filters.find((f) => f.id === "flow");
  const databaseFilter = hp?.filters.find((f) => f.id === "database");
  const exhaustionFilter = hp?.filters.find((f) => f.id === "exhaustion");

  const scoreColor = (score: number, threshold: number) =>
    score >= threshold + 20 ? "text-success" :
    score >= threshold ? "text-info" : "text-danger";

  return (
    <section className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide">
            HYBRID PROBABILITY V2 — MOTOR DE DECISAO
          </h3>
          <StatusBadge liberado={!!liberado} />
        </div>

        {/* Probability Final */}
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Probability Final
            </div>
            <div className="text-[10px] text-muted-foreground">
              threshold: {minProbability}
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div className={`text-3xl font-bold ${hp ? scoreColor(hp.score, minProbability) : "text-foreground"}`}>
              {hp ? `${hp.score}%` : "---"}
            </div>
            <div className="text-sm text-muted-foreground">
              {hp?.decisionScore.classification ?? "aguardando"}
            </div>
          </div>
          {hp && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">
              {hp.decisionScore.formula}
            </div>
          )}
        </div>

        {/* 5 Score Cells */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <ScoreCell
            label="Trend"
            score={trendFilter?.points ?? 0}
            max={trendFilter?.maxPoints ?? 100}
            detail={trendFilter?.detail ?? "---"}
            colorClass={trendFilter ? scoreColor(trendFilter.points, 50) : "text-foreground"}
          />
          <ScoreCell
            label="Momentum"
            score={momentumFilter?.points ?? 0}
            max={momentumFilter?.maxPoints ?? 100}
            detail={momentumFilter?.detail ?? "---"}
            colorClass={momentumFilter ? scoreColor(momentumFilter.points, 50) : "text-foreground"}
          />
          <ScoreCell
            label="Flow"
            score={flowFilter?.points ?? 0}
            max={flowFilter?.maxPoints ?? 100}
            detail={flowFilter?.detail ?? "---"}
            colorClass={flowFilter ? scoreColor(flowFilter.points, 50) : "text-foreground"}
          />
          <ScoreCell
            label="Database"
            score={databaseFilter?.points ?? 0}
            max={databaseFilter?.maxPoints ?? 100}
            detail={databaseFilter?.detail ?? "---"}
            colorClass={databaseFilter ? scoreColor(databaseFilter.points, 50) : "text-foreground"}
          />
          <ScoreCell
            label="Exhaustion (penalidade)"
            score={exhaustionFilter?.points ?? 0}
            max={exhaustionFilter?.maxPoints ?? 50}
            detail={exhaustionFilter?.detail ?? "---"}
            colorClass="text-warning"
          />
        </div>

        {/* Direction + Setup Info */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Direcao
            </div>
            <div className={`text-lg font-bold ${
              hp?.direction === "CALL" ? "text-success" :
              hp?.direction === "PUT" ? "text-danger" : "text-foreground"
            }`}>
              {hp?.direction ?? "AGUARDAR"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Setup 2C
            </div>
            <div className="text-lg font-bold text-foreground">
              {hp?.setup.detected
                ? `${hp.setup.color === "GREEN" ? "VERDE" : "VERMELHA"}`
                : "---"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {hp?.setup.detected ? "Contribui p/ Momentum" : "Sem impacto"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Historico
            </div>
            <div className="text-lg font-bold text-foreground">
              {hp?.historicalPatterns ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {hp?.historicalWinrate !== null ? `WR ${hp?.historicalWinrate?.toFixed(1) ?? 0}%` : "Sem dados"}
            </div>
          </div>
        </div>

        {/* Score Bars */}
        {hp && hp.filters.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Scores
            </div>
            <div className="space-y-1.5">
              {hp.filters.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-muted-foreground">{f.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                    <div
                      className={`h-full ${f.id === "exhaustion" ? "bg-warning" : f.passed ? "bg-success" : "bg-danger"}`}
                      style={{ width: `${Math.max(2, (f.points / f.maxPoints) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">
                    {f.points}/{f.maxPoints}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Motivos do bloqueio */}
        {hp && hp.status === "bloqueado" && hp.blockedReasons.length > 0 && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-danger mb-1">
              Motivos do bloqueio
            </div>
            <ul className="list-disc list-inside text-xs text-danger space-y-0.5">
              {hp.blockedReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground mb-4 italic">
          {hp?.reason ?? "Aguardando dados de candles..."}
        </div>

        {/* Configuracao */}
        <div className="border-t border-border pt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
            Configuracao
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Trend Weight (%)</span>
              <input
                type="number"
                step="5"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={Math.round(trendWeight * 100)}
                min={0}
                max={100}
                onChange={(e) => setCfg({ trendWeight: Number(e.target.value) / 100 })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Momentum Weight (%)</span>
              <input
                type="number"
                step="5"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={Math.round(momentumWeight * 100)}
                min={0}
                max={100}
                onChange={(e) => setCfg({ momentumWeight: Number(e.target.value) / 100 })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Flow Weight (%)</span>
              <input
                type="number"
                step="5"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={Math.round(flowWeight * 100)}
                min={0}
                max={100}
                onChange={(e) => setCfg({ flowWeight: Number(e.target.value) / 100 })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Database Weight (%)</span>
              <input
                type="number"
                step="5"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={Math.round(databaseWeight * 100)}
                min={0}
                max={100}
                onChange={(e) => setCfg({ databaseWeight: Number(e.target.value) / 100 })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Exhaustion Weight (%)</span>
              <input
                type="number"
                step="5"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={Math.round(exhaustionWeight * 100)}
                min={0}
                max={100}
                onChange={(e) => setCfg({ exhaustionWeight: Number(e.target.value) / 100 })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Probability Threshold</span>
              <input
                type="number"
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={minProbability}
                min={0}
                max={100}
                onChange={(e) => setCfg({ minProbability: Number(e.target.value) })}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Janela Flow Index</span>
              <select
                className="bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                value={cfg.flowIndexWindow}
                onChange={(e) =>
                  setCfg({ flowIndexWindow: Number(e.target.value) as FlowIndexWindow })
                }
              >
                {WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {w} candles
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={cfg.ema200Enabled}
                onChange={(e) => setCfg({ ema200Enabled: e.target.checked })}
              />
              <span className="text-muted-foreground">Usar EMA 200 (tendencia)</span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
