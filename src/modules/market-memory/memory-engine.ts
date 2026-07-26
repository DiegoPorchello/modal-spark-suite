/**
 * Memory Engine
 *
 * Records operations and provides analytics.
 * Generic — works for any Core/Profile/Strategy combination.
 */

import type {
  MarketMemoryRecord,
  MarketMemoryStats,
  OperationResult,
  MemoryRecordEvent,
} from "./types/memory-types";
import { MemoryStorage } from "./storage/memory-storage";

type MemoryEventHandler = (event: MemoryRecordEvent) => void;

let recordCounter = 0;

export class MemoryEngine {
  private storage: MemoryStorage;
  private handlers: Set<MemoryEventHandler> = new Set();

  constructor(maxRecords?: number) {
    this.storage = new MemoryStorage(maxRecords);
  }

  subscribe(handler: MemoryEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  private emit(event: MemoryRecordEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* swallow */ }
    }
  }

  /**
   * Record a new operation.
   */
  record(data: Omit<MarketMemoryRecord, "id" | "recordedAt" | "updatedAt">): MarketMemoryRecord {
    const now = Date.now();
    const record: MarketMemoryRecord = {
      ...data,
      id: `mem-${Date.now()}-${++recordCounter}`,
      recordedAt: now,
      updatedAt: now,
    };

    this.storage.add(record);

    this.emit({
      type: "memory.record.created",
      recordId: record.id,
      asset: record.asset,
      strategy: record.strategy,
      result: record.result,
      timestamp: now,
    });

    return record;
  }

  /**
   * Update an existing record (e.g. when operation closes).
   */
  update(id: string, patch: Partial<MarketMemoryRecord>): MarketMemoryRecord | null {
    const updated = this.storage.update(id, patch);
    if (!updated) return null;

    this.emit({
      type: "memory.record.updated",
      recordId: id,
      asset: updated.asset,
      strategy: updated.strategy,
      result: updated.result,
      timestamp: Date.now(),
    });

    return updated;
  }

  /**
   * Get record by ID.
   */
  get(id: string): MarketMemoryRecord | undefined {
    return this.storage.get(id);
  }

  /**
   * Get all records.
   */
  getAll(): MarketMemoryRecord[] {
    return this.storage.getAll();
  }

  /**
   * Get recent N records.
   */
  getRecent(n: number): MarketMemoryRecord[] {
    return this.storage.getRecent(n);
  }

  /**
   * Compute statistics.
   */
  getStats(): MarketMemoryStats {
    const all = this.storage.getAll();
    const completed = all.filter((r) => r.result === "WIN" || r.result === "LOSS" || r.result === "BREAK_EVEN");

    const wins = all.filter((r) => r.result === "WIN").length;
    const losses = all.filter((r) => r.result === "LOSS").length;
    const breakEvens = all.filter((r) => r.result === "BREAK_EVEN").length;
    const pending = all.filter((r) => r.result === "PENDING").length;

    const winRate = completed.length > 0 ? (wins / completed.length) * 100 : 0;
    const avgScore = completed.length > 0
      ? completed.reduce((s, r) => s + r.score, 0) / completed.length
      : 0;
    const avgConfidence = completed.length > 0
      ? completed.reduce((s, r) => s + r.confidence, 0) / completed.length
      : 0;
    const avgProfit = completed.length > 0
      ? completed.reduce((s, r) => s + (r.pnl ?? 0), 0) / completed.length
      : 0;

    // Group by strategy
    const byStrategy = this.groupByField(completed, "strategy");
    const byCore = this.groupByField(completed, "core");
    const byProfile = this.groupByField(completed, "profile");
    const bySession = this.groupByField(completed, "session");

    return {
      totalOperations: all.length,
      wins,
      losses,
      breakEvens,
      winRate,
      avgScore,
      avgConfidence,
      avgProfit,
      byStrategy,
      byCore,
      byProfile,
      bySession,
      byResult: {
        WIN: wins,
        LOSS: losses,
        BREAK_EVEN: breakEvens,
        PENDING: pending,
      },
    };
  }

  /**
   * Get ranking of strategies by win rate (min 5 operations).
   */
  getStrategyRanking(): Array<{
    strategy: string;
    strategyName: string;
    count: number;
    winRate: number;
    avgScore: number;
    avgConfidence: number;
  }> {
    const all = this.storage.getAll().filter(
      (r) => r.result === "WIN" || r.result === "LOSS" || r.result === "BREAK_EVEN",
    );

    const grouped = new Map<string, MarketMemoryRecord[]>();
    for (const r of all) {
      const key = r.strategy;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    const ranking = [...grouped.entries()]
      .filter(([, records]) => records.length >= 5)
      .map(([strategy, records]) => {
        const wins = records.filter((r) => r.result === "WIN").length;
        return {
          strategy,
          strategyName: records[0]?.strategyName ?? strategy,
          count: records.length,
          winRate: (wins / records.length) * 100,
          avgScore: records.reduce((s, r) => s + r.score, 0) / records.length,
          avgConfidence: records.reduce((s, r) => s + r.confidence, 0) / records.length,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);

    return ranking;
  }

  /**
   * Group records by a field and compute win rate.
   */
  private groupByField(
    records: MarketMemoryRecord[],
    field: keyof MarketMemoryRecord,
  ): Record<string, { count: number; winRate: number }> {
    const grouped = new Map<string, MarketMemoryRecord[]>();
    for (const r of records) {
      const key = String(r[field]);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    const result: Record<string, { count: number; winRate: number }> = {};
    for (const [key, recs] of grouped) {
      const wins = recs.filter((r) => r.result === "WIN").length;
      result[key] = {
        count: recs.length,
        winRate: recs.length > 0 ? (wins / recs.length) * 100 : 0,
      };
    }
    return result;
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.storage.clear();
  }
}

/** Singleton */
let globalMemoryEngine: MemoryEngine | null = null;

export function getGlobalMemoryEngine(): MemoryEngine {
  if (!globalMemoryEngine) {
    globalMemoryEngine = new MemoryEngine();
  }
  return globalMemoryEngine;
}
