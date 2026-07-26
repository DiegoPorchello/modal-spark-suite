export type AssetCategory = "forex-major" | "forex-minor" | "forex-exotic" | "crypto" | "commodity" | "index" | "stock";

export type AssetDataSource = "broker" | "engine" | "performance";

export type AssetStatus = "active" | "inactive" | "quarantined" | "no-history";

export interface AssetViewModel {
  symbol: string;
  name: string;
  category: string;
  payout: number;
  enabled: boolean;
  available: boolean;
  configured: boolean;
  hasHistory: boolean;
  status: AssetStatus;
  confidence: number;
  winRate: number;
  profit: number;
  wins: number;
  losses: number;
  operations: number;
  consecutiveLosses: number;
  lastOperation: number | null;
  quarantineReason: string;
  quarantineDate: number | null;
  averageScore: number;
  source: AssetDataSource;
}

export interface AssetConfigState {
  enabled: boolean;
  quarantined: boolean;
  quarantineReason: string;
  quarantinedAt: number | null;
  reactivatedAt: number | null;
  confidenceOverride: number | null;
}

export interface QuarantineThresholds {
  minWinRate: number;
  maxConsecutiveLosses: number;
  minConfidence: number;
  autoQuarantineEnabled: boolean;
  reactivationWinRate: number;
  reactivationMinConfidence: number;
  reactivationCooldownMinutes: number;
}

export interface ConfidenceThresholds {
  minConfidence: number;
  highConfidence: number;
  criticalConfidence: number;
  weightWins: number;
  weightProfit: number;
  weightConsistency: number;
}

export const DEFAULT_QUARANTINE: QuarantineThresholds = {
  minWinRate: 40,
  maxConsecutiveLosses: 5,
  minConfidence: 30,
  autoQuarantineEnabled: true,
  reactivationWinRate: 50,
  reactivationMinConfidence: 40,
  reactivationCooldownMinutes: 60,
};

export const DEFAULT_CONFIDENCE: ConfidenceThresholds = {
  minConfidence: 20,
  highConfidence: 60,
  criticalConfidence: 80,
  weightWins: 0.4,
  weightProfit: 0.35,
  weightConsistency: 0.25,
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  "forex-major": "Forex Major",
  "forex-minor": "Forex Minor",
  "forex-exotic": "Forex Exotic",
  "crypto": "Crypto",
  "commodity": "Commodities",
  "index": "Índices",
  "stock": "Ações",
};

export const ALL_CATEGORIES: AssetCategory[] = [
  "forex-major",
  "forex-minor",
  "forex-exotic",
  "crypto",
  "commodity",
  "index",
  "stock",
];
