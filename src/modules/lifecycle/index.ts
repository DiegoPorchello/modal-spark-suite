/**
 * Strategy Lifecycle Module
 *
 * Generic state machine for tracking strategy lifecycle.
 * Completely decoupled from specific Core/Profile implementations.
 */

export {
  StrategyState,
  STRATEGY_STATE_INFO,
  VALID_TRANSITIONS,
} from "./types/strategy-lifecycle.types";
export type {
  StrategyTimelineEntry,
  StrategyLifecycleInstance,
  StrategyTransition,
  StrategyStateInfo,
} from "./types/strategy-lifecycle.types";

export type {
  StrategyStateChangedEvent,
  StrategyTimelineUpdatedEvent,
  LifecycleEvent,
  LifecycleEventHandler,
} from "./types/strategy-events.types";
export { LifecycleEventBus } from "./types/strategy-events.types";

export {
  StrategyLifecycleEngine,
  getGlobalLifecycleEngine,
} from "./strategy-lifecycle";
