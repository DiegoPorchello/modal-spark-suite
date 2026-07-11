/**
 * executor/types.ts
 * Tipos do módulo Executor.
 */

import type { OrderResult, OrderStatus } from "../broker/types";

export interface ExecutorParams {
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  expiration: number;
  entryPrice: number;
  score: number;
  classification: string;
  strategy: string;
}

export interface ExecutorResult {
  orderId: string;
  status: "executed" | "rejected" | "error";
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  expiration: number;
  entryPrice: number;
  payout: number;
  timestamp: number;
  message?: string;
  brokerResult?: OrderResult;
}

export interface ExecutionReport {
  orderId: string;
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  entryPrice: number;
  exitPrice?: number;
  result: "WIN" | "LOSS" | "DRAW" | "PENDING";
  profit: number;
  payout: number;
  score: number;
  strategy: string;
  openedAt: number;
  closedAt?: number;
}
