/**
 * PerformanceHistory — FIFO ring buffer of daily PerformanceContext snapshots.
 *
 * Stores up to 365 snapshots (one per day).
 * Uses localStorage for persistence across sessions.
 * Each snapshot is a PerformanceSnapshot (lightweight summary).
 */

import type { PerformanceContext, PerformanceSnapshot } from "../types/performance-context.types";
import { buildSnapshot } from "./performance-engine";

const STORAGE_KEY = "nexor_performance_history";
const MAX_SNAPSHOTS = 365;

export class PerformanceHistory {
  private snapshots: PerformanceSnapshot[] = [];
  private loaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    if (this.loaded) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.snapshots = JSON.parse(raw) as PerformanceSnapshot[];
        // Ensure FIFO limit
        if (this.snapshots.length > MAX_SNAPSHOTS) {
          this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
        }
      }
    } catch {
      this.snapshots = [];
    }
    this.loaded = true;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshots));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }

  /**
   * Record a new snapshot from a PerformanceContext.
   * If the last snapshot is from the same day, it is replaced.
   */
  record(ctx: PerformanceContext): void {
    this.load();
    const snapshot = buildSnapshot(ctx);
    const today = new Date(snapshot.timestamp).toDateString();

    // Replace if same day
    if (this.snapshots.length > 0) {
      const lastDate = new Date(this.snapshots[this.snapshots.length - 1].timestamp).toDateString();
      if (lastDate === today) {
        this.snapshots[this.snapshots.length - 1] = snapshot;
        this.persist();
        return;
      }
    }

    // Append and enforce FIFO
    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }
    this.persist();
  }

  /**
   * Push a pre-built snapshot directly.
   */
  push(snapshot: PerformanceSnapshot): void {
    this.load();
    const today = new Date(snapshot.timestamp).toDateString();

    if (this.snapshots.length > 0) {
      const lastDate = new Date(this.snapshots[this.snapshots.length - 1].timestamp).toDateString();
      if (lastDate === today) {
        this.snapshots[this.snapshots.length - 1] = snapshot;
        this.persist();
        return;
      }
    }

    this.snapshots.push(snapshot);
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    }
    this.persist();
  }

  /** Get all snapshots (newest last for chronological view) */
  getAll(): PerformanceSnapshot[] {
    this.load();
    return [...this.snapshots];
  }

  /** Get the latest snapshot */
  getLatest(): PerformanceSnapshot | null {
    this.load();
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /** Get last N snapshots */
  getLast(n: number): PerformanceSnapshot[] {
    this.load();
    return this.snapshots.slice(-n);
  }

  /** Get snapshots within a date range */
  getRange(from: number, to: number): PerformanceSnapshot[] {
    this.load();
    return this.snapshots.filter((s) => s.timestamp >= from && s.timestamp <= to);
  }

  /** Clear all history */
  clear(): void {
    this.snapshots = [];
    this.persist();
  }

  /** Get total count */
  get count(): number {
    this.load();
    return this.snapshots.length;
  }
}

/** Singleton instance */
export const performanceHistory = new PerformanceHistory();
