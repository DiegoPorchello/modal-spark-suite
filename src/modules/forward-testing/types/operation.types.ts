/**
 * operation.types.ts
 * Tipos da entidade operations — registro individual
 * de cada operação executada pelo robô na conta DEMO.
 */

export interface Operation {
  id: string;
  session_id: string;

  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  entry_price: number | null;
  exit_price: number | null;
  payout: number | null;
  profit: number | null;
  result: OperationResult;

  level: number;
  entry_number: 1 | 2;

  score_at_moment: number | null;
  score_classification: string | null;
  filters_passed: number | null;
  filters_total: number | null;

  timeframe: string;
  broker_order_id: string | null;
  broker_status: string | null;
  signal_id: string | null;

  opened_at: string;
  expired_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export type OperationResult = "win" | "loss" | "draw" | "pending";

export interface CreateOperationInput {
  session_id: string;
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  entry_price?: number;
  payout?: number;
  level?: number;
  entry_number?: 1 | 2;
  score_at_moment?: number;
  timeframe: string;
  broker_order_id?: string;
}

export interface UpdateOperationResultInput {
  id: string;
  result: OperationResult;
  exit_price?: number | null;
  profit?: number;
  broker_status?: string;
  closed_at?: string;
}
