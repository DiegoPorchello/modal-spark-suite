/**
 * database/supabase-client.ts
 * Cliente de banco via Supabase — implementa DatabaseClient.
 */

import type {
  DatabaseClient,
  OperationRecord,
  SessionRecord,
  PatternStatsRecord,
  OperationFilter,
  DashboardData,
} from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseDatabaseClient implements DatabaseClient {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  async saveOperation(data: OperationRecord): Promise<void> {
    const { error } = await this.supabase.from("operations").insert([data]);
    if (error) console.error("Erro ao salvar operação:", error);
  }

  async saveSession(data: SessionRecord): Promise<void> {
    const { error } = await this.supabase.from("test_sessions").insert([data]);
    if (error) console.error("Erro ao salvar sessão:", error);
  }

  async updateSession(sessionId: string, data: Partial<SessionRecord>): Promise<void> {
    const { error } = await this.supabase.from("test_sessions").update(data).eq("id", sessionId);
    if (error) console.error("Erro ao atualizar sessão:", error);
  }

  async savePatternStats(data: PatternStatsRecord): Promise<void> {
    const { error } = await this.supabase.from("pattern_stats").insert([data]);
    if (error) console.error("Erro ao salvar pattern stats:", error);
  }

  async getOperations(filter?: OperationFilter): Promise<OperationRecord[]> {
    let query = this.supabase
      .from("operations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(filter?.limit ?? 50);

    if (filter?.asset) query = query.eq("asset", filter.asset);
    if (filter?.timeframe) query = query.eq("timeframe", filter.timeframe);
    if (filter?.result) query = query.eq("result", filter.result);
    if (filter?.offset) query = query.range(filter.offset, filter.offset + (filter.limit ?? 50));

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao buscar operações:", error);
      return [];
    }
    return data ?? [];
  }

  async getDashboard(): Promise<DashboardData> {
    try {
      const { data: session, error: sessionError } = await this.supabase
        .from("test_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: ops, error: opsError } = await this.supabase
        .from("operations")
        .select("*")
        .limit(1000);

      if (opsError) throw opsError;

      const operations = ops ?? [];
      const wins = operations.filter((o: OperationRecord) => o.result === "WIN").length;
      const losses = operations.filter((o: OperationRecord) => o.result === "LOSS").length;
      const totalTrades = operations.length;

      // Melhor ativo
      const assetGroups = new Map<string, { wins: number; total: number }>();
      for (const op of operations) {
        const g = assetGroups.get(op.asset) ?? { wins: 0, total: 0 };
        g.total++;
        if (op.result === "WIN") g.wins++;
        assetGroups.set(op.asset, g);
      }
      let bestAsset = "";
      let bestWinrate = 0;
      for (const [asset, g] of assetGroups) {
        const wr = g.total > 0 ? (g.wins / g.total) * 100 : 0;
        if (wr > bestWinrate && g.total >= 3) {
          bestWinrate = wr;
          bestAsset = asset;
        }
      }

      // Melhor timeframe
      const tfGroups = new Map<string, { wins: number; total: number }>();
      for (const op of operations) {
        const g = tfGroups.get(op.timeframe) ?? { wins: 0, total: 0 };
        g.total++;
        if (op.result === "WIN") g.wins++;
        tfGroups.set(op.timeframe, g);
      }
      let bestTimeframe = "";
      let bestTfWinrate = 0;
      for (const [tf, g] of tfGroups) {
        const wr = g.total > 0 ? (g.wins / g.total) * 100 : 0;
        if (wr > bestTfWinrate && g.total >= 3) {
          bestTfWinrate = wr;
          bestTimeframe = tf;
        }
      }

      // Melhor horário
      const hourGroups = new Map<number, { wins: number; total: number }>();
      for (const op of operations) {
        if (!op.created_at) continue;
        const hour = new Date(op.created_at).getHours();
        const g = hourGroups.get(hour) ?? { wins: 0, total: 0 };
        g.total++;
        if (op.result === "WIN") g.wins++;
        hourGroups.set(hour, g);
      }
      let bestHour = 0;
      let bestHourWinrate = 0;
      for (const [hour, g] of hourGroups) {
        const wr = g.total > 0 ? (g.wins / g.total) * 100 : 0;
        if (wr > bestHourWinrate && g.total >= 3) {
          bestHourWinrate = wr;
          bestHour = hour;
        }
      }

      return {
        totalTrades,
        wins,
        losses,
        winrate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
        netProfit: operations.reduce((s: number, o: OperationRecord) => s + (o.profit ?? 0), 0),
        bestAsset,
        bestTimeframe,
        bestHour,
        balance: session?.current_balance ?? 0,
      };
    } catch {
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
        netProfit: 0,
        bestAsset: "",
        bestTimeframe: "",
        bestHour: 0,
        balance: 0,
      };
    }
  }
}
