/**
 * engine/logger.ts
 * Sistema de logs estruturados — registra entradas, saídas, scores, bloqueios e resultados.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "TRADE";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor(maxLogs = 1000) {
    this.maxLogs = maxLogs;
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this._log("INFO", module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this._log("WARN", module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this._log("ERROR", module, message, data);
  }

  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this._log("DEBUG", module, message, data);
  }

  trade(module: string, message: string, data?: Record<string, unknown>): void {
    this._log("TRADE", module, message, data);
  }

  private _log(
    level: LogLevel,
    module: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      module,
      message,
      data,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    // Notifica listeners
    for (const listener of this.listeners) {
      listener(entry);
    }
    // Console
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${level}] [${module}]`;
    if (level === "ERROR") {
      console.error(prefix, message, data ?? "");
    } else if (level === "WARN") {
      console.warn(prefix, message, data ?? "");
    } else {
      console.log(prefix, message, data ?? "");
    }
    // File transport (Node.js apenas)
    _appendToLogFile(entry);
  }

  getLogs(level?: LogLevel, module?: string, limit = 100): LogEntry[] {
    let filtered = this.logs;
    if (level) filtered = filtered.filter((l) => l.level === level);
    if (module) filtered = filtered.filter((l) => l.module === module);
    return filtered.slice(-limit);
  }

  getTradeLogs(limit = 50): LogEntry[] {
    return this.getLogs("TRADE", undefined, limit);
  }

  onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  clear(): void {
    this.logs = [];
  }
}

export const engineLogger = new Logger();

// File transport — grava logs em JSONL para debug fora do Electron/console
const LOG_FILE = "C:\\Users\\Windows 10Pro\\Desktop\\Puma V2\\modal-spark-suite\\engine_logs.jsonl";

async function _appendToLogFile(entry: LogEntry): Promise<void> {
  if (typeof window !== "undefined") return;
  try {
    const fs = await import("fs");
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // disco cheio, permissão, etc — silencioso
  }
}

/**
 * Conecta o engineLogger ao proxy daemon para enviar logs via HTTP.
 * Os logs ficam acessíveis via GET /logs no daemon.
 * Seguro para SSR (não acessa window se não existir).
 */
export function connectLoggerToDaemon(daemonUrl = "http://127.0.0.1:3001"): () => void {
  if (typeof window === "undefined") return () => {};

  const flushBatch: LogEntry[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  const FLUSH_INTERVAL = 1000;
  const BATCH_SIZE = 50;
  const MAX_BUFFER = BATCH_SIZE * 20; // 1000 entradas ~20s de buffer antes de descartar

  const doFlush = () => {
    if (flushBatch.length === 0 || flushing) return;
    flushing = true;
    const batch = flushBatch.splice(0);
    fetch(`${daemonUrl}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true,
    })
      .catch(() => {})
      .finally(() => {
        flushing = false;
        if (flushBatch.length > 0) {
          scheduleFlush();
        }
      });
  };

  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (flushing) return;
    flushTimer = setTimeout(doFlush, FLUSH_INTERVAL);
  };

  const unsubscribe = engineLogger.onLog((entry) => {
    flushBatch.push(entry);
    if (flushBatch.length > MAX_BUFFER) {
      flushBatch.splice(0, flushBatch.length - MAX_BUFFER);
    }
    scheduleFlush();
  });

  const onBeforeUnload = () => {
    if (flushBatch.length > 0) {
      const batch = flushBatch.splice(0);
      fetch(`${daemonUrl}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(() => {});
    }
  };

  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    unsubscribe();
    if (flushTimer) clearTimeout(flushTimer);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}
