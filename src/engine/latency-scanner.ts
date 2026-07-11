/**
 * engine/latency-scanner.ts
 * Latency Scanner — diagnóstico estático de setTimeout, setInterval, retries, sleeps.
 *
 * Não altera lógica — apenas lista todas as esperas artificiais encontradas no código.
 */

interface TimerInfo {
  type: "setTimeout" | "setInterval" | "sleep" | "retry" | "debounce" | "throttle" | "await";
  file: string;
  line: number;
  value: number;
  code: string;
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
}

function classify(ms: number): TimerInfo["severity"] {
  if (ms >= 1000) return "CRITICAL";
  if (ms >= 500) return "ERROR";
  if (ms >= 100) return "WARN";
  return "INFO";
}

// Relatório pré-carregado com todos os timers conhecidos escaneados do código
const KNOWN_TIMERS: TimerInfo[] = [
  // ── FlowRobotEngine ──
  { file: "flow-robot-engine.ts", line: 437, type: "setTimeout", value: 10000, code: "_scheduleNextOperation(10) — first start", severity: classify(10000) },
  { file: "flow-robot-engine.ts", line: 478, type: "setTimeout", value: 5000, code: "_scheduleNextOperation(5) — resume", severity: classify(5000) },
  { file: "flow-robot-engine.ts", line: 624, type: "setTimeout", value: 3000, code: "_scheduleNextOperation(3) — session change", severity: classify(3000) },
  { file: "flow-robot-engine.ts", line: 880, type: "setTimeout", value: 30000, code: "_scheduleNextOperation(30) — error retry", severity: classify(30000) },
  { file: "flow-robot-engine.ts", line: 910, type: "setInterval", value: 1000, code: "countdown tick", severity: classify(1000) },
  { file: "flow-robot-engine.ts", line: 916, type: "setTimeout", value: -1, code: "_scheduleNextOperation(delaySecs * 1000) — variable delay", severity: "WARN" },
  { file: "flow-robot-engine.ts", line: 949, type: "setTimeout", value: 5000, code: "_scheduleNextOperation(5) — insufficient data retry", severity: classify(5000) },
  { file: "flow-robot-engine.ts", line: 960, type: "setTimeout", value: 60000, code: "_scheduleNextOperation(60) — outside session retry", severity: classify(60000) },
  { file: "flow-robot-engine.ts", line: 1079, type: "setTimeout", value: -1, code: "_scheduleNextOperation(config.reAnalysisIntervalSec) — no signal", severity: "WARN" },
  { file: "flow-robot-engine.ts", line: 1216, type: "await", value: -1, code: "_analyzeMarketDirection() — async analysis (variable)", severity: "WARN" },
  { file: "flow-robot-engine.ts", line: 1220, type: "setTimeout", value: -1, code: "_scheduleNextOperation(_getIntervalSeconds()) — post-trade", severity: "WARN" },
  { file: "flow-robot-engine.ts", line: 2057, type: "sleep", value: -1, code: "_wait(ms) — sleep helper", severity: "WARN" },

  // ── ExecutionEngine ──
  { file: "ExecutionEngine.ts", line: 17, type: "setInterval", value: 50, code: "CHECK_INTERVAL_MS — precision tick", severity: classify(50) },
  { file: "ExecutionEngine.ts", line: 18, type: "setTimeout", value: 200, code: "DECISION_ADVANCE_MS — decision window before close", severity: classify(200) },

  // ── PumaBrokerAdapter ──
  { file: "puma-broker-adapter.ts", line: 76, type: "retry", value: 2000, code: "fetchWithRetry — 2 retries, 2000ms delay", severity: classify(2000) },
  { file: "puma-broker-adapter.ts", line: 930, type: "setTimeout", value: -1, code: "waitForTradeResult — timeout = (expiration + 15) * 1000", severity: "WARN" },

  // ── PumaWS2Client ──
  { file: "puma-ws2-client.ts", line: 27, type: "setInterval", value: 10000, code: "HEARTBEAT_INTERVAL — 10s heartbeat", severity: classify(10000) },
  { file: "puma-ws2-client.ts", line: 28, type: "setTimeout", value: 3000, code: "RECONNECT_BASE_DELAY — 3s base reconnect", severity: classify(3000) },
  { file: "puma-ws2-client.ts", line: 29, type: "setTimeout", value: 60000, code: "RECONNECT_MAX_DELAY — 60s max reconnect", severity: classify(60000) },
  { file: "puma-ws2-client.ts", line: 31, type: "setTimeout", value: 15000, code: "CANDLE_TIMEOUT_MS — 15s candle timeout", severity: classify(15000) },
  { file: "puma-ws2-client.ts", line: 289, type: "setTimeout", value: 500, code: "history request delay after subscribe", severity: classify(500) },
  { file: "puma-ws2-client.ts", line: 321, type: "setInterval", value: 10000, code: "_startHeartbeat — 10s interval", severity: classify(10000) },
  { file: "puma-ws2-client.ts", line: 554, type: "setTimeout", value: -1, code: "_scheduleReconnect — exponential backoff (3s, 6s, 12s...)", severity: "WARN" },

  // ── PumaSocketClient ──
  { file: "puma-socket-client.ts", line: 243, type: "setTimeout", value: 1000, code: "reconnectionDelay — 1s", severity: classify(1000) },
  { file: "puma-socket-client.ts", line: 244, type: "setTimeout", value: 10000, code: "reconnectionDelayMax — 10s", severity: classify(10000) },
  { file: "puma-socket-client.ts", line: 245, type: "setTimeout", value: 10000, code: "timeout — 10s connection", severity: classify(10000) },
  { file: "puma-socket-client.ts", line: 269, type: "setTimeout", value: 500, code: "OTC connect delay 500ms", severity: classify(500) },
  { file: "puma-socket-client.ts", line: 497, type: "setTimeout", value: -1, code: "_scheduleJwtRenewal — 5min before expiry", severity: "WARN" },

  // ── BinanceWSClient ──
  { file: "binance-ws-client.ts", line: 287, type: "setTimeout", value: 3000, code: "reconnect delay 3s", severity: classify(3000) },

  // ── MarketSessionManager ──
  { file: "market-session-manager.ts", line: 70, type: "setInterval", value: 30000, code: "CHECK_INTERVAL_MS — 30s session check", severity: classify(30000) },

  // ── CatalogEngine ──
  { file: "catalog-engine.ts", line: 28, type: "setInterval", value: 3600000, code: "SCAN_INTERVAL — 1 hour catalog scan", severity: classify(3600000) },
  { file: "catalog-engine.ts", line: 29, type: "setTimeout", value: 4000, code: "BATCH_GAP — 4s between asset scans", severity: classify(4000) },

  // ── FlowContinuityEngine ──
  { file: "flow-continuity-engine.ts", line: 148, type: "setInterval", value: -1, code: "loopIntervalMs — configurable", severity: "WARN" },
  { file: "flow-continuity-engine.ts", line: 501, type: "setTimeout", value: 2000, code: "pollOrderResult — polls every 2s, max 65s", severity: classify(2000) },

  // ── Proxy Daemon ──
  { file: "proxy_daemon.py", line: 91, type: "retry", value: 1000, code: "Retry(total=2, backoff_factor=1) — HTTP retry", severity: classify(1000) },
  { file: "proxy_daemon.py", line: 97, type: "retry", value: 1000, code: "Retry(total=3, backoff_factor=1) — auth retry", severity: classify(1000) },
  { file: "proxy_daemon.py", line: 139, type: "await", value: 10000, code: "asyncio.sleep(10) — heartbeat loop", severity: classify(10000) },
  { file: "proxy_daemon.py", line: 211, type: "await", value: -1, code: "asyncio.sleep(delay) — reconnect backoff (5s..120s)", severity: "WARN" },
  { file: "proxy_daemon.py", line: 360, type: "await", value: 1000, code: "asyncio.sleep(1) — listen loop idle", severity: classify(1000) },

  // ── Python Config ──
  { file: "config.py", line: 68, type: "setInterval", value: 25000, code: "EIO_PING_INTERVAL — 25s", severity: classify(25000) },
  { file: "config.py", line: 69, type: "setTimeout", value: 20000, code: "EIO_PING_TIMEOUT — 20s", severity: classify(20000) },
  { file: "config.py", line: 72, type: "setTimeout", value: 5000, code: "WS_RECONNECT_DELAY — 5s", severity: classify(5000) },
  { file: "config.py", line: 76, type: "setTimeout", value: 10000, code: "HTTP_TIMEOUT — 10s", severity: classify(10000) },

  // ── MockBroker ──
  { file: "mock-broker.ts", line: 79, type: "setInterval", value: 1000, code: "1s simulated price updates", severity: classify(1000) },
];

export class LatencyScanner {
  static getKnownTimers(): TimerInfo[] {
    return [...KNOWN_TIMERS];
  }

  static generateReport(): string {
    const criticals = KNOWN_TIMERS.filter((t) => t.severity === "CRITICAL" && t.value > 0);
    const errors = KNOWN_TIMERS.filter((t) => t.severity === "ERROR" && t.value > 0);
    const warns = KNOWN_TIMERS.filter((t) => t.severity === "WARN" || (t.severity !== "INFO" && t.value < 0));
    const variable = KNOWN_TIMERS.filter((t) => t.value < 0);

    const lines: string[] = [];

    lines.push("");
    lines.push("╔══════════════════════════════════════════════════════════╗");
    lines.push("║      LATENCY SCANNER — STATIC TIMER AUDIT REPORT       ║");
    lines.push("╚══════════════════════════════════════════════════════════╝");
    lines.push("");
    lines.push(`  Total timers found:   ${KNOWN_TIMERS.length}`);
    lines.push(`  🔴 CRITICAL (>=1000ms): ${criticals.length}`);
    lines.push(`  🟠 ERROR   (>=500ms):   ${errors.length}`);
    lines.push(`  🟡 WARN    (>=100ms):    ${warns.length}`);
    lines.push(`  ⚪ VARIABLE (dynamic):   ${variable.length}`);
    lines.push("");

    // Detail table
    lines.push("  ┌────────┬──────────────┬──────────┬────────────────────────────────────────────────────┐");
    lines.push("  │ Sever  │ Type         │ Value    │ Source                                             │");
    lines.push("  ├────────┼──────────────┼──────────┼────────────────────────────────────────────────────┤");
    for (const t of KNOWN_TIMERS.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
      const sev = t.severity === "CRITICAL" ? "🔴" : t.severity === "ERROR" ? "🟠" : t.severity === "WARN" ? "🟡" : "⚪";
      const val = t.value > 0 ? `${t.value}ms` : "dynamic";
      const src = `${t.file}:${t.line}`;
      lines.push(`  │ ${sev}    │ ${t.type.padEnd(12)} │ ${val.padEnd(8)} │ ${src.padEnd(48)} │`);
    }
    lines.push("  └────────┴──────────────┴──────────┴────────────────────────────────────────────────────┘");
    lines.push("");

    // Critical items detail
    if (criticals.length > 0) {
      lines.push("  🔴 CRITICAL ITEMS (>= 1000ms):");
      for (const c of criticals) {
        lines.push(`    - ${c.type}(${c.value}ms) em ${c.file}:${c.line} — ${c.code}`);
      }
      lines.push("");
    }

    if (variable.length > 0) {
      lines.push("  ⚪ VARIABLE/DYNAMIC WAITS:");
      for (const v of variable) {
        lines.push(`    - ${v.type} em ${v.file}:${v.line} — ${v.code}`);
      }
      lines.push("");
    }

    // Recommendations
    lines.push("  RECOMMENDATIONS:");
    if (criticals.length > 0) {
      lines.push("    🔴 Review all CRITICAL items — these are blocking the pipeline for 1s+");
    }
    const httpTimers = KNOWN_TIMERS.filter((t) => t.code.includes("HTTP") || t.code.includes("timeout"));
    if (httpTimers.length > 0) {
      lines.push("    🟠 HTTP timeouts are safety nets (not hit in normal flow) — acceptable");
    }
    const reconnectTimers = KNOWN_TIMERS.filter((t) => t.code.includes("reconnect") || t.code.includes("backoff"));
    if (reconnectTimers.length > 0) {
      lines.push("    🟡 Reconnect backoffs are only triggered on disconnection — expected behavior");
    }
    lines.push("");

    return lines.join("\n");
  }

  static printReport(): void {
    console.log(LatencyScanner.generateReport());
  }
}
