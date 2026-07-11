/**
 * operation.service.ts
 * Serviço de CRUD para operations no Supabase.
 * Registra cada operação executada e atualiza o resultado quando recebido.
 */

import { supabase } from "@/lib/supabase";
import type {
  Operation,
  CreateOperationInput,
  UpdateOperationResultInput,
  OperationResult,
} from "../types";

export const OperationService = {
  async listBySession(sessionId: string): Promise<Operation[]> {
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .eq("session_id", sessionId)
      .order("opened_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<Operation | null> {
    const { data, error } = await supabase.from("operations").select("*").eq("id", id).single();

    if (error) throw error;
    return data;
  },

  async create(input: CreateOperationInput): Promise<Operation> {
    const { data, error } = await supabase
      .from("operations")
      .insert({
        session_id: input.session_id,
        asset: input.asset,
        direction: input.direction,
        amount: input.amount,
        entry_price: input.entry_price ?? null,
        payout: input.payout ?? null,
        level: input.level ?? 0,
        entry_number: input.entry_number ?? 1,
        score_at_moment: input.score_at_moment ?? null,
        timeframe: input.timeframe,
        broker_order_id: input.broker_order_id ?? null,
        result: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateResult(input: UpdateOperationResultInput): Promise<void> {
    const { error } = await supabase
      .from("operations")
      .update({
        result: input.result,
        exit_price: input.exit_price ?? null,
        profit: input.profit ?? null,
        broker_status: input.broker_status ?? null,
        closed_at: input.closed_at ?? new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) throw error;
  },

  async getRecent(limit = 20): Promise<Operation[]> {
    const { data, error } = await supabase
      .from("operations")
      .select("*, test_sessions!inner(name)")
      .order("opened_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async getByBrokerOrderId(brokerOrderId: string): Promise<Operation | null> {
    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .eq("broker_order_id", brokerOrderId)
      .single();

    if (error) return null;
    return data;
  },
};
