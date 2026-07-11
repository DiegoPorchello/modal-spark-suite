/**
 * engine/index.ts
 * Motor de Score (Score Engine)
 *
 * Responsabilidade: Calcular a pontuação do ativo com base em 5 componentes
 * (continuidade, dominância, força do candle, estrutura S/R, histórico do catálogo).
 *
 * Funções principais (a implementar):
 *   - evaluate(asset, timeframe) → ScoreResult
 *   - getScoreHistory(asset, dateRange) → ScoreHistory
 *   - updateConfig(config) → void
 *   - subscribeToUpdates() → Observable<ScoreUpdateEvent>
 *
 * Integra-se com: catalog (para histórico de padrões), analysis (para filtros)
 */

export type {
  ScoreEngineConfig,
  ScoreWeights,
  ScoreThresholds,
  ScoreResult,
  ScoreComponent,
  ScoreHistory,
} from "../types";
export type {
  EngineMode,
  ScoreClassification,
  ScoreComponentKey,
  ScoreHistoryEntry,
  ScoreUpdateEvent,
} from "../types";
