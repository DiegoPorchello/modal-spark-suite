import type { PumaBrokerAdapter } from "@/broker/puma-broker-adapter";
import type { BrokerAsset } from "@/broker/types";
import type {
  PerformanceContext,
  AssetPerformance,
} from "@/modules/performance/types/performance-context.types";
import type {
  AssetViewModel,
  AssetConfigState,
  ConfidenceThresholds,
} from "@/components/asset-config/types";
import { DEFAULT_CONFIDENCE } from "@/components/asset-config/types";

type AssetStoreListener = (changed: Set<string>) => void;

function computeConfidence(
  wins: number,
  losses: number,
  netProfit: number,
  totalTrades: number,
  t: ConfidenceThresholds,
): number {
  if (totalTrades === 0) return 0;
  const wr = (wins / totalTrades) * 100;
  const ps = netProfit > 0 ? Math.min(100, 50 + netProfit / 10) : Math.max(0, 50 + netProfit / 10);
  const c = Math.max(0, 100 - losses * 3);
  return Math.round(
    Math.max(0, Math.min(100, wr * t.weightWins + ps * t.weightProfit + c * t.weightConsistency)),
  );
}

function getConsecutiveLosses(perf: AssetPerformance | undefined): number {
  if (!perf || perf.winRate >= 50) return 0;
  return Math.min(perf.losses, Math.floor(perf.losses * (1 - perf.winRate / 100) + 1));
}

function determineStatus(
  enabled: boolean,
  quarantined: boolean,
  hasHistory: boolean,
): AssetViewModel["status"] {
  if (quarantined) return "quarantined";
  if (!enabled) return "inactive";
  if (!hasHistory) return "no-history";
  return "active";
}

function defaultState(symbol: string, states: Record<string, AssetConfigState>): AssetConfigState {
  return (
    states[symbol] ?? {
      enabled: true,
      quarantined: false,
      quarantineReason: "",
      quarantinedAt: null,
      reactivatedAt: null,
      confidenceOverride: null,
    }
  );
}

function buildVMFromPerformance(
  perf: AssetPerformance,
  engineSymbols: Set<string>,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  const s = defaultState(perf.asset, states);
  const confidence =
    s.confidenceOverride ??
    computeConfidence(perf.wins, perf.losses, perf.netProfit, perf.totalTrades, thresholds);
  return {
    symbol: perf.asset,
    name: perf.asset,
    category: "",
    payout: 0,
    enabled: s.enabled,
    available: true,
    configured: engineSymbols.has(perf.asset),
    hasHistory: true,
    status: determineStatus(s.enabled, s.quarantined, true),
    confidence,
    winRate: perf.winRate,
    profit: perf.netProfit,
    wins: perf.wins,
    losses: perf.losses,
    operations: perf.totalTrades,
    consecutiveLosses: getConsecutiveLosses(perf),
    lastOperation: null,
    quarantineReason: s.quarantined ? s.quarantineReason : "",
    quarantineDate: s.quarantinedAt,
    averageScore: perf.averageScore,
    source: "performance",
  };
}

function buildVMFromEngine(
  symbol: string,
  perf: AssetPerformance | undefined,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  if (perf) {
    const vm = buildVMFromPerformance(perf, new Set([symbol]), states, thresholds);
    vm.configured = true;
    return vm;
  }
  const s = defaultState(symbol, states);
  return {
    symbol,
    name: symbol,
    category: "",
    payout: 0,
    enabled: s.enabled,
    available: false,
    configured: true,
    hasHistory: false,
    status: determineStatus(s.enabled, s.quarantined, false),
    confidence: 0,
    winRate: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    operations: 0,
    consecutiveLosses: 0,
    lastOperation: null,
    quarantineReason: s.quarantined ? s.quarantineReason : "",
    quarantineDate: s.quarantinedAt,
    averageScore: 0,
    source: "engine",
  };
}

function buildVMFromBroker(
  broker: BrokerAsset,
  engineSymbols: Set<string>,
  perf: AssetPerformance | undefined,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  if (perf) {
    const vm = buildVMFromPerformance(perf, engineSymbols, states, thresholds);
    vm.name = broker.name;
    vm.category = broker.category;
    vm.payout = broker.payout;
    vm.available = broker.active;
    return vm;
  }
  const s = defaultState(broker.symbol, states);
  return {
    symbol: broker.symbol,
    name: broker.name,
    category: broker.category,
    payout: broker.payout,
    enabled: s.enabled,
    available: broker.active,
    configured: engineSymbols.has(broker.symbol),
    hasHistory: false,
    status: determineStatus(s.enabled, s.quarantined, false),
    confidence: 0,
    winRate: 0,
    profit: 0,
    wins: 0,
    losses: 0,
    operations: 0,
    consecutiveLosses: 0,
    lastOperation: null,
    quarantineReason: s.quarantined ? s.quarantineReason : "",
    quarantineDate: s.quarantinedAt,
    averageScore: 0,
    source: "broker",
  };
}

function shallowEqualVM(a: AssetViewModel, b: AssetViewModel): boolean {
  return (
    a.symbol === b.symbol &&
    a.enabled === b.enabled &&
    a.available === b.available &&
    a.configured === b.configured &&
    a.hasHistory === b.hasHistory &&
    a.status === b.status &&
    a.confidence === b.confidence &&
    a.winRate === b.winRate &&
    a.profit === b.profit &&
    a.wins === b.wins &&
    a.losses === b.losses &&
    a.operations === b.operations &&
    a.consecutiveLosses === b.consecutiveLosses &&
    a.lastOperation === b.lastOperation &&
    a.quarantineReason === b.quarantineReason &&
    a.quarantineDate === b.quarantineDate &&
    a.averageScore === b.averageScore
  );
}

export class AssetStore {
  private _assets = new Map<string, AssetViewModel>();
  private _recentTrades: {
    asset: string;
    result: "WIN" | "LOSS" | "BREAKEVEN";
    profit: number;
    timestamp: number;
    direction: string;
    score: number;
  }[] = [];
  private _listeners = new Set<AssetStoreListener>();
  private _engineSymbols: string[] = [];
  private _performanceMap = new Map<string, AssetPerformance>();
  private _assetStates: Record<string, AssetConfigState> = {};
  private _confidenceThresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE;
  private _brokerAssets: BrokerAsset[] = [];

  on(listener: AssetStoreListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _emit(changed: Set<string>): void {
    if (changed.size === 0) return;
    for (const l of this._listeners) {
      try {
        l(changed);
      } catch {
        /* listener error — skip */
      }
    }
  }

  getAssets(): AssetViewModel[] {
    return Array.from(this._assets.values());
  }

  getAsset(symbol: string): AssetViewModel | undefined {
    return this._assets.get(symbol);
  }

  getRecentTrades(): typeof this._recentTrades {
    return this._recentTrades;
  }

  getAssetMap(): Map<string, AssetViewModel> {
    return this._assets;
  }

  // ── Incremental updates ──

  setPerformance(performance: PerformanceContext | null): void {
    const newMap = new Map<string, AssetPerformance>();
    if (performance) {
      for (const a of performance.byAsset) {
        newMap.set(a.asset, a);
      }
    }
    this._performanceMap = newMap;
    this._recentTrades = performance
      ? performance.recentTrades.map((t) => ({
          asset: t.asset,
          result: t.result,
          profit: t.profit,
          timestamp: t.timestamp,
          direction: t.direction,
          score: t.score,
        }))
      : [];
    this._rebuildDirty();
  }

  setEngineAssets(symbols: string[]): void {
    const prev = this._engineSymbols;
    this._engineSymbols = symbols;
    const changed = new Set<string>();
    const engineSet = new Set(symbols);

    for (const s of symbols) {
      if (!prev.includes(s)) changed.add(s);
    }
    for (const s of prev) {
      if (!engineSet.has(s)) changed.add(s);
    }

    if (changed.size === 0) return;
    this._rebuildDirty(changed);
  }

  setBrokerAssets(assets: BrokerAsset[]): void {
    const prev = this._brokerAssets;
    this._brokerAssets = assets;
    const changed = new Set<string>();
    const prevMap = new Map(prev.map((b) => [b.symbol, b]));

    for (const b of assets) {
      const old = prevMap.get(b.symbol);
      if (
        !old ||
        old.active !== b.active ||
        old.name !== b.name ||
        old.category !== b.category ||
        old.payout !== b.payout
      ) {
        changed.add(b.symbol);
      }
    }
    for (const b of prev) {
      if (!assets.find((a) => a.symbol === b.symbol)) {
        changed.add(b.symbol);
      }
    }

    if (changed.size === 0) return;
    this._rebuildDirty(changed);
  }

  setAssetState(symbol: string, state: AssetConfigState): void {
    this._assetStates = { ...this._assetStates, [symbol]: state };
    this._rebuildDirty(new Set([symbol]));
  }

  setAssetStates(states: Record<string, AssetConfigState>): void {
    const changed = new Set<string>();
    for (const s of new Set([...Object.keys(states), ...Object.keys(this._assetStates)])) {
      if (JSON.stringify(states[s]) !== JSON.stringify(this._assetStates[s])) {
        changed.add(s);
      }
    }
    this._assetStates = states;
    if (changed.size > 0) this._rebuildDirty(changed);
  }

  setConfidenceThresholds(thresholds: ConfidenceThresholds): void {
    this._confidenceThresholds = thresholds;
    this._rebuildDirty(new Set(this._assets.keys()));
  }

  private _rebuildDirty(dirty?: Set<string>): void {
    const engineSymbols = new Set(this._engineSymbols);
    const changed = new Set<string>();

    const updateOrAdd = (symbol: string, build: () => AssetViewModel) => {
      if (dirty && !dirty.has(symbol)) return;
      const existing = this._assets.get(symbol);
      const next = build();
      if (!existing || !shallowEqualVM(existing, next)) {
        this._assets.set(symbol, next);
        changed.add(symbol);
      }
    };

    for (const [symbol, perf] of this._performanceMap) {
      updateOrAdd(symbol, () =>
        buildVMFromPerformance(perf, engineSymbols, this._assetStates, this._confidenceThresholds),
      );
    }

    for (const symbol of this._engineSymbols) {
      if (!this._performanceMap.has(symbol)) {
        updateOrAdd(symbol, () =>
          buildVMFromEngine(symbol, undefined, this._assetStates, this._confidenceThresholds),
        );
      } else {
        const existing = this._assets.get(symbol);
        if (existing && !existing.configured) {
          const updated = { ...existing, configured: true };
          this._assets.set(symbol, updated);
          changed.add(symbol);
        }
      }
    }

    for (const broker of this._brokerAssets) {
      if (!this._assets.has(broker.symbol)) {
        updateOrAdd(broker.symbol, () =>
          buildVMFromBroker(
            broker,
            engineSymbols,
            this._performanceMap.get(broker.symbol),
            this._assetStates,
            this._confidenceThresholds,
          ),
        );
      } else {
        const vm = this._assets.get(broker.symbol)!;
        let dirty = false;
        if (vm.available !== broker.active) {
          vm.available = broker.active;
          dirty = true;
        }
        if (broker.name && vm.name !== broker.name) {
          vm.name = broker.name;
          dirty = true;
        }
        if (broker.category && vm.category !== broker.category) {
          vm.category = broker.category;
          dirty = true;
        }
        if (broker.payout && vm.payout !== broker.payout) {
          vm.payout = broker.payout;
          dirty = true;
        }
        if (dirty) changed.add(broker.symbol);
      }
    }

    this._emit(changed);
  }
}
