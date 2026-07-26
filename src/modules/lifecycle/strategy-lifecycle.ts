/**
 * Strategy Lifecycle Engine
 *
 * Generic state machine for strategy lifecycle.
 * Manages transitions, timeline, and events.
 * Completely decoupled from specific Core/Profile implementations.
 */

import {
  StrategyState,
  VALID_TRANSITIONS,
  type StrategyLifecycleInstance,
  type StrategyTimelineEntry,
} from "./types/strategy-lifecycle.types";
import { LifecycleEventBus, type LifecycleEvent } from "./types/strategy-events.types";

let instanceCounter = 0;

export class StrategyLifecycleEngine {
  private instances: Map<string, StrategyLifecycleInstance> = new Map();
  private eventBus: LifecycleEventBus;

  constructor(eventBus?: LifecycleEventBus) {
    this.eventBus = eventBus ?? new LifecycleEventBus();
  }

  getEventBus(): LifecycleEventBus {
    return this.eventBus;
  }

  /**
   * Create a new lifecycle instance for a strategy.
   */
  create(params: {
    strategyId: string;
    strategyName: string;
    coreId: string;
    profileId: string;
  }): StrategyLifecycleInstance {
    const id = `lifecycle-${params.strategyId}-${Date.now()}-${++instanceCounter}`;
    const now = Date.now();

    const instance: StrategyLifecycleInstance = {
      id,
      strategyId: params.strategyId,
      strategyName: params.strategyName,
      coreId: params.coreId,
      profileId: params.profileId,
      state: StrategyState.IDLE,
      timeline: [{
        state: StrategyState.IDLE,
        time: this.formatTime(now),
        timestamp: now,
      }],
      startedAt: now,
      currentStateSince: now,
      metadata: {},
    };

    this.instances.set(id, instance);
    return instance;
  }

  /**
   * Transition an instance to a new state.
   * Returns the updated instance, or null if transition is invalid.
   */
  transition(
    instanceId: string,
    to: StrategyState,
    reason?: string,
  ): StrategyLifecycleInstance | null {
    const instance = this.instances.get(instanceId);
    if (!instance) return null;

    const validTargets = VALID_TRANSITIONS[instance.state];
    if (!validTargets.includes(to)) {
      return null; // invalid transition
    }

    const now = Date.now();
    const from = instance.state;
    const duration = now - instance.currentStateSince;

    const entry: StrategyTimelineEntry = {
      state: to,
      time: this.formatTime(now),
      timestamp: now,
      duration,
      reason,
    };

    instance.state = to;
    instance.currentStateSince = now;
    instance.timeline.push(entry);

    // Emit events
    this.eventBus.emit({
      type: "strategy.state.changed",
      strategyId: instance.strategyId,
      strategyName: instance.strategyName,
      coreId: instance.coreId,
      profileId: instance.profileId,
      from,
      to,
      timestamp: now,
      reason,
    });

    this.eventBus.emit({
      type: "strategy.timeline.updated",
      strategyId: instance.strategyId,
      entryCount: instance.timeline.length,
      currentState: to,
      durationMs: duration,
    });

    return instance;
  }

  /**
   * Get a lifecycle instance by ID.
   */
  get(instanceId: string): StrategyLifecycleInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all active instances (not in IDLE/COMPLETED/CANCELLED/LEARNING).
   */
  getActive(): StrategyLifecycleInstance[] {
    return [...this.instances.values()].filter(
      (i) =>
        i.state !== StrategyState.IDLE &&
        i.state !== StrategyState.COMPLETED &&
        i.state !== StrategyState.CANCELLED &&
        i.state !== StrategyState.LEARNING,
    );
  }

  /**
   * Get all instances for a strategy.
   */
  getByStrategy(strategyId: string): StrategyLifecycleInstance[] {
    return [...this.instances.values()].filter(
      (i) => i.strategyId === strategyId,
    );
  }

  /**
   * Get the most recent instance for a strategy.
   */
  getLatestByStrategy(strategyId: string): StrategyLifecycleInstance | undefined {
    const all = this.getByStrategy(strategyId);
    return all.length > 0 ? all[all.length - 1] : undefined;
  }

  /**
   * Get all instances.
   */
  getAll(): StrategyLifecycleInstance[] {
    return [...this.instances.values()];
  }

  /**
   * Get time spent in current state (ms).
   */
  getCurrentStateDuration(instanceId: string): number {
    const instance = this.instances.get(instanceId);
    if (!instance) return 0;
    return Date.now() - instance.currentStateSince;
  }

  /**
   * Format timestamp to HH:mm:ss.
   */
  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }
}

/** Singleton for global use */
let globalEngine: StrategyLifecycleEngine | null = null;

export function getGlobalLifecycleEngine(): StrategyLifecycleEngine {
  if (!globalEngine) {
    globalEngine = new StrategyLifecycleEngine();
  }
  return globalEngine;
}
