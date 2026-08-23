import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRobot } from "../../hooks/useRobot";
import type { Candle } from "../../market/types";

const HYBRID_ASSETS = ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"];

// Ciclo determinístico de 5 velas M1 ancorado no epoch (mesma matemática do engine).
// FIXO: aprender intervalo a partir de gaps entre fechamentos corrompia a fase do
// ciclo quando um fechamento era perdido (gap 2x absorvido como novo intervalo).
const INTERVAL_MS = 60000;

function candleColor(c: Candle): "GREEN" | "RED" {
  return c.close >= c.open ? "GREEN" : "RED";
}

function candleBody(c: Candle): number {
  return Math.abs(c.close - c.open);
}

function computeSeqLen(steps: QuadrantStep[], color: "GREEN" | "RED"): number {
  let seqLen = 1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].color === color) seqLen++;
    else break;
  }
  return seqLen;
}

/**
 * ADX (Wilder) calculado localmente a partir do histórico de velas.
 * Retorna o ADX em cada índice (0 para janela insuficiente).
 */
function computeADXSeries(
  candles: { high: number; low: number; close: number }[],
  period = 14,
): number[] {
  const n = candles.length;
  const adx: number[] = new Array(n).fill(0);
  if (n < period + 1) return adx;

  const tr: number[] = new Array(n).fill(0);
  const pDM: number[] = new Array(n).fill(0);
  const mDM: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const trv = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    const up = cur.high - prev.high;
    const dn = prev.low - cur.low;
    tr[i] = trv;
    pDM[i] = up > dn && up > 0 ? up : 0;
    mDM[i] = dn > up && dn > 0 ? dn : 0;
  }

  const atr: number[] = new Array(n).fill(0);
  const sP: number[] = new Array(n).fill(0);
  const sM: number[] = new Array(n).fill(0);

  let sumTR = 0, sumP = 0, sumM = 0;
  for (let i = 1; i <= period; i++) {
    sumTR += tr[i];
    sumP += pDM[i];
    sumM += mDM[i];
  }
  atr[period] = sumTR / period;
  sP[period] = sumP / period;
  sM[period] = sumM / period;

  for (let i = period + 1; i < n; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    sP[i] = (sP[i - 1] * (period - 1) + pDM[i]) / period;
    sM[i] = (sM[i - 1] * (period - 1) + mDM[i]) / period;
  }

  const dx: number[] = new Array(n).fill(0);
  for (let i = period; i < n; i++) {
    const pDI = atr[i] !== 0 ? (sP[i] / atr[i]) * 100 : 0;
    const mDI = atr[i] !== 0 ? (sM[i] / atr[i]) * 100 : 0;
    const denom = pDI + mDI;
    dx[i] = denom !== 0 ? (Math.abs(pDI - mDI) / denom) * 100 : 0;
  }

  let sumDX = 0;
  for (let i = period; i < period + period; i++) sumDX += dx[i];
  adx[period * 2 - 1] = sumDX / period;
  for (let i = period * 2; i < n; i++) {
    adx[i] = (adx[i - 1] * (period - 1) + dx[i]) / period;
  }
  return adx;
}

function adxColorClass(adx: number): string {
  if (adx >= 25) return "text-success";
  if (adx >= 15) return "text-warning";
  return "text-danger";
}

function AdxCell({ adx }: { adx: number }) {
  const label = adx > 0 ? adx.toFixed(0) : "—";
  return (
    <span className={`tabular-nums font-bold w-9 text-center ${adxColorClass(adx)}`}>
      {label}
    </span>
  );
}

function AccelCell({ ratio, accelerating }: { ratio: number; accelerating: boolean }) {
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 40)));
  return (
    <span className="flex items-center gap-1 w-20">
      <span className="relative h-2 flex-1 rounded bg-muted/40 overflow-hidden">
        <span
          className={`absolute inset-y-0 left-0 rounded ${accelerating ? "bg-success" : "bg-danger"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={`tabular-nums text-[9px] font-bold ${accelerating ? "text-success" : "text-danger"}`}>
        {ratio.toFixed(2)}x
      </span>
    </span>
  );
}

function formatTime(ts: number) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type EntryStep = "INICIO" | "CONTINUIDADE" | "PREPARANDO" | "ENTRADA" | "RESULTADO";
type QuadrantId = "Q1" | "Q2" | "Q3" | "Q4";

interface QuadrantStep {
  index: number;
  time: number;
  color: "GREEN" | "RED";
  body: number;
  open: number;
  close: number;
  high: number;
  low: number;
  adx: number;
  seqLen: number;
  accelerating: boolean;
  accelRatio: number;
  quadrant: QuadrantId;
  probability: number;
  direction: "CALL" | "PUT";
  entryStep: EntryStep;
  actualDirection: "CALL" | "PUT";
  result: "WIN" | "LOSS" | null;
  againstDirection: boolean;
}

interface QuadrantState {
  steps: QuadrantStep[];
  currentStep: number;
  startCandleTime: number;
  cycleColor: "GREEN" | "RED" | null;
  asset: string;
  live: QuadrantStep | null;
  wins: number;
  losses: number;
  /** Aguardando vela 5 (RESULTADO) porque houve LOSS na ENTRADA */
  awaitResult: boolean;
  /** Ciclo ainda aberto (fechou após WIN na ENTRADA, sem entrada, ou RESULTADO) */
  cycleOpen: boolean;
}

const STEP_CONFIG: Record<EntryStep, { label: string; color: string; bg: string; icon: string }> = {
  INICIO:       { label: "INICIO",       color: "text-muted-foreground", bg: "",              icon: "1" },
  CONTINUIDADE: { label: "CONTINUIDADE", color: "text-info",            bg: "",              icon: "2" },
  PREPARANDO:   { label: "PREPARANDO",   color: "text-warning",         bg: "bg-warning/10", icon: "3" },
  ENTRADA:      { label: "ENTRADA",      color: "text-primary",         bg: "bg-primary/15", icon: "4" },
  RESULTADO:    { label: "RESULTADO",    color: "text-success",         bg: "bg-success/10", icon: "5" },
};

const QUADRANT_COLORS: Record<QuadrantId, string> = {
  Q1: "text-success", Q2: "text-info", Q3: "text-warning", Q4: "text-danger",
};

const STEP_POSITIONS: EntryStep[] = ["INICIO", "CONTINUIDADE", "PREPARANDO", "ENTRADA", "RESULTADO"];

function computeQuadrantForCandle(
  color: "GREEN" | "RED",
  body: number,
  prevBody: number,
  seqLen: number,
): { quadrant: QuadrantId; probability: number; direction: "CALL" | "PUT"; accelerating: boolean; accelRatio: number } {
  const accelRatio = prevBody > 0 ? body / prevBody : 1;
  const accelerating = accelRatio > 1.02;

  let quadrant: QuadrantId;
  if (seqLen <= 3 && accelerating) quadrant = "Q1";
  else if (seqLen >= 4 && accelerating) quadrant = "Q2";
  else if (seqLen <= 3 && !accelerating) quadrant = "Q3";
  else quadrant = "Q4";

  let probability: number;
  let direction: "CALL" | "PUT";
  switch (quadrant) {
    case "Q1": probability = 80; direction = color === "GREEN" ? "CALL" : "PUT"; break;
    case "Q2": probability = 65; direction = color === "GREEN" ? "CALL" : "PUT"; break;
    case "Q3": probability = 50; direction = color === "GREEN" ? "CALL" : "PUT"; break;
    case "Q4": probability = 75; direction = color === "GREEN" ? "PUT" : "CALL"; break;
  }

  return { quadrant, probability, direction, accelerating, accelRatio };
}

function useQuadrantTracker(asset: string, enabled: boolean, entryAllowed: boolean): QuadrantState {
  const { subscribeCandleClose, subscribeCandleUpdate, engine } = useRobot();
  const [state, setState] = useState<QuadrantState>({
    steps: [],
    currentStep: 0,
    startCandleTime: 0,
    cycleColor: null,
    asset,
    live: null,
    wins: 0,
    losses: 0,
    awaitResult: false,
    cycleOpen: false,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Entrada permitida (LIBERADO) — em ref para não re-inscrever os handlers
  const entryAllowedRef = useRef(entryAllowed);
  entryAllowedRef.current = entryAllowed;

  // Histórico contínuo (NÃO reinicia a cada ciclo) para cálculo de ADX
  const historyRef = useRef<Array<{ high: number; low: number; close: number; open: number; time: number }>>([]);

  // Guarda contra backfill concorrente
  const backfillRunningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    historyRef.current = [];

    const pushHistory = (candle: Candle) => {
      const h = historyRef.current;
      if (h.length === 0 || h[h.length - 1].time !== candle.time) {
        h.push({ high: candle.high, low: candle.low, close: candle.close, open: candle.open, time: candle.time });
        if (h.length > 60) h.shift();
      } else {
        h[h.length - 1] = { high: candle.high, low: candle.low, close: candle.close, open: candle.open, time: candle.time };
      }
    };

    const adxOf = (candle: Candle): number => {
      pushHistory(candle);
      const series = computeADXSeries(historyRef.current);
      return series.length ? series[series.length - 1] : 0;
    };

    const adxOfLive = (candle: Candle): number => {
      const liveHist = historyRef.current.slice();
      if (liveHist.length === 0 || liveHist[liveHist.length - 1].time !== candle.time) {
        liveHist.push({ high: candle.high, low: candle.low, close: candle.close, open: candle.open, time: candle.time });
      } else {
        liveHist[liveHist.length - 1] = { high: candle.high, low: candle.low, close: candle.close, open: candle.open, time: candle.time };
      }
      const series = computeADXSeries(liveHist);
      return series.length ? series[series.length - 1] : 0;
    };

    const posOf = (t: number) => ((Math.floor(t / INTERVAL_MS) % 5) + 5) % 5;

    // ══ Máquina de estados do ciclo (por ORDEM das velas, não por bloco do epoch) ══
    // Ciclo = 4 velas (INICIO → CONTINUIDADE → PREPARANDO → ENTRADA).
    // A 5ª vela (RESULTADO) existe SOMENTE se houve LOSS na ENTRADA.
    // WIN na ENTRADA ou 4ª vela fechada sem entrada → o próximo candle é o
    // INICIO de um novo ciclo. Uma vela "continua" o ciclo atual somente se
    // o slot dela encadeia com a sequência; qualquer quebra reinicia como INICIO.
    const advance = (prev: QuadrantState, candle: Candle, markResults: boolean): QuadrantState => {
      const slot = posOf(candle.time);
      const color = candleColor(candle);
      const body = candleBody(candle);
      const startSlot = prev.startCandleTime ? posOf(prev.startCandleTime) : -1;

      const continues =
        prev.cycleOpen &&
        prev.steps.length > 0 &&
        prev.steps.length < 5 &&
        startSlot >= 0 &&
        slot === (startSlot + prev.steps.length) % 5;

      const steps = continues ? [...prev.steps] : [];
      const idx = steps.length; // 0..4
      const label = STEP_POSITIONS[idx];

      const seqLen = computeSeqLen(steps, color);
      const prevBody = steps.length > 0 ? steps[steps.length - 1]?.body ?? body : body;
      const { quadrant, probability, accelerating, accelRatio } =
        computeQuadrantForCandle(color, body, prevBody, seqLen);

      // Direção = cor da 1ª vela do quadrante
      const firstColor: "GREEN" | "RED" = idx === 0 ? color : steps[0].color;
      const direction: "CALL" | "PUT" = firstColor === "GREEN" ? "CALL" : "PUT";
      const actualDirection: "CALL" | "PUT" = candle.close >= candle.open ? "CALL" : "PUT";
      const againstDirection = actualDirection !== direction;

      const adx = adxOf(candle);

      const step: QuadrantStep = {
        index: idx,
        time: candle.time,
        color,
        body,
        open: candle.open,
        close: candle.close,
        high: candle.high,
        low: candle.low,
        adx,
        seqLen,
        accelerating,
        accelRatio,
        quadrant,
        probability,
        direction,
        entryStep: label,
        actualDirection,
        result: null,
        againstDirection,
      };

      let awaitResult = continues ? prev.awaitResult : false;
      if (markResults && label === "ENTRADA") {
        // Sem entrada liberada pelo engine → sem resultado e ciclo reinicia
        step.result = entryAllowedRef.current ? (againstDirection ? "LOSS" : "WIN") : null;
        awaitResult = step.result === "LOSS";
      } else if (markResults && label === "RESULTADO") {
        step.result = againstDirection ? "LOSS" : "WIN";
      }

      const wins = step.result === "WIN" ? prev.wins + 1 : prev.wins;
      const losses = step.result === "LOSS" ? prev.losses + 1 : prev.losses;

      steps.push(step);

      // Ciclo fecha após RESULTADO (idx 4) ou após ENTRADA sem loss pendente
      const cycleOpen = label === "RESULTADO" ? false : !(label === "ENTRADA" && !awaitResult);

      return {
        ...prev,
        steps,
        currentStep: steps.length,
        startCandleTime: idx === 0 ? candle.time : prev.startCandleTime,
        cycleColor: idx === 0 ? color : prev.cycleColor,
        awaitResult,
        cycleOpen,
        asset,
        live: null,
        wins,
        losses,
      };
    };

    // ══ BACKFILL: reconstrói o estado canônico do ciclo a partir do histórico ══
    const backfillCycle = async () => {
      if (backfillRunningRef.current) return;
      backfillRunningRef.current = true;
      try {
        const broker = (engine as any)?.broker;
        if (!broker?.getCandles) return;
        const candles: Candle[] = await broker.getCandles(asset, "M1", 12);
        if (!Array.isArray(candles) || candles.length === 0) return;

        // Último elemento do buffer é a vela em formação → descarta
        const nowMs = Date.now();
        const closed = candles
          .slice(0, -1)
          .filter((c) => typeof c?.time === "number")
          .filter((c) => c.time > nowMs - INTERVAL_MS * 12)
          .sort((a, b) => a.time - b.time);
        if (closed.length === 0) return;

        let acc: QuadrantState = {
          steps: [], currentStep: 0, startCandleTime: 0, cycleColor: null,
          asset, live: null, wins: 0, losses: 0, awaitResult: false, cycleOpen: false,
        };
        for (const c of closed) acc = advance(acc, c, true);

        setState((prev) => {
          // Não desfaz progresso ao vivo mais recente que o histórico coberto
          const newestBackfilled = closed[closed.length - 1].time;
          const newerLive = prev.steps.filter((s) => s.time > newestBackfilled);
          if (newerLive.length === 0) return acc;
          for (const c of newerLive.map((s) => ({
            time: s.time, open: s.open, high: s.high, low: s.low,
            close: s.close, volume: 0, asset,
          } as Candle))) {
            acc = advance(acc, c, true);
          }
          return acc;
        });
      } catch {
        // Sem histórico disponível → segue comportamento padrão (acumula ao vivo)
      } finally {
        backfillRunningRef.current = false;
      }
    };

    void backfillCycle();

    // ══ FECHAMENTO: consolida a vela (cor final) e avança o ciclo ══
    const unsubClose = subscribeCandleClose((candle: Candle) => {
      if (candle.asset !== asset) return;

      setState((prev) => {
        // Dedupe: vela já registrada
        if (prev.steps.some((st) => st.time === candle.time)) return prev;
        // Entrou no meio de um ciclo → tenta reconstruir a partir do histórico
        if (prev.steps.length === 0) void backfillCycle();
        return advance(prev, candle, true);
      });
    });

    // ══ ATUALIZAÇÃO AO VIVO: reflete a vela em formação em tempo real ══
    const unsubUpdate = subscribeCandleUpdate((candle: Candle) => {
      if (candle.asset !== asset) return;

      const s = stateRef.current;

      // Ignora updates de velas JÁ FECHADAS (updates atrasados re-pintariam
      // a linha consolidada como laranja "ao vivo")
      if (s.steps.some((st) => st.time === candle.time)) return;

      const color = candleColor(candle);
      const body = candleBody(candle);

      // Mesma máquina de estados: qual posição ESTA vela ocuparia?
      const startSlot = s.startCandleTime ? posOf(s.startCandleTime) : -1;
      const slot = posOf(candle.time);
      const continues =
        s.cycleOpen &&
        s.steps.length > 0 &&
        s.steps.length < 5 &&
        startSlot >= 0 &&
        slot === (startSlot + s.steps.length) % 5;
      const idx = continues ? s.steps.length : 0;

      const seqLen = computeSeqLen(s.steps, color);
      const prevBody = s.steps.length > 0 ? s.steps[s.steps.length - 1]?.body ?? body : body;
      const { quadrant, probability, accelerating, accelRatio } =
        computeQuadrantForCandle(color, body, prevBody, seqLen);

      const firstColor: "GREEN" | "RED" = idx === 0 ? color : s.steps[0].color;
      const direction: "CALL" | "PUT" = firstColor === "GREEN" ? "CALL" : "PUT";
      const actualDirection: "CALL" | "PUT" = candle.close >= candle.open ? "CALL" : "PUT";
      const adx = adxOfLive(candle);

      const live: QuadrantStep = {
        index: idx,
        time: candle.time,
        color,
        body,
        open: candle.open,
        close: candle.close,
        high: candle.high,
        low: candle.low,
        adx,
        seqLen,
        accelerating,
        accelRatio,
        quadrant,
        probability,
        direction,
        entryStep: STEP_POSITIONS[idx],
        actualDirection,
        result: null,
        againstDirection: actualDirection !== direction,
      };

      setState({ ...s, live, asset });
    });

    return () => {
      unsubClose();
      unsubUpdate();
    };
  }, [asset, enabled, subscribeCandleClose, subscribeCandleUpdate, engine]);

  return state;
}

function AssetQuadrant({ asset, decision }: { asset: string; decision: any }) {
  const hp = decision?.hybridProbability;
  const adx = hp?.indicators?.adx ?? 0;
  const adxMin = 15;
  const liberado = hp?.status === "liberado";
  const engineStep = hp?.cycleStep ?? null;
  const engineReason = hp?.reason ?? null;
  const engineBlocked = hp?.blockedReasons ?? [];

  const quadrant = useQuadrantTracker(asset, true, liberado);
  const { steps, currentStep, live, wins, losses } = quadrant;

  const current = steps.length > 0 ? steps[steps.length - 1] : null;
  const displayDir = live ? live.actualDirection : current?.actualDirection ?? null;

  const totalResults = wins + losses;
  const assertividade = totalResults > 0 ? (wins / totalResults) * 100 : 0;
  const avgProb = steps.length > 0 ? steps.reduce((a, s) => a + s.probability, 0) / steps.length : 0;
  const momentumBrain = current?.accelerating ?? false;

  return (
    <div className="rounded-lg border border-border bg-background/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-bold tracking-wide">{asset}</h4>
          {current && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STEP_CONFIG[current.entryStep].bg} ${STEP_CONFIG[current.entryStep].color}`}>
              Etapa {STEP_CONFIG[current.entryStep].icon}: {STEP_CONFIG[current.entryStep].label}
            </span>
          )}
          {current && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-muted/50 ${QUADRANT_COLORS[current.quadrant]}`}>
              {current.quadrant} — {current.probability}%
            </span>
          )}
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            liberado
              ? "bg-success/15 text-success border border-success/30"
              : "bg-danger/15 text-danger border border-danger/30"
          }`}
        >
          {liberado ? "LIBERADO" : "BLOQUEADO"}
        </span>
      </div>

      {current && (
        <div className="grid grid-cols-5 gap-2 mb-3 text-xs">
          <div>
            <span className="text-[9px] uppercase text-muted-foreground">Dir</span>
            <div className={`font-bold ${displayDir === "CALL" ? "text-success" : "text-danger"}`}>
              {displayDir ?? "--"}
            </div>
          </div>
          <div>
            <span className="text-[9px] uppercase text-muted-foreground">Prob</span>
            <div className="font-bold">{current.probability}%</div>
          </div>
          <div>
            <span className="text-[9px] uppercase text-muted-foreground">Seq</span>
            <div className="font-bold">{current.seqLen} {current.color}</div>
          </div>
          <div>
            <span className="text-[9px] uppercase text-muted-foreground">ADX</span>
            <div className={`font-bold ${adx >= adxMin ? "text-success" : "text-danger"}`}>{adx.toFixed(1)}</div>
          </div>
          <div>
            <span className="text-[9px] uppercase text-muted-foreground">Quadrante</span>
            <div className={`font-bold ${QUADRANT_COLORS[current.quadrant]}`}>{current.quadrant}</div>
          </div>
        </div>
      )}

      {hp && (
        <div
          className={`mb-3 rounded border px-2 py-1 text-[10px] ${
            liberado
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          <span className="font-bold">ENGINE:</span> ciclo {engineStep ?? "—"} ·{" "}
          {liberado ? "ENTRA" : "NÃO ENTRA"}
          {engineReason ? ` — ${engineReason}` : ""}
          {!liberado && engineBlocked.length > 0 ? (
            <span className="block opacity-80">↳ {engineBlocked.join(" | ")}</span>
          ) : null}
        </div>
      )}

      {current && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[10px] text-muted-foreground">
          <span>
            Assertividade (catálogo):{" "}
            <b className={assertividade >= 60 ? "text-success" : assertividade >= 50 ? "text-warning" : "text-danger"}>
              {totalResults > 0 ? `${assertividade.toFixed(0)}%` : "—"}
            </b>
            <span className="ml-1 opacity-60">({wins}W/{losses}L)</span>
          </span>
          <span>
            Prob. média: <b className="text-foreground">{steps.length > 0 ? `${avgProb.toFixed(0)}%` : "—"}</b>
          </span>
          <span>
            Momentum (cérebro):{" "}
            <b className={momentumBrain ? "text-success" : "text-danger"}>
              {momentumBrain ? "ACELERANDO ✓" : "FRACO ✗"}
            </b>
          </span>
        </div>
      )}

      {currentStep > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1">
            {STEP_POSITIONS.map((step, i) => {
              const isActive = i + 1 === currentStep;
              const isDone = i + 1 < currentStep;
              const cfg = STEP_CONFIG[step];
              return (
                <div
                  key={step}
                  className={`flex-1 h-7 rounded flex items-center justify-center text-[9px] font-bold transition-all ${
                    isActive
                      ? `${cfg.bg || "bg-primary/20"} ${cfg.color} ring-1 ring-primary/50`
                      : isDone
                        ? "bg-success/10 text-success"
                        : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {cfg.icon}—{cfg.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {live && (
        <div className="mb-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] bg-warning/10 border border-warning/40">
            <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold bg-warning/20 text-warning">●</span>

            <div className={`w-2.5 h-2.5 rounded-sm border ${
              live.againstDirection
                ? "border-warning bg-warning/80 animate-pulse"
                : live.color === "GREEN"
                  ? "bg-success border-success/50"
                  : "bg-danger border-danger/50"
            }`} />

            <span className="text-muted-foreground tabular-nums w-12">{formatTime(live.time)}</span>

            <span className="tabular-nums w-16 text-right">{live.body.toFixed(4)}</span>

            <span className={`tabular-nums px-1 py-0.5 rounded w-8 text-center ${
              live.seqLen >= 4 ? "bg-warning/20 text-warning"
                : live.seqLen >= 2 ? "bg-success/10 text-success" : ""
            }`}>
              {live.seqLen}
            </span>

            <span className={`w-14 text-center font-bold ${
              live.againstDirection
                ? "text-warning"
                : live.actualDirection === "CALL"
                  ? "text-success"
                  : "text-danger"
            }`}>
              {live.actualDirection === "CALL" ? "▲" : "▼"}
              {live.againstDirection && " ←"}
            </span>

            <span className={`font-bold w-8 text-center ${QUADRANT_COLORS[live.quadrant]}`}>
              {live.quadrant}
            </span>

            <span className="tabular-nums font-bold w-10 text-right">{live.probability}%</span>

            <AdxCell adx={live.adx} />

            <AccelCell ratio={live.accelRatio} accelerating={live.accelerating} />

            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STEP_CONFIG[live.entryStep].bg} ${STEP_CONFIG[live.entryStep].color}`}>
              {STEP_CONFIG[live.entryStep].icon}—{STEP_CONFIG[live.entryStep].label}
            </span>
            {live.entryStep === "ENTRADA" && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${live.accelerating ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                {live.accelerating ? "MOM ✓" : "MOM ✗"}
              </span>
            )}
          </div>
          <div className="text-[9px] text-warning text-center mt-0.5 animate-pulse">● AO VIVO — atualizando em tempo real</div>
        </div>
      )}

      {steps.length > 0 ? (
        <div className="space-y-1">
          {steps.map((step, i) => {
            const cfg = STEP_CONFIG[step.entryStep];
            const isLast = i === steps.length - 1;

            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${
                  isLast ? "bg-primary/10 border border-primary/30" : "bg-background/20"
                }`}
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${cfg.bg || "bg-muted/30"} ${cfg.color}`}>
                  {cfg.icon}
                </span>

                <div className={`w-2.5 h-2.5 rounded-sm border ${
                  step.color === "GREEN"
                    ? "bg-success border-success/50"
                    : "bg-danger border-danger/50"
                }`} />

                <span className="text-muted-foreground tabular-nums w-12">{formatTime(step.time)}</span>

                <span className="tabular-nums w-16 text-right">{step.body.toFixed(4)}</span>

                <span className={`tabular-nums px-1 py-0.5 rounded w-8 text-center ${
                  step.seqLen >= 4 ? "bg-warning/20 text-warning"
                  : step.seqLen >= 2 ? "bg-success/10 text-success" : ""
                }`}>
                  {step.seqLen}
                </span>

                <span className={`w-14 text-center font-bold ${
                  step.againstDirection
                    ? "text-warning"
                    : step.actualDirection === "CALL"
                      ? "text-success"
                      : "text-danger"
                }`}>
                  {step.actualDirection === "CALL" ? "▲" : "▼"}
                  {step.againstDirection && " ←"}
                </span>

                <span className={`font-bold w-8 text-center ${QUADRANT_COLORS[step.quadrant]}`}>
                  {step.quadrant}
                </span>

                <span className="tabular-nums font-bold w-10 text-right">{step.probability}%</span>

                <AdxCell adx={step.adx} />

                <AccelCell ratio={step.accelRatio} accelerating={step.accelerating} />

                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon}—{cfg.label}
                </span>
                {step.entryStep === "ENTRADA" && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${step.accelerating ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                    {step.accelerating ? "MOM ✓" : "MOM ✗"}
                  </span>
                )}

                {step.result && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    step.result === "WIN"
                      ? "bg-success/20 text-success"
                      : "bg-danger/20 text-danger"
                  }`}>
                    {step.result === "WIN" ? "✓" : "✗"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-3 text-xs">
          Aguardando primeira vela do quadrante...
        </div>
      )}
    </div>
  );
}

export function HybridProbabilityPanel() {
  const { state } = useRobot();
  const op = state.config.operationProfile;
  if (op !== "HYBRID_PROBABILITY") return null;

  const byAsset = state.lastAnalysesByAsset ?? {};
  const catalog = state.hybridCatalog;

  const assetsWithData = useMemo(() => {
    return HYBRID_ASSETS.filter((a) => byAsset[a]);
  }, [byAsset]);

  return (
    <section className="grid grid-cols-12 gap-4">
      <div className="col-span-12 panel p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-wide">
            QUADRANTE PROBABILISTA — AO VIVO
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted/50">1—INICIO</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-info/10 text-info">2—CONTINUIDADE</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-warning/10 text-warning">3—PREPARANDO</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-bold">4—ENTRADA</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-success/10 text-success">5—RESULTADO</span>
          </div>
        </div>

        {catalog?.isReady && (
          <div className="mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                Motor de Decisao — Ativo Selecionado
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <span className="text-[9px] uppercase text-muted-foreground block mb-1">Ativo Selecionado</span>
                <div className="text-lg font-bold text-primary">{catalog.selectedAsset}</div>
              </div>
              <div className="text-center">
                <span className="text-[9px] uppercase text-muted-foreground block mb-1">Prob. Acertos</span>
                <div className={`text-lg font-bold ${catalog.winRate >= 60 ? "text-success" : catalog.winRate >= 50 ? "text-warning" : "text-danger"}`}>
                  {catalog.winRate.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <span className="text-[9px] uppercase text-muted-foreground block mb-1">Assertividade</span>
                <div className={`text-lg font-bold ${catalog.assertiveness >= 60 ? "text-success" : catalog.assertiveness >= 50 ? "text-warning" : "text-danger"}`}>
                  {catalog.assertiveness.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <span className="text-[9px] uppercase text-muted-foreground block mb-1">Wins Seguidos</span>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                        catalog.consecutiveWins >= n
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Total: {catalog.totalOperations} operacoes</span>
              <span>W: {catalog.wins} | L: {catalog.losses}</span>
            </div>
          </div>
        )}

        {catalog?.assetResults && catalog.assetResults.length > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-border bg-background/50">
            <span className="text-[9px] uppercase text-muted-foreground block mb-2">Ranking de Assertividade</span>
            <div className="flex flex-wrap gap-2">
              {catalog.assetResults.map((result, idx) => (
                <div
                  key={result.asset}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    idx === 0
                      ? "bg-success/15 text-success border border-success/30"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {idx + 1}o {result.asset}: {result.assertiveness.toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
        )}

        {assetsWithData.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {assetsWithData.map((asset) => (
              <AssetQuadrant
                key={asset}
                asset={asset}
                decision={byAsset[asset]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Aguardando dados de candles dos pares hibridos...
            <div className="text-[10px] mt-2">
              Pares: {HYBRID_ASSETS.join(", ")}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}