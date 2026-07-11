/**
 * analysis/index.ts
 * Análise do Robô (Robot Analysis)
 *
 * Responsabilidade: Orquestrar o pipeline de análise — executar o motor de score,
 * aplicar filtros ativos e determinar se há sinal de entrada.
 * Cada ciclo de análise produz um veredito que pode ou não gerar um Signal.
 *
 * Funções principais (a implementar):
 *   - runAnalysis(asset, timeframe) → AnalysisState
 *   - getAnalysisState() → AnalysisState
 *   - updateFilters(filters) → void
 *   - confirmSignal(signalId) → Signal
 *   - subscribeToSignals() → Observable<Signal>
 *
 * Integra-se com: engine (consome score), catalog (consome padrões),
 *                 executor (envia sinais confirmados)
 */

export type {
  AnalysisState,
  AnalysisStatus,
  FilterState,
  FilterCategory,
  Signal,
  SignalDirection,
  SignalStrength,
  AnalysisConfig,
  AnalysisSummary,
} from "../types";
