/**
 * types/index.ts
 * Barrel export — re-exporta todos os tipos do módulo Fluxo de Continuidade PRO.
 * Importe apenas deste arquivo para acesso consolidado a todos os tipos.
 */

export type {
  Asset,
  AssetCategory,
  TradingSession,
  Timeframe,
  CurrencyPair,
  DateRange,
  Pagination,
  SortConfig,
  ApiResponse,
} from "./common.types";

export type {
  ScoreEngineConfig,
  ScoreWeights,
  ScoreThresholds,
  EngineMode,
  ScoreClassification,
  ScoreResult,
  ScoreComponent,
  ScoreComponentKey,
  ScoreHistory,
  ScoreHistoryEntry,
  ScoreUpdateEvent,
} from "./engine.types";

export type {
  Pattern,
  PatternType,
  PatternCategory,
  PatternStrength,
  PatternStatus,
  PatternFilter,
  PatternMatch,
  CatalogSummary,
} from "./catalog.types";

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
} from "./analysis.types";

export type {
  Operation,
  OperationDirection,
  OperationStatus,
  OperationResult,
  ExecutorConfig,
  Order,
  OrderStatus,
  OperationUpdateEvent,
  ExecutorHistory,
} from "./executor.types";

export type {
  BrokerConnection,
  BrokerStatus,
  BrokerAccount,
  AccountType,
  BrokerConfig,
  BrokerProvider,
  BrokerCredentials,
  MarketPrice,
  BrokerOrderResult,
  BrokerHealth,
} from "./broker.types";

export type {
  SorosgaleConfig,
  SorosgaleStrategy,
  SorosgaleLevel,
  LevelStatus,
  LiveLevelState,
  CalculatorSimulation,
  LevelChangeEvent,
} from "./calculator.types";

export type {
  RankingEntry,
  RankingConfig,
  RankingSortField,
  RankingFilter,
  RankingSummary,
} from "./ranking.types";
