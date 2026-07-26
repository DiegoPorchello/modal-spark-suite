/**
 * Strategy Lifecycle Types
 *
 * Defines the state machine for strategy lifecycle.
 * Generic — works for any Core/Profile/Strategy combination.
 */

export enum StrategyState {
  IDLE = "IDLE",
  MONITORING = "MONITORING",
  PREPARING = "PREPARING",
  READY = "READY",
  CONFIRMED = "CONFIRMED",
  EXECUTING = "EXECUTING",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  LEARNING = "LEARNING",
}

export interface StrategyTimelineEntry {
  state: StrategyState;
  time: string;         // HH:mm:ss
  timestamp: number;    // Date.now()
  duration?: number;    // ms in previous state
  reason?: string;      // why transitioned
}

export interface StrategyLifecycleInstance {
  id: string;                       // unique id
  strategyId: string;               // e.g. "trend-continuation"
  strategyName: string;             // e.g. "Trend Continuation"
  coreId: string;                   // e.g. "forex-core"
  profileId: string;                // e.g. "forex-trend"
  state: StrategyState;
  timeline: StrategyTimelineEntry[];
  startedAt: number;                // Date.now()
  currentStateSince: number;        // Date.now()
  metadata: Record<string, unknown>;
}

export interface StrategyTransition {
  from: StrategyState;
  to: StrategyState;
  reason?: string;
}

export interface StrategyStateInfo {
  state: StrategyState;
  label: string;
  color: string;          // tailwind class
  icon: string;           // lucide icon name
  description: string;
}

export const STRATEGY_STATE_INFO: Record<StrategyState, StrategyStateInfo> = {
  [StrategyState.IDLE]: {
    state: StrategyState.IDLE,
    label: "Inativo",
    color: "text-muted-foreground",
    icon: "Circle",
    description: "Estratégia inativa",
  },
  [StrategyState.MONITORING]: {
    state: StrategyState.MONITORING,
    label: "Monitorando",
    color: "text-info",
    icon: "Eye",
    description: "Mercado sendo observado",
  },
  [StrategyState.PREPARING]: {
    state: StrategyState.PREPARING,
    label: "Preparando",
    color: "text-warning",
    icon: "Loader",
    description: "Confluências sendo formadas",
  },
  [StrategyState.READY]: {
    state: StrategyState.READY,
    label: "Pronto",
    color: "text-info",
    icon: "Crosshair",
    description: "Entrada próxima",
  },
  [StrategyState.CONFIRMED]: {
    state: StrategyState.CONFIRMED,
    label: "Confirmado",
    color: "text-success",
    icon: "CheckCircle",
    description: "Todos os critérios atendidos",
  },
  [StrategyState.EXECUTING]: {
    state: StrategyState.EXECUTING,
    label: "Executando",
    color: "text-primary",
    icon: "Zap",
    description: "Ordem sendo executada",
  },
  [StrategyState.ACTIVE]: {
    state: StrategyState.ACTIVE,
    label: "Ativo",
    color: "text-success",
    icon: "Activity",
    description: "Operação em andamento",
  },
  [StrategyState.COMPLETED]: {
    state: StrategyState.COMPLETED,
    label: "Concluído",
    color: "text-success",
    icon: "Check",
    description: "Operação encerrada",
  },
  [StrategyState.CANCELLED]: {
    state: StrategyState.CANCELLED,
    label: "Cancelado",
    color: "text-danger",
    icon: "X",
    description: "Entrada cancelada",
  },
  [StrategyState.LEARNING]: {
    state: StrategyState.LEARNING,
    label: "Aprendendo",
    color: "text-primary",
    icon: "Brain",
    description: "Analisando resultado",
  },
};

/** Valid transitions: from → [to, ...] */
export const VALID_TRANSITIONS: Record<StrategyState, StrategyState[]> = {
  [StrategyState.IDLE]:       [StrategyState.MONITORING],
  [StrategyState.MONITORING]: [StrategyState.PREPARING, StrategyState.CANCELLED],
  [StrategyState.PREPARING]:  [StrategyState.READY, StrategyState.CANCELLED],
  [StrategyState.READY]:      [StrategyState.CONFIRMED, StrategyState.CANCELLED],
  [StrategyState.CONFIRMED]:  [StrategyState.EXECUTING, StrategyState.CANCELLED],
  [StrategyState.EXECUTING]:  [StrategyState.ACTIVE],
  [StrategyState.ACTIVE]:     [StrategyState.COMPLETED],
  [StrategyState.COMPLETED]:  [StrategyState.LEARNING],
  [StrategyState.CANCELLED]:  [StrategyState.IDLE],
  [StrategyState.LEARNING]:   [StrategyState.IDLE],
};
