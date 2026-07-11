/**
 * types/index.ts
 * Barrel export — todos os tipos do módulo Forward Testing.
 */

export type { TestSession, SessionStatus, CreateSessionInput } from "./session.types";

export type {
  Operation,
  OperationResult,
  CreateOperationInput,
  UpdateOperationResultInput,
} from "./operation.types";

export type { PatternStats, AdjustedScore, ScoreAdjustment } from "./pattern-stats.types";

export type {
  DailyReport,
  AssetRanking,
  HourlyPerformance,
  BestTimeframe,
  DashboardSummary,
} from "./dashboard.types";
