/**
 * database/index.ts
 * Barrel do módulo Database.
 */

export type {
  DatabaseClient,
  OperationRecord,
  SessionRecord,
  PatternStatsRecord,
  OperationFilter,
  DashboardData,
} from "./types";
export { SupabaseDatabaseClient } from "./supabase-client";
export { LocalDatabaseClient } from "./local-database";
