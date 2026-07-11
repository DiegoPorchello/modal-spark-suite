/**
 * session.service.ts
 * Serviço de CRUD para test_sessions no Supabase.
 */

import { supabase } from "@/lib/supabase";
import type { TestSession, CreateSessionInput, SessionStatus } from "../types";

export const SessionService = {
  async list(): Promise<TestSession[]> {
    const { data, error } = await supabase
      .from("test_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getById(id: string): Promise<TestSession | null> {
    const { data, error } = await supabase.from("test_sessions").select("*").eq("id", id).single();

    if (error) throw error;
    return data;
  },

  async create(input: CreateSessionInput): Promise<TestSession> {
    const { data, error } = await supabase
      .from("test_sessions")
      .insert({
        name: input.name,
        description: input.description ?? null,
        initial_balance: input.initial_balance,
        strategy: input.strategy ?? "sorosgale-fractional",
        base_entry: input.base_entry ?? 2.0,
        max_level: input.max_level ?? 6,
        stop_loss: input.stop_loss ?? null,
        target_profit: input.target_profit ?? null,
        status: "running",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const updates: Partial<TestSession> = { status, updated_at: new Date().toISOString() };

    if (status === "completed" || status === "stopped") {
      updates.finished_at = new Date().toISOString();
    }

    const { error } = await supabase.from("test_sessions").update(updates).eq("id", id);

    if (error) throw error;
  },

  async updateFinalBalance(id: string, finalBalance: number): Promise<void> {
    const session = await this.getById(id);
    const initialBalance = session?.initial_balance ?? 0;
    const { error } = await supabase
      .from("test_sessions")
      .update({
        final_balance: finalBalance,
        net_profit: finalBalance - initialBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
  },

  async getActiveSessions(): Promise<TestSession[]> {
    const { data, error } = await supabase
      .from("test_sessions")
      .select("*")
      .eq("status", "running")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("test_sessions").delete().eq("id", id);

    if (error) throw error;
  },
};
