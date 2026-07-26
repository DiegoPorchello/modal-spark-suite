/**
 * Strategy Lifecycle Events
 *
 * Defines events emitted by the lifecycle engine.
 */

import type { StrategyState } from "./strategy-lifecycle.types";

export interface StrategyStateChangedEvent {
  type: "strategy.state.changed";
  strategyId: string;
  strategyName: string;
  coreId: string;
  profileId: string;
  from: StrategyState;
  to: StrategyState;
  timestamp: number;
  reason?: string;
}

export interface StrategyTimelineUpdatedEvent {
  type: "strategy.timeline.updated";
  strategyId: string;
  entryCount: number;
  currentState: StrategyState;
  durationMs: number;
}

export type LifecycleEvent =
  | StrategyStateChangedEvent
  | StrategyTimelineUpdatedEvent;

export type LifecycleEventHandler = (event: LifecycleEvent) => void;

/** FIFO 200 events max */
const MAX_EVENTS = 200;

export class LifecycleEventBus {
  private handlers: Set<LifecycleEventHandler> = new Set();
  private recent: LifecycleEvent[] = [];

  subscribe(handler: LifecycleEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  emit(event: LifecycleEvent): void {
    this.recent.push(event);
    if (this.recent.length > MAX_EVENTS) {
      this.recent = this.recent.slice(-MAX_EVENTS);
    }
    for (const h of this.handlers) {
      try { h(event); } catch { /* swallow */ }
    }
  }

  getRecent(): LifecycleEvent[] {
    return [...this.recent];
  }

  clear(): void {
    this.recent = [];
  }
}
