/**
 * engine/statistics/signal-log.ts
 *
 * PHASE XXIII.5 — Validation & Burn-in
 *
 * Registra CADA análise do HybridProbabilityEngine como uma entrada estruturada.
 * Inclui sinais APPROVED, BLOCKED, INSUFFICIENT_DATA, LOW_CONFIDENCE e TECHNICAL_REJECTION.
 *
 * Cada entrada é um snapshot completo da decisão: indicadores, scores, filtros,
 * árvore de decisão, configuração utilizada e resultado final (WIN/LOSS/DRAW).
 *
 * Storage é abstrato via SignalStorage — hoje JSONL, amanhã SQLite/Postgres.
 */

import type { HybridProbabilityConfig } from "../decision/HybridProbabilityEngine";

// ═══════════════════════════════════════════════════════════════════
// VERSION CONSTANTS — bump quando o algoritmo mudar
// ═══════════════════════════════════════════════════════════════════

export const ENGINE_VERSION = "HybridProbability 2.0.0";
export const DATABASE_VERSION = "ProbabilityDB 1.0";
export const PATTERN_CATALOG_VERSION = "PatternCatalog 1.0";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type SignalStatus =
  | "APPROVED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "LOW_CONFIDENCE"
  | "TECHNICAL_REJECTION";

export type SignalResult = "WIN" | "LOSS" | "DRAW" | "PENDING" | "UNKNOWN" | null;

export interface DecisionTreeNode {
  label: string;
  status: "pass" | "fail" | "skip" | "info";
  value?: string;
  detail?: string;
  children?: DecisionTreeNode[];
}

export interface SignalFilterSnapshot {
  id: string;
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface SignalLogEntry {
  id: string;
  timestamp: number;

  engineVersion: string;
  databaseVersion: string;
  patternCatalogVersion: string;

  asset: string;
  timeframe: string;

  status: SignalStatus;
  direction: "CALL" | "PUT" | null;
  blockedReasons: string[];

  setup: {
    detected: boolean;
    color: string | null;
    direction: string | null;
  };

  indicators: {
    adx: number;
    ema200: number | null;
    atr: number;
    atrBaseline: number;
    flowIndex: number;
  };

  pattern: {
    id: string;
    name: string;
    occurrences: number;
    winRate: number;
    confidence: string;
  };

  scores: {
    technicalScore: number;
    probabilityScore: number;
    decisionScore: number;
    probabilityWeight: number;
  };

  filters: SignalFilterSnapshot[];

  config: HybridProbabilityConfig;

  candlesUsed: number;
  processingTimeMs: number;

  result: SignalResult;
  orderId: string | null;
  decisionId: number | null;

  decisionTree: DecisionTreeNode;
}

export interface SignalSummary {
  total: number;
  approved: number;
  blocked: number;
  insufficientData: number;
  lowConfidence: number;
  technicalRejection: number;
  approvalRate: number;
  blockRate: number;
  avgProcessingTimeMs: number;
  withResults: number;
  wins: number;
  losses: number;
  draws: number;
  accuracy: number;
}

// ═══════════════════════════════════════════════════════════════════
// STORAGE INTERFACE — abstrai backend (JSONL hoje, SQLite amanhã)
// ═══════════════════════════════════════════════════════════════════

export interface SignalStorage {
  append(entry: SignalLogEntry): void;
  update(id: string, patch: Partial<SignalLogEntry>): void;
  getAll(): SignalLogEntry[];
  getByAsset(asset: string): SignalLogEntry[];
  getByTimeframe(timeframe: string): SignalLogEntry[];
  getByStatus(status: SignalStatus): SignalLogEntry[];
  getByDecisionId(decisionId: number): SignalLogEntry | null;
  count(): number;
  clear(): void;
}

// ═══════════════════════════════════════════════════════════════════
// JSONL STORAGE — persiste em arquivo JSONL (uma linha por entry)
// ═══════════════════════════════════════════════════════════════════

const SIGNAL_LOG_FILE =
  "C:\\Users\\Windows 10Pro\\Desktop\\Puma V2\\modal-spark-suite\\signal_log.jsonl";

export class JsonlSignalStorage implements SignalStorage {
  private entries: SignalLogEntry[] = [];
  private _loaded = false;

  constructor() {
    // Lazy load — entries loaded on first access
  }

  private async _ensureLoaded(): Promise<void> {
    if (!this._loaded) {
      await this._loadFromDisk();
      this._loaded = true;
    }
  }

  append(entry: SignalLogEntry): void {
    this.entries.push(entry);
    this._appendToDisk(entry);
  }

  update(id: string, patch: Partial<SignalLogEntry>): void {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    Object.assign(this.entries[idx], patch);
    this._rewriteDisk();
  }

  getAll(): SignalLogEntry[] {
    // Sync access — returns what's in memory (loaded from disk on construction)
    return [...this.entries];
  }

  getByAsset(asset: string): SignalLogEntry[] {
    return this.entries.filter((e) => e.asset === asset);
  }

  getByTimeframe(timeframe: string): SignalLogEntry[] {
    return this.entries.filter((e) => e.timeframe === timeframe);
  }

  getByStatus(status: SignalStatus): SignalLogEntry[] {
    return this.entries.filter((e) => e.status === status);
  }

  getByDecisionId(decisionId: number): SignalLogEntry | null {
    return this.entries.find((e) => e.decisionId === decisionId) ?? null;
  }

  count(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
    this._rewriteDisk();
  }

  /**
   * Load existing entries from disk. Called automatically on first access,
   * or can be called explicitly for preloading.
   */
  async init(): Promise<void> {
    await this._ensureLoaded();
  }

  private async _loadFromDisk(): Promise<void> {
    try {
      if (typeof window !== "undefined") return;
      const fs = await import("fs");
      if (!fs.existsSync(SIGNAL_LOG_FILE)) return;
      const content = fs.readFileSync(SIGNAL_LOG_FILE, "utf-8");
      const lines = content.split("\n").filter((l: string) => l.trim());
      this.entries = lines.map((line: string) => JSON.parse(line) as SignalLogEntry);
    } catch {
      this.entries = [];
    }
  }

  private async _appendToDisk(entry: SignalLogEntry): Promise<void> {
    try {
      if (typeof window !== "undefined") return;
      const fs = await import("fs");
      fs.appendFileSync(SIGNAL_LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      // disco cheio, permissão — silencioso
    }
  }

  private async _rewriteDisk(): Promise<void> {
    try {
      if (typeof window !== "undefined") return;
      const fs = await import("fs");
      const content = this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(SIGNAL_LOG_FILE, content, "utf-8");
    } catch {
      // silencioso
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SIGNAL LOGGER — classe principal
// ═══════════════════════════════════════════════════════════════════

export class SignalLogger {
  private static instance: SignalLogger;
  private storage: SignalStorage;
  private _nextId = 0;

  static getInstance(): SignalLogger {
    if (!SignalLogger.instance) {
      SignalLogger.instance = new SignalLogger(new JsonlSignalStorage());
    }
    return SignalLogger.instance;
  }

  constructor(storage: SignalStorage) {
    this.storage = storage;
  }

  /**
   * Registra uma análise completa do HybridProbabilityEngine.
   * Chamado automaticamente após cada analyze().
   */
  log(entry: Omit<SignalLogEntry, "id" | "timestamp">): SignalLogEntry {
    const full: SignalLogEntry = {
      ...entry,
      id: `sig_${Date.now()}_${++this._nextId}`,
      timestamp: Date.now(),
    };
    this.storage.append(full);
    return full;
  }

  /**
   * Atualiza o decisionId de uma entrada (chamado pelo FlowRobotEngine
   * quando a decisão é vinculada a uma operação).
   */
  updateDecisionId(id: string, decisionId: number): void {
    this.storage.update(id, { decisionId });
  }

  /**
   * Atualiza o resultado de uma entrada (chamado quando o broker retorna
   * WIN/LOSS/DRAW).
   */
  updateResult(id: string, result: "WIN" | "LOSS" | "DRAW", orderId: string): void {
    this.storage.update(id, { result, orderId });
  }

  /**
   * Busca entrada por decisionId (para vincular com trade result).
   */
  getByDecisionId(decisionId: number): SignalLogEntry | null {
    return this.storage.getByDecisionId(decisionId);
  }

  /**
   * Retorna todas as entradas.
   */
  getAll(): SignalLogEntry[] {
    return this.storage.getAll();
  }

  /**
   * Retorna resumo geral.
   */
  getSummary(): SignalSummary {
    const all = this.storage.getAll();
    const approved = all.filter((e) => e.status === "APPROVED");
    const withResults = approved.filter((e) => e.result === "WIN" || e.result === "LOSS");
    const wins = withResults.filter((e) => e.result === "WIN").length;
    const losses = withResults.filter((e) => e.result === "LOSS").length;
    const draws = all.filter((e) => e.result === "DRAW").length;
    const avgTime =
      all.length > 0 ? all.reduce((s, e) => s + e.processingTimeMs, 0) / all.length : 0;

    return {
      total: all.length,
      approved: approved.length,
      blocked: all.filter((e) => e.status === "BLOCKED").length,
      insufficientData: all.filter((e) => e.status === "INSUFFICIENT_DATA").length,
      lowConfidence: all.filter((e) => e.status === "LOW_CONFIDENCE").length,
      technicalRejection: all.filter((e) => e.status === "TECHNICAL_REJECTION").length,
      approvalRate: all.length > 0 ? (approved.length / all.length) * 100 : 0,
      blockRate: all.length > 0 ? ((all.length - approved.length) / all.length) * 100 : 0,
      avgProcessingTimeMs: avgTime,
      withResults: withResults.length,
      wins,
      losses,
      draws,
      accuracy: withResults.length > 0 ? (wins / withResults.length) * 100 : 0,
    };
  }

  /**
   * Limpa todas as entradas.
   */
  clear(): void {
    this.storage.clear();
  }
}

/** Instância singleton para uso global */
export const signalLogger = SignalLogger.getInstance();
