/**
 * Memory Storage
 *
 * In-memory storage for MarketMemoryRecords with FIFO eviction.
 * Max 2000 records (configurable).
 */

import type { MarketMemoryRecord } from "../types/memory-types";

const MAX_RECORDS = 2000;

export class MemoryStorage {
  private records: MarketMemoryRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords: number = MAX_RECORDS) {
    this.maxRecords = maxRecords;
  }

  /**
   * Add a record (FIFO eviction).
   */
  add(record: MarketMemoryRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * Update a record by ID.
   */
  update(id: string, patch: Partial<MarketMemoryRecord>): MarketMemoryRecord | null {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.records[idx] = { ...this.records[idx], ...patch, updatedAt: Date.now() };
    return this.records[idx];
  }

  /**
   * Get a record by ID.
   */
  get(id: string): MarketMemoryRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /**
   * Get all records.
   */
  getAll(): MarketMemoryRecord[] {
    return [...this.records];
  }

  /**
   * Get records by strategy.
   */
  getByStrategy(strategyId: string): MarketMemoryRecord[] {
    return this.records.filter((r) => r.strategy === strategyId);
  }

  /**
   * Get records by core.
   */
  getByCore(coreId: string): MarketMemoryRecord[] {
    return this.records.filter((r) => r.core === coreId);
  }

  /**
   * Get records by session.
   */
  getBySession(session: string): MarketMemoryRecord[] {
    return this.records.filter((r) => r.session === session);
  }

  /**
   * Get recent N records.
   */
  getRecent(n: number): MarketMemoryRecord[] {
    return this.records.slice(-n);
  }

  /**
   * Get count.
   */
  count(): number {
    return this.records.length;
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records = [];
  }
}
