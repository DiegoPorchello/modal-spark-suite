import type { Timeframe } from "./common.types";
import type { ScoreClassification } from "./engine.types";

/**
 * Estado completo de uma análise do robô */
export interface AnalysisState {
  asset: string;
  timeframe: Timeframe;
  filters: FilterState[];
  score: number;
  classification: ScoreClassification;
  signal?: Signal;
  status: AnalysisStatus;
  lastUpdated: string;
  nextAnalysisIn: number;
}

export type AnalysisStatus =
  | "idle"
  | "analyzing"
  | "awaiting-confirmation"
  | "signal-ready"
  | "executing"
  | "completed";

/** Estado individual de um filtro na análise atual */
export interface FilterState {
  key: string;
  label: string;
  description: string;
  category: FilterCategory;
  passed: boolean;
  weight: number;
  lastChecked: string;
  details?: string;
}

export type FilterCategory =
  | "continuity"
  | "candle-strength"
  | "support-resistance"
  | "lateralization"
  | "breakout"
  | "time"
  | "volume"
  | "volatility";

/** Sinal de trading gerado pela análise */
export interface Signal {
  id: string;
  asset: string;
  direction: SignalDirection;
  strength: SignalStrength;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  expiration: string;
  score: number;
  filtersPassed: number;
  filtersTotal: number;
  generatedAt: string;
}

export type SignalDirection = "call" | "put";
export type SignalStrength = "weak" | "moderate" | "strong" | "very-strong";

/** Configuração dos filtros utilizados na análise */
export interface AnalysisConfig {
  requiredFilters: string[];
  minScore: number;
  requireConfirmation: boolean;
  confirmationCandles: number;
  maxSpread: number;
  minPayout: number;
  activeTimeStart: string;
  activeTimeEnd: string;
  allowedDays: number[];
}

/** Resultado agregado de múltiplas análises */
export interface AnalysisSummary {
  total: number;
  signalsGenerated: number;
  winRate: number;
  averageScore: number;
  byDirection: Record<SignalDirection, number>;
  recentAnalyses: AnalysisState[];
}
