/**
 * AdvisorHistory — FIFO ring buffer for AdvisorContext snapshots.
 * Stores the last 200 recommendation entries for historical analysis.
 */

import type { AdvisorContext, AdvisorFeedEntry } from "../types/advisor-context.types";

const STORAGE_KEY = "nexor_advisor_history";
const MAX_ENTRIES = 200;

class AdvisorHistory {
  private entries: AdvisorFeedEntry[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw) as AdvisorFeedEntry[];
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // silently fail
    }
  }

  /**
   * Record a new AdvisorContext, extracting feed entries from it.
   */
  record(ctx: AdvisorContext): void {
    const newEntries = ctxToFeedEntries(ctx);
    this.entries = [...newEntries, ...this.entries].slice(0, MAX_ENTRIES);
    this.save();
  }

  /**
   * Get all stored feed entries (newest first).
   */
  getAll(): AdvisorFeedEntry[] {
    return [...this.entries];
  }

  /**
   * Get the last N entries.
   */
  getLast(n: number): AdvisorFeedEntry[] {
    return this.entries.slice(0, n);
  }

  /**
   * Get entries from a specific timestamp onwards.
   */
  getSince(timestamp: number): AdvisorFeedEntry[] {
    return this.entries.filter((e) => e.timestamp >= timestamp);
  }

  /**
   * Clear all stored entries.
   */
  clear(): void {
    this.entries = [];
    this.save();
  }
}

function ctxToFeedEntries(ctx: AdvisorContext): AdvisorFeedEntry[] {
  const entries: AdvisorFeedEntry[] = [];

  for (const rec of ctx.recommendations) {
    entries.push({
      id: rec.id,
      timestamp: ctx.generatedAt,
      type: "recommendation",
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
    });
  }

  for (const alert of ctx.alerts) {
    entries.push({
      id: alert.id,
      timestamp: ctx.generatedAt,
      type: "alert",
      title: alert.title,
      description: alert.description,
      priority: alert.severity,
    });
  }

  for (const opp of ctx.opportunities) {
    entries.push({
      id: opp.id,
      timestamp: ctx.generatedAt,
      type: "opportunity",
      title: opp.title,
      description: opp.description,
      priority: "INFO",
    });
  }

  return entries;
}

export const advisorHistory = new AdvisorHistory();
