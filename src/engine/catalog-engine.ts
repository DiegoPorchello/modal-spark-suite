import type { PumaBrokerAdapter } from "../broker/puma-broker-adapter";
import type { Candle } from "../market/types";
import { OPEN_MARKET_ASSETS, CLOSED_MARKET_ASSETS } from "../market/market-session-manager";

export interface CatalogEntry {
  asset: string;
  score: number;
  winrate: number;
  totalPatterns: number;
  wins: number;
  losses: number;
  direction: "CALL" | "PUT" | null;
  lastAnalysis: number;
  timeframe: string;
  patternDesc: string;
}

export class CatalogEngine {
  private broker: PumaBrokerAdapter;
  private entries = new Map<string, CatalogEntry>();
  private listeners = new Set<(entries: CatalogEntry[]) => void>();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private currentIndex = 0;
  private assets: string[] = [];

  private readonly SCAN_INTERVAL = 60 * 60 * 1000;
  private readonly BATCH_GAP = 4000;
  private readonly LOOKBACK = 150;

  constructor(broker: PumaBrokerAdapter) {
    this.broker = broker;
  }

  start(timeframe: string = "M1"): void {
    if (this.running) return;
    this.running = true;
    this.refreshAssets().then(() => this.nextBatch(timeframe));
    this.scanTimer = setInterval(() => {
      this.refreshAssets().then(() => this.nextBatch(timeframe));
    }, this.SCAN_INTERVAL);
  }

  stop(): void {
    this.running = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  refreshAssets(): Promise<void> {
    return new Promise((resolve) => {
      if (this.assets.length > 0) {
        resolve();
        return;
      }
      this.broker
        .getAssets()
        .then((brokerAssets) => {
          if (brokerAssets && brokerAssets.length > 0) {
            this.assets = [...new Set(brokerAssets.map((a) => a.symbol))];
          }
          if (this.assets.length === 0) {
            // Usa ativos da sessão atual via session manager
            const sessionInfo = this.broker.getSessionInfo();
            this.assets = sessionInfo.activeAssets;
          }
          resolve();
        })
        .catch(() => {
          if (this.assets.length === 0) {
            // Fallback: combina ativos de ambas as sessões
            this.assets = [...new Set([...OPEN_MARKET_ASSETS, ...CLOSED_MARKET_ASSETS])];
          }
          resolve();
        });
    });
  }

  nextBatch(timeframe: string): void {
    this.currentIndex = 0;
    this.processNext(timeframe);
  }

  processNext(timeframe: string): void {
    if (!this.running || this.currentIndex >= this.assets.length) {
      if (this.currentIndex >= this.assets.length) {
        this.notify();
      }
      return;
    }
    const asset = this.assets[this.currentIndex++];
    this.analyzeAsset(asset, timeframe).finally(() => {
      this.batchTimer = setTimeout(() => this.processNext(timeframe), this.BATCH_GAP);
    });
  }

  async analyzeAsset(asset: string, timeframe: string): Promise<void> {
    const result = await this.scoreTimeframe(asset, timeframe);
    if (result) {
      const existing = this.entries.get(asset);
      if (!existing || result.lastAnalysis > (existing.lastAnalysis || 0)) {
        this.entries.set(asset, result);
        this.notify();
      }
    }
  }

  private async scoreTimeframe(asset: string, timeframe: string): Promise<CatalogEntry | null> {
    let candles: Candle[];
    try {
      candles = await this.broker.getCandles(asset, timeframe, this.LOOKBACK);
    } catch {
      return null;
    }

    if (!candles || candles.length < 20) return null;

    let wins = 0;
    let losses = 0;
    let lastDir: "CALL" | "PUT" | null = null;

    for (let i = 2; i < candles.length - 1; i++) {
      const a = candles[i - 2];
      const b = candles[i - 1];
      const c = candles[i];

      const greenA = a.close > a.open;
      const greenB = b.close > b.open;

      if (greenA !== greenB) continue;

      const greenC = c.close > c.open;

      if (greenC === greenB) {
        wins++;
        lastDir = greenB ? "CALL" : "PUT";
      } else {
        losses++;
      }

      i++;
    }

    const total = wins + losses;
    if (total === 0) return null;

    const winrate = (wins / total) * 100;
    const entry: CatalogEntry = {
      asset,
      score: Math.round(winrate),
      winrate: Math.round(winrate * 10) / 10,
      totalPatterns: total,
      wins,
      losses,
      direction: lastDir,
      lastAnalysis: Date.now(),
      timeframe,
      patternDesc: `${wins}W/${losses}L (${total} padrões)`,
    };

    return entry;
  }

  notify(): void {
    this.listeners.forEach((cb) => cb(this.getCatalog()));
  }

  getCatalog(): CatalogEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.score - a.score);
  }

  subscribe(cb: (entries: CatalogEntry[]) => void): () => void {
    this.listeners.add(cb);
    cb(this.getCatalog());
    return () => this.listeners.delete(cb);
  }

  forceRefresh(timeframe: string = "M1"): void {
    this.refreshAssets().then(() => {
      this.nextBatch(timeframe);
    });
  }
}
