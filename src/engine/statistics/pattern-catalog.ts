import type { Candle } from "../../market/types";
import type {
  PatternDefinition,
  PatternMatch,
  PatternRecord,
} from "./types";

function candleColor(candle: Candle): "GREEN" | "RED" {
  return candle.close >= candle.open ? "GREEN" : "RED";
}

function makeKey(patternId: string, asset: string, timeframe: string): string {
  return `${patternId}:${asset}:${timeframe}`;
}

export class PatternCatalogEngine {
  private patterns = new Map<string, PatternDefinition>();
  private records = new Map<string, PatternRecord>();
  private listeners = new Set<(record: PatternRecord) => void>();

  registerPattern(definition: PatternDefinition): void {
    this.patterns.set(definition.id, definition);
  }

  analyze(candles: Candle[], asset: string, timeframe: string): PatternRecord[] {
    const results: PatternRecord[] = [];

    for (const [, definition] of this.patterns) {
      const match = definition.detector(candles);
      if (!match || !match.detected) continue;

      const key = makeKey(definition.id, asset, timeframe);
      const existing = this.records.get(key);
      const now = Date.now();

      if (existing) {
        existing.occurrences++;
        existing.lastSeen = now;
        existing.updatedAt = now;
        existing.winrate = existing.occurrences > 0
          ? (existing.wins / existing.occurrences) * 100
          : 0;
        results.push(existing);
      } else {
        const record: PatternRecord = {
          patternId: definition.id,
          asset,
          timeframe,
          occurrences: 1,
          wins: 0,
          losses: 0,
          winrate: 0,
          lastSeen: now,
          createdAt: now,
          updatedAt: now,
        };
        this.records.set(key, record);
        results.push(record);
      }

      const record = this.records.get(key)!;
      this.notifyListeners(record);
    }

    return results;
  }

  recordOutcome(
    patternId: string,
    asset: string,
    timeframe: string,
    win: boolean,
  ): void {
    const key = makeKey(patternId, asset, timeframe);
    const existing = this.records.get(key);
    if (!existing) return;

    if (win) existing.wins++;
    else existing.losses++;

    existing.occurrences = existing.wins + existing.losses;
    existing.winrate = existing.occurrences > 0
      ? (existing.wins / existing.occurrences) * 100
      : 0;
    existing.updatedAt = Date.now();

    this.notifyListeners(existing);
  }

  getRecord(patternId: string, asset: string, timeframe: string): PatternRecord | null {
    return this.records.get(makeKey(patternId, asset, timeframe)) ?? null;
  }

  getRecordsByAsset(asset: string, timeframe: string): PatternRecord[] {
    const results: PatternRecord[] = [];
    for (const record of this.records.values()) {
      if (record.asset === asset && record.timeframe === timeframe) {
        results.push(record);
      }
    }
    return results;
  }

  getRecordsByPattern(patternId: string): PatternRecord[] {
    const results: PatternRecord[] = [];
    for (const record of this.records.values()) {
      if (record.patternId === patternId) {
        results.push(record);
      }
    }
    return results;
  }

  getOverallWinrate(asset: string, timeframe: string): number | null {
    const records = this.getRecordsByAsset(asset, timeframe);
    if (records.length === 0) return null;

    let totalWins = 0;
    let totalOccurrences = 0;
    for (const record of records) {
      totalWins += record.wins;
      totalOccurrences += record.occurrences;
    }

    return totalOccurrences > 0 ? (totalWins / totalOccurrences) * 100 : null;
  }

  getPatternWinrate(patternId: string, asset: string, timeframe: string): number | null {
    const record = this.getRecord(patternId, asset, timeframe);
    return record && record.occurrences > 0 ? record.winrate : null;
  }

  subscribe(listener: (record: PatternRecord) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notifyListeners(record: PatternRecord): void {
    for (const listener of this.listeners) {
      listener(record);
    }
  }
}
