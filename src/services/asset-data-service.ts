import type { PumaBrokerAdapter } from "@/broker/puma-broker-adapter";
import type { BrokerAsset } from "@/broker/types";
import type { PerformanceContext, AssetPerformance } from "@/modules/performance/types/performance-context.types";
import type { AssetViewModel, AssetConfigState, ConfidenceThresholds } from "@/components/asset-config/types";
import { DEFAULT_CONFIDENCE } from "@/components/asset-config/types";

interface AssetDataInput {
  brokerAdapter: PumaBrokerAdapter | null;
  brokerConnected: boolean;
  engineAssets: string[];
  performance: PerformanceContext | null;
  assetStates: Record<string, AssetConfigState>;
  confidenceThresholds: ConfidenceThresholds;
}

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
  return Math.round(Math.max(0, Math.min(100, wr * t.weightWins + ps * t.weightProfit + c * t.weightConsistency)));
}

function getConsecutiveLosses(perf: AssetPerformance | undefined): number {
  if (!perf || perf.winRate >= 50) return 0;
  return Math.min(perf.losses, Math.floor(perf.losses * (1 - perf.winRate / 100) + 1));
}

function determineStatus(
  enabled: boolean,
  quarantined: boolean,
  hasHistory: boolean,
): "active" | "inactive" | "quarantined" | "no-history" {
  if (quarantined) return "quarantined";
  if (!enabled) return "inactive";
  if (!hasHistory) return "no-history";
  return "active";
}

function getDefaultState(symbol: string, states: Record<string, AssetConfigState>): AssetConfigState {
  return states[symbol] ?? {
    enabled: true,
    quarantined: false,
    quarantineReason: "",
    quarantinedAt: null,
    reactivatedAt: null,
    confidenceOverride: null,
  };
}

function buildFromPerformance(
  perf: AssetPerformance,
  engineSymbols: Set<string>,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  const s = getDefaultState(perf.asset, states);
  const confidence = s.confidenceOverride ?? computeConfidence(perf.wins, perf.losses, perf.netProfit, perf.totalTrades, thresholds);
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

function buildFromEngine(
  symbol: string,
  performanceMap: Map<string, AssetPerformance>,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  const perf = performanceMap.get(symbol);
  if (perf) {
    const vm = buildFromPerformance(perf, new Set([symbol]), states, thresholds);
    vm.configured = true;
    return vm;
  }
  const s = getDefaultState(symbol, states);
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

function buildFromBroker(
  brokerAsset: BrokerAsset,
  engineSymbols: Set<string>,
  performanceMap: Map<string, AssetPerformance>,
  states: Record<string, AssetConfigState>,
  thresholds: ConfidenceThresholds,
): AssetViewModel {
  const perf = performanceMap.get(brokerAsset.symbol);
  if (perf) {
    const vm = buildFromPerformance(perf, engineSymbols, states, thresholds);
    vm.name = brokerAsset.name;
    vm.category = brokerAsset.category;
    vm.payout = brokerAsset.payout;
    vm.available = brokerAsset.active;
    return vm;
  }
  const s = getDefaultState(brokerAsset.symbol, states);
  return {
    symbol: brokerAsset.symbol,
    name: brokerAsset.name,
    category: brokerAsset.category,
    payout: brokerAsset.payout,
    enabled: s.enabled,
    available: brokerAsset.active,
    configured: engineSymbols.has(brokerAsset.symbol),
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

async function fetchBrokerAssets(
  adapter: PumaBrokerAdapter | null,
  connected: boolean,
): Promise<BrokerAsset[]> {
  if (!adapter || !connected) return [];
  try {
    return await adapter.getAssets();
  } catch {
    return [];
  }
}

export async function buildAssetViewModels(input: AssetDataInput): Promise<AssetViewModel[]> {
  const {
    brokerAdapter,
    brokerConnected,
    engineAssets,
    performance,
    assetStates,
    confidenceThresholds = DEFAULT_CONFIDENCE,
  } = input;

  const brokerAssets = await fetchBrokerAssets(brokerAdapter, brokerConnected);
  const engineSymbols = new Set(engineAssets);

  const performanceMap = new Map<string, AssetPerformance>();
  if (performance) {
    for (const a of performance.byAsset) {
      performanceMap.set(a.asset, a);
    }
  }

  const viewModels = new Map<string, AssetViewModel>();

  for (const perf of performance?.byAsset ?? []) {
    viewModels.set(perf.asset, buildFromPerformance(perf, engineSymbols, assetStates, confidenceThresholds));
  }

  for (const symbol of engineAssets) {
    if (!viewModels.has(symbol)) {
      viewModels.set(symbol, buildFromEngine(symbol, performanceMap, assetStates, confidenceThresholds));
    } else {
      viewModels.get(symbol)!.configured = true;
    }
  }

  for (const broker of brokerAssets) {
    if (!viewModels.has(broker.symbol)) {
      viewModels.set(broker.symbol, buildFromBroker(broker, engineSymbols, performanceMap, assetStates, confidenceThresholds));
    } else {
      const vm = viewModels.get(broker.symbol)!;
      vm.available = broker.active;
      vm.name = broker.name || vm.name;
      vm.category = broker.category || vm.category;
      vm.payout = broker.payout || vm.payout;
    }
  }

  return Array.from(viewModels.values());
}

export function getRecentTradesFromPerformance(
  performance: PerformanceContext | null,
): { asset: string; result: "WIN" | "LOSS" | "BREAKEVEN"; profit: number; timestamp: number; direction: string; score: number }[] {
  if (!performance) return [];
  return performance.recentTrades.map((t) => ({
    asset: t.asset,
    result: t.result,
    profit: t.profit,
    timestamp: t.timestamp,
    direction: t.direction,
    score: t.score,
  }));
}
