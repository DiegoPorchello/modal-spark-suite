/**
 * engine/latency-tracker.ts
 * Latency Tracker — auditoria de latência de alta precisão.
 *
 * Marca timestamps com performance.now() em todas as etapas do pipeline
 * e gera relatório detalhado com warnings por faixa.
 */

type Phase =
  | "candle_closed"       // 1. Evento de candle fechado recebido
  | "scan_started"        // 2. Scan iniciado
  | "indicators_done"     // 2b. Indicadores calculados (TrendEngine, Momentum, etc)
  | "score_calculated"    // 3. ScoreEngine devolveu resultado
  | "decision_taken"      // 4. Direção definida (CALL/PUT)
  | "order_created"       // 5. nextTrade criado
  | "order_queued"        // 5b. nextTrade armazenado no ExecutionEngine
  | "decision_window"     // 5c. Janela de decisão (~200ms antes do close)
  | "candle_open"         // 5d. Candle abriu (início da execução)
  | "order_sent_proxy"    // 6. HTTP POST enviado ao proxy_daemon
  | "proxy_responded"     // 7. Proxy respondeu HTTP 200/201
  | "proxy_sent_puma"     // 8. Proxy encaminhou para API Puma
  | "puma_confirmed"      // 9. Puma respondeu (order ID)
  | "trade_opened"        // 10. Trade aberto/confirmado
  | "trade_result";       // 10b. Resultado recebido (win/loss)

interface Mark {
  phase: Phase;
  time: number;          // performance.now()
  label: string;
  metadata?: Record<string, unknown>;
}

interface PhaseSummary {
  phase: Phase;
  label: string;
  elapsed: number | null;   // ms desde o marco anterior
  total: number | null;     // ms desde candle_closed
  warning: "OK" | "WARN" | "ERROR" | "CRITICAL";
}

const WARN_THRESHOLD = 100;
const ERROR_THRESHOLD = 500;
const CRITICAL_THRESHOLD = 1000;

function classify(ms: number): "OK" | "WARN" | "ERROR" | "CRITICAL" {
  if (ms < WARN_THRESHOLD) return "OK";
  if (ms < ERROR_THRESHOLD) return "WARN";
  if (ms < CRITICAL_THRESHOLD) return "ERROR";
  return "CRITICAL";
}

class LatencyTrackerInstance {
  private marks: Mark[] = [];
  private activeTradeId: string | null = null;
  private phaseOrder: Phase[] = [
    "candle_closed",
    "scan_started",
    "indicators_done",
    "score_calculated",
    "decision_taken",
    "order_created",
    "order_queued",
    "decision_window",
    "candle_open",
    "order_sent_proxy",
    "proxy_responded",
    "proxy_sent_puma",
    "puma_confirmed",
    "trade_opened",
    "trade_result",
  ];

  /** Inicia rastreamento para um novo trade */
  beginTrade(tradeId: string): void {
    this.activeTradeId = tradeId;
    this.marks = [];
  }

  /** Registra um timestamp para uma fase */
  mark(phase: Phase, label?: string, metadata?: Record<string, unknown>): void {
    const time = performance.now();
    this.marks.push({ phase, time, label: label ?? phase, metadata });
  }

  /** Retorna o timestamp de uma fase (para correlação com Date.now()) */
  getMarkTime(phase: Phase): number | null {
    const m = this.marks.find((x) => x.phase === phase);
    return m ? m.time : null;
  }

  /** Gera relatório completo de latência para o trade atual */
  generateReport(): string {
    const lines: string[] = [];
    const tradeId = this.activeTradeId ?? "unknown";

    lines.push("");
    lines.push("╔══════════════════════════════════════════════════════════╗");
    lines.push(`║           ENTRY LATENCY REPORT — ${tradeId.padEnd(28)}║`);
    lines.push("╚══════════════════════════════════════════════════════════╝");
    lines.push("");

    if (this.marks.length === 0) {
      lines.push("  (no timing data recorded)");
      lines.push("");
      return lines.join("\n");
    }

    const startTime = this.marks[0].time;
    const summaries: PhaseSummary[] = [];
    let prevTime = startTime;

    for (const phase of this.phaseOrder) {
      const mark = this.marks.find((m) => m.phase === phase);
      if (!mark) continue;

      const elapsed = mark.time - prevTime;
      const total = mark.time - startTime;
      const warning = classify(elapsed);

      summaries.push({ phase, label: mark.label, elapsed, total, warning });
      prevTime = mark.time;
    }

    // Calcular elapsed entre marcos não-consecutivos para fases agrupadas
    // Fase sintética: "Scan → Indicadores"
    const scanMark = this.marks.find((m) => m.phase === "scan_started");
    const indicatorsMark = this.marks.find((m) => m.phase === "indicators_done");
    if (scanMark && indicatorsMark) {
      const elapsed = indicatorsMark.time - scanMark.time;
      const warn = classify(elapsed);
      lines.push(`  Scan .................. ${elapsed.toString().padStart(4)}ms  [${warn}]`);
      if (warn !== "OK") {
        lines.push(`  ⚠ Scan analysis took ${elapsed}ms — check TrendEngine + getCandles latency`);
      }
    }

    // Score
    const scoreMark = this.marks.find((m) => m.phase === "score_calculated");
    if (scoreMark) {
      const prev = scanMark ?? this.marks[0];
      const elapsed = scoreMark.time - prev.time;
      const warn = classify(elapsed);
      lines.push(`  Indicators ........... ${elapsed.toString().padStart(4)}ms  [${warn}]`);
    }

    // Decision
    const decisionMark = this.marks.find((m) => m.phase === "decision_taken");
    if (decisionMark && scoreMark) {
      const elapsed = decisionMark.time - scoreMark.time;
      const warn = classify(elapsed);
      lines.push(`  Decision ............. ${elapsed.toString().padStart(4)}ms  [${warn}]`);
    }

    // Queue (order_created -> candle_open ou decision -> order_queued)
    const orderMark = this.marks.find((m) => m.phase === "order_created");
    const openMark = this.marks.find((m) => m.phase === "candle_open");
    if (orderMark && openMark) {
      const elapsed = openMark.time - orderMark.time;
      const warn = classify(elapsed);
      lines.push(`  Queue ................ ${elapsed.toString().padStart(4)}ms  [${warn}]`);
      if (elapsed > 100) {
        lines.push(`  ⚠ Order queued for ${elapsed}ms — this is the wait between decision & candle open`);
      }
    }

    // Create Order (order_created -> order_sent_proxy)
    const proxyMark = this.marks.find((m) => m.phase === "order_sent_proxy");
    if (orderMark && proxyMark) {
      const elapsed = proxyMark.time - orderMark.time;
      const warn = classify(elapsed);
      lines.push(`  Create Order ......... ${elapsed.toString().padStart(4)}ms  [${warn}]`);
      if (warn !== "OK") {
        lines.push(`  ⚠ Order creation took ${elapsed}ms — ExecutionEngine._onCandleOpen overhead`);
      }
    }

    // Proxy (order_sent_proxy -> proxy_responded)
    const proxyResp = this.marks.find((m) => m.phase === "proxy_responded");
    if (proxyMark && proxyResp) {
      const elapsed = proxyResp.time - proxyMark.time;
      const warn = classify(elapsed);
      lines.push(`  Proxy ................ ${elapsed.toString().padStart(4)}ms  [${warn}]`);
      if (warn !== "OK") {
        lines.push(`  ⚠ Proxy HTTP ${elapsed}ms — check fetchWithRetry + proxy_daemon routing`);
      }
    }

    // Proxy→Puma (proxy_responded -> puma_confirmed)
    const pumaMark = this.marks.find((m) => m.phase === "puma_confirmed");
    if (proxyResp && pumaMark) {
      const elapsed = pumaMark.time - proxyResp.time;
      const warn = classify(elapsed);
      lines.push(`  Puma API ............. ${elapsed.toString().padStart(4)}ms  [${warn}]`);
      if (warn !== "OK") {
        lines.push(`  ⚠ Puma API took ${elapsed}ms — proxy_daemon.place_trade() + API roundtrip`);
      }
    }

    // Broker total (order_sent_proxy -> trade_opened)
    const tradeMark = this.marks.find((m) => m.phase === "trade_opened");
    if (proxyMark && tradeMark) {
      const elapsed = tradeMark.time - proxyMark.time;
      const warn = classify(elapsed);
      lines.push(`  Broker (total) ....... ${elapsed.toString().padStart(4)}ms  [${warn}]`);
    }

    // TOTAL
    const lastMark = this.marks[this.marks.length - 1];
    const totalTime = lastMark.time - startTime;
    const totalWarn = classify(totalTime);
    lines.push(`  ─────────────────────────────────────────────`);
    lines.push(`  TOTAL ................ ${totalTime.toString().padStart(4)}ms  [${totalWarn}]`);

    if (totalWarn !== "OK") {
      lines.push(`  ⚠ Total latency ${totalTime}ms exceeds safe threshold`);
    }

    lines.push("");

    // Tabela detalhada
    lines.push("  ┌──────────────────────┬──────────┬──────────┬──────────┐");
    lines.push("  │ Phase                │   Elapsed│     Total│   Status │");
    lines.push("  ├──────────────────────┼──────────┼──────────┼──────────┤");
    for (const s of summaries) {
      const elapsedStr = s.elapsed !== null ? `${s.elapsed}ms`.padStart(8) : "       -";
      const totalStr = s.total !== null ? `${s.total}ms`.padStart(8) : "       -";
      const statusStr = s.warning.padEnd(8);
      lines.push(`  │ ${s.label.padEnd(20)} │ ${elapsedStr} │ ${totalStr} │ ${statusStr} │`);
    }
    lines.push("  └──────────────────────┴──────────┴──────────┴──────────┘");
    lines.push("");

    // Warning summary
    const warnings = summaries.filter((s) => s.warning !== "OK");
    if (warnings.length > 0) {
      lines.push("  ⚠ LATENCY WARNINGS:");
      for (const w of warnings) {
        const level = w.warning === "CRITICAL" ? "🔴 CRITICAL" : w.warning === "ERROR" ? "🟠 ERROR" : "🟡 WARN";
        lines.push(`    ${level}: ${w.label} = ${w.elapsed}ms`);
      }
      lines.push("");
    }

    // Recomendações
    const criticals = summaries.filter((s) => s.warning === "CRITICAL");
    const errors = summaries.filter((s) => s.warning === "ERROR");
    if (criticals.length > 0) {
      lines.push("  🔴 CRITICAL RECOMMENDATIONS:");
      for (const c of criticals) {
        lines.push(`    - ${c.label} took ${c.elapsed}ms. This is blocking the pipeline.`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /** Loga o relatório via console */
  printReport(): void {
    const report = this.generateReport();
    console.log(report);
  }

  /** Limpa dados do trade atual */
  endTrade(): void {
    this.activeTradeId = null;
    this.marks = [];
  }
}

// Singleton
export const latencyTracker = new LatencyTrackerInstance();
