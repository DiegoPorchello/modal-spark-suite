import type { Timeframe } from "./common.types";

/**
 * engine.types.ts
 * Tipos do Motor de Score — coração da análise do robô.
 * Responsável por calcular pontuações com base em múltiplos indicadores
 * (continuidade, dominância, força do candle, estrutura S/R, histórico).
 */

/** Configuração global do motor de score */
export interface ScoreEngineConfig {
  weights: ScoreWeights;
  thresholds: ScoreThresholds;
  mode: EngineMode;
  refreshIntervalMs: number;
}

/** Pesos de cada componente no score final (soma deve ser 100) */
export interface ScoreWeights {
  continuity: number;
  dominance: number;
  candleStrength: number;
  supportResistance: number;
  catalogHistory: number;
}

/** Limiares para classificação do score */
export interface ScoreThresholds {
  premium: number;
  high: number;
  medium: number;
  low: number;
}

export type EngineMode = "real-time" | "backtest" | "simulation";
export type ScoreClassification = "premium" | "high" | "medium" | "low";

/** Resultado completo de uma avaliação do motor */
export interface ScoreResult {
  asset: string;
  timeframe: Timeframe;
  finalScore: number;
  classification: ScoreClassification;
  components: ScoreComponent[];
  timestamp: string;
  engineMode: EngineMode;
}

/** Componente individual do score */
export interface ScoreComponent {
  label: string;
  key: ScoreComponentKey;
  value: number;
  maxValue: number;
  percentage: number;
  status: "passed" | "failed" | "neutral";
}

export type ScoreComponentKey =
  | "continuity"
  | "dominance"
  | "candle-strength"
  | "support-resistance"
  | "catalog-history";

/** Histórico de evolução do score ao longo do tempo */
export interface ScoreHistory {
  asset: string;
  entries: ScoreHistoryEntry[];
}

export interface ScoreHistoryEntry {
  score: number;
  classification: ScoreClassification;
  timestamp: string;
}

/** Evento emitido quando o score é atualizado */
export interface ScoreUpdateEvent {
  previousScore: number;
  currentScore: number;
  delta: number;
  classification: ScoreClassification;
  timestamp: string;
}
