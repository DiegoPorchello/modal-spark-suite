/**
 * Market Memory Module
 *
 * Records all executed operations for analytics, replay, and learning.
 * Generic — works for any Core/Profile/Strategy combination.
 */

export type {
  MarketMemoryRecord,
  MarketMemoryStats,
  OperationResult,
  MemoryRecordEvent,
} from "./types/memory-types";

export { MemoryStorage } from "./storage/memory-storage";
export { MemoryEngine, getGlobalMemoryEngine } from "./memory-engine";
