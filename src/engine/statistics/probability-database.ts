import type {
  StatisticalEntry,
  StatisticalDatabase,
  ConfidenceLevel,
  PatternRecord,
} from "./types";

const CACHE_TTL = 5 * 60 * 1000;
const DB_VERSION = 1;

interface CacheEntry {
  entry: StatisticalEntry;
  timestamp: number;
}

function calculateConfidence(occurrences: number, winrate: number): ConfidenceLevel {
  if (occurrences >= 50 && winrate >= 65) return "alta";
  if (occurrences >= 20 && winrate >= 55) return "media";
  return "baixa";
}

function makeKey(patternId: string, asset: string, timeframe: string): string {
  return `${patternId}:${asset}:${timeframe}`;
}

function recordToEntry(record: PatternRecord, version: number): StatisticalEntry {
  const now = Date.now();
  return {
    patternId: record.patternId,
    asset: record.asset,
    timeframe: record.timeframe,
    winRate: record.winrate,
    occurrences: record.occurrences,
    confidence: calculateConfidence(record.occurrences, record.winrate),
    version,
    lastUpdate: now,
    createdAt: record.createdAt,
    wins: record.wins,
    losses: record.losses,
    avgStrength: 0,
    directionBreakdown: {
      call: { occurrences: 0, winrate: 0 },
      put: { occurrences: 0, winrate: 0 },
    },
  };
}

export class ProbabilityDatabaseService {
  private static instance: ProbabilityDatabaseService;

  private db: StatisticalDatabase = {
    version: DB_VERSION,
    entries: new Map(),
    lastGlobalUpdate: Date.now(),
    totalPatterns: 0,
  };

  private cache = new Map<string, CacheEntry>();
  private cacheHits = 0;
  private cacheMisses = 0;

  static getInstance(): ProbabilityDatabaseService {
    if (!ProbabilityDatabaseService.instance) {
      ProbabilityDatabaseService.instance = new ProbabilityDatabaseService();
    }
    return ProbabilityDatabaseService.instance;
  }

  updateFromRecord(record: PatternRecord): StatisticalEntry {
    const key = makeKey(record.patternId, record.asset, record.timeframe);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.cacheHits++;
      return cached.entry;
    }

    this.cacheMisses++;
    const entry = recordToEntry(record, this.db.version);
    this.db.entries.set(key, entry);
    this.db.lastGlobalUpdate = Date.now();
    this.db.totalPatterns = this.db.entries.size;

    this.cache.set(key, { entry, timestamp: Date.now() });
    return entry;
  }

  get(patternId: string, asset: string, timeframe: string): StatisticalEntry | null {
    const key = makeKey(patternId, asset, timeframe);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      this.cacheHits++;
      return cached.entry;
    }

    this.cacheMisses++;
    const entry = this.db.entries.get(key) ?? null;
    if (entry) {
      this.cache.set(key, { entry, timestamp: Date.now() });
    }
    return entry;
  }

  getAll(asset: string, timeframe: string): StatisticalEntry[] {
    const results: StatisticalEntry[] = [];
    for (const entry of this.db.entries.values()) {
      if (entry.asset === asset && entry.timeframe === timeframe) {
        results.push(entry);
      }
    }
    return results;
  }

  getOverallWinrate(asset: string, timeframe: string): number | null {
    const entries = this.getAll(asset, timeframe);
    if (entries.length === 0) return null;

    let totalWins = 0;
    let totalOccurrences = 0;
    for (const entry of entries) {
      totalWins += entry.wins;
      totalOccurrences += entry.occurrences;
    }

    return totalOccurrences > 0 ? (totalWins / totalOccurrences) * 100 : null;
  }

  getConfidence(patternId: string, asset: string, timeframe: string): ConfidenceLevel {
    const entry = this.get(patternId, asset, timeframe);
    return entry?.confidence ?? "baixa";
  }

  getHistoryScore(asset: string, timeframe: string): number {
    const winrate = this.getOverallWinrate(asset, timeframe);
    if (winrate === null) return 0;
    return Math.max(0, Math.min(100, (winrate - 50) * 2));
  }

  getVersion(): number {
    return this.db.version;
  }

  migrate(fromVersion: number, toVersion: number): void {
    if (fromVersion === toVersion) return;
    this.db.version = toVersion;
    this.clearCache();
  }

  invalidateCache(patternId: string, asset: string, timeframe: string): void {
    const key = makeKey(patternId, asset, timeframe);
    this.cache.delete(key);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getStats(): {
    totalEntries: number;
    lastUpdate: number;
    version: number;
    cacheHits: number;
    cacheMisses: number;
    cacheSize: number;
  } {
    return {
      totalEntries: this.db.entries.size,
      lastUpdate: this.db.lastGlobalUpdate,
      version: this.db.version,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheSize: this.cache.size,
    };
  }
}
