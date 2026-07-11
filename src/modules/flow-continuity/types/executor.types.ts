import type { Timeframe } from "./common.types";

/**
 * executor.types.ts
 * Tipos do Executor de Operações — responsável por gerenciar o ciclo de vida
 * das ordens enviadas ao broker: criação, monitoramento, cancelamento
 * e registro do resultado.
 */

/** Ciclo de vida completo de uma operação */
export interface Operation {
  id: string;
  asset: string;
  direction: OperationDirection;
  entryPrice: number;
  amount: number;
  payout: number;
  payoutPercent: number;
  timeframe: Timeframe;
  level: number;
  entry: number;
  status: OperationStatus;
  result?: OperationResult;
  signalId: string;
  score: number;
  openedAt: string;
  expiresAt: string;
  closedAt?: string;
}

export type OperationDirection = "call" | "put";
export type OperationStatus =
  | "pending"
  | "executing"
  | "active"
  | "expired"
  | "canceled"
  | "completed";

export type OperationResult = "win" | "loss" | "breakeven";

/** Configuração do executor */
export interface ExecutorConfig {
  maxConcurrentOperations: number;
  maxDailyOperations: number;
  minIntervalBetweenOpsMs: number;
  autoCloseAtExpiration: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  riskPerOperation: number;
}

/** Ordem enviada ao broker */
export interface Order {
  id: string;
  operationId: string;
  brokerOrderId?: string;
  asset: string;
  direction: OperationDirection;
  amount: number;
  status: OrderStatus;
  error?: string;
  sentAt: string;
  confirmedAt?: string;
}

export type OrderStatus = "pending" | "sent" | "confirmed" | "rejected" | "timeout" | "error";

/** Evento de atualização de operação */
export interface OperationUpdateEvent {
  operationId: string;
  previousStatus: OperationStatus;
  currentStatus: OperationStatus;
  result?: OperationResult;
  profit?: number;
  timestamp: string;
}

/** Histórico agregado do executor */
export interface ExecutorHistory {
  totalOperations: number;
  wins: number;
  losses: number;
  winRate: number;
  profitLoss: number;
  currentStreak: number;
  maxStreak: number;
  operations: Operation[];
}
