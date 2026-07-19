export type StrategyMode = "conservative" | "balanced" | "aggressive";

export interface StrategyProfile {
  id: string;
  name: string;
  description: string;
  mode: StrategyMode;

  thresholds: {
    minScore: number;
    minProbability: number;
    minFiltersPassed: number;
  };

  weights: {
    trend: number;
    structure: number;
    priceAction: number;
    smartMoney: number;
    momentum: number;
  };

  risk: {
    maxLevel: number;
    initialStakePercent: number;
    maxDailyLossPercent: number;
    maxConsecutiveLosses: number;
  };

  filters: {
    requireTrendAlignment: boolean;
    requireStructureConfirmation: boolean;
    requireMomentumPositive: boolean;
    requireSmartMoneyAligned: boolean;
    requireLateralizationBelow: number;
  };

  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export const DEFAULT_PROFILES: StrategyProfile[] = [
  {
    id: "conservative",
    name: "Conservador",
    description: "Filtros rigorosos, menor risco, entradas mais seletivas",
    mode: "conservative",
    thresholds: { minScore: 85, minProbability: 80, minFiltersPassed: 4 },
    weights: { trend: 25, structure: 20, priceAction: 20, smartMoney: 20, momentum: 15 },
    risk: { maxLevel: 3, initialStakePercent: 1, maxDailyLossPercent: 3, maxConsecutiveLosses: 2 },
    filters: {
      requireTrendAlignment: true,
      requireStructureConfirmation: true,
      requireMomentumPositive: true,
      requireSmartMoneyAligned: true,
      requireLateralizationBelow: 30,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "balanced",
    name: "Balanceado",
    description: "Equilíbrio entre seletividade e volume de operações",
    mode: "balanced",
    thresholds: { minScore: 75, minProbability: 70, minFiltersPassed: 3 },
    weights: { trend: 20, structure: 20, priceAction: 20, smartMoney: 20, momentum: 20 },
    risk: { maxLevel: 5, initialStakePercent: 1, maxDailyLossPercent: 5, maxConsecutiveLosses: 3 },
    filters: {
      requireTrendAlignment: true,
      requireStructureConfirmation: false,
      requireMomentumPositive: true,
      requireSmartMoneyAligned: false,
      requireLateralizationBelow: 50,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aggressive",
    name: "Agressivo",
    description: "Mais operações, filtros reduzidos, maior exposição",
    mode: "aggressive",
    thresholds: { minScore: 65, minProbability: 60, minFiltersPassed: 2 },
    weights: { trend: 15, structure: 15, priceAction: 25, smartMoney: 25, momentum: 20 },
    risk: { maxLevel: 7, initialStakePercent: 1, maxDailyLossPercent: 8, maxConsecutiveLosses: 4 },
    filters: {
      requireTrendAlignment: false,
      requireStructureConfirmation: false,
      requireMomentumPositive: false,
      requireSmartMoneyAligned: false,
      requireLateralizationBelow: 70,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
