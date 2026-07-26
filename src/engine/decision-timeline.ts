/**
 * engine/decision-timeline.ts
 * Timeline visual por traceId — agrupa todos os eventos de uma decisão
 * em uma linha temporal legível, evitando ter que vasculhar logs textuais.
 *
 * Uso:
 *   const tl = DecisionTimeline.start("scan-1234-1");
 *   tl.event("SCHEDULER", { reason: "NO_SIGNAL" });
 *   tl.event("DECISION_START", { asset: "EURUSD" });
 *   ...
 *   tl.end("APPROVED");
 *   tl.print();  // ou tl.toString()
 */

import { engineLogger } from "./logger";

export interface TimelineEvent {
  ts: number;
  label: string;
  detail?: Record<string, unknown>;
  ms?: number;
}

export class DecisionTimeline {
  private _events: TimelineEvent[] = [];
  private _startMs: number;
  private _endStatus: string | null = null;
  private _traceId: string;

  private constructor(traceId: string) {
    this._traceId = traceId;
    this._startMs = performance.now();
  }

  static start(traceId: string): DecisionTimeline {
    const tl = new DecisionTimeline(traceId);
    tl._push("DECISION_BEGIN", {});
    return tl;
  }

  event(label: string, detail?: Record<string, unknown>, ms?: number): void {
    this._push(label, detail, ms);
  }

  stageTiming(stage: string, timings: Record<string, number>, totalMs: number): void {
    this._push(stage, { ...timings, totalMs });
  }

  end(status: string, detail?: Record<string, unknown>): void {
    this._endStatus = status;
    this._push(`END=${status}`, detail);
  }

  private _push(label: string, detail?: Record<string, unknown>, ms?: number): void {
    this._events.push({
      ts: performance.now(),
      label,
      detail,
      ms,
    });
  }

  render(): string {
    const lines: string[] = [];
    const t0 = this._startMs;

    lines.push(`┌─── TRACE: ${this._traceId} ───`);

    for (const ev of this._events) {
      const elapsed = (ev.ts - t0).toFixed(1);
      const msStr = ev.ms != null ? ` (${ev.ms.toFixed(1)}ms)` : "";
      const detailStr = ev.detail
        ? " " +
          Object.entries(ev.detail)
            .map(([k, v]) => `${k}=${typeof v === "number" ? v : String(v)}`)
            .join(" ")
        : "";
      lines.push(`│ ${elapsed.padStart(10)} │ ${ev.label}${msStr}${detailStr}`);
    }

    const totalMs = (this._events.length > 0
      ? this._events[this._events.length - 1].ts - t0
      : 0
    ).toFixed(1);
    lines.push(`└─── total=${totalMs}ms status=${this._endStatus ?? "?"} ───`);

    return lines.join("\n");
  }

  toString(): string {
    return this.render();
  }

  log(): void {
    engineLogger.info("DecisionTimeline", this.render());
  }

  get traceId(): string {
    return this._traceId;
  }

  get totalMs(): number {
    if (this._events.length < 2) return 0;
    return this._events[this._events.length - 1].ts - this._startMs;
  }

  get events(): readonly TimelineEvent[] {
    return this._events;
  }
}
