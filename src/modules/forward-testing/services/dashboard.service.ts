/**
 * dashboard.service.ts
 * Serviço de consulta para as views de dashboard e relatórios.
 * Consome as SQL views criadas na migration.
 */

import { supabase } from "@/lib/supabase";
import type {
  DailyReport,
  AssetRanking,
  HourlyPerformance,
  BestTimeframe,
  DashboardSummary,
} from "../types";

export const DashboardService = {
  async getDailyReports(limit = 30): Promise<DailyReport[]> {
    const { data, error } = await supabase.from("daily_report").select("*").limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async getAssetRanking(limit = 20): Promise<AssetRanking[]> {
    const { data, error } = await supabase.from("asset_ranking").select("*").limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async getHourlyPerformance(): Promise<HourlyPerformance[]> {
    const { data, error } = await supabase
      .from("hourly_performance")
      .select("*")
      .order("hour", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async getBestTimeframes(): Promise<BestTimeframe[]> {
    const { data, error } = await supabase.from("best_timeframes").select("*").limit(10);

    if (error) throw error;
    return data ?? [];
  },

  async getSummary(): Promise<DashboardSummary> {
    const { data: sessions } = await supabase
      .from("test_sessions")
      .select("*")
      .eq("status", "running");

    const { data: today } = await supabase.from("daily_report").select("*").limit(1).single();

    const { data: topAsset } = await supabase.from("asset_ranking").select("*").limit(1).single();

    const { data: topTf } = await supabase.from("best_timeframes").select("*").limit(1).single();

    const topHour = await this.getBestHourFromStats();

    return {
      activeSessions: sessions?.length ?? 0,
      totalOperations: 0,
      globalWinRate: 0,
      totalProfit: 0,
      bestAsset: topAsset?.asset ?? null,
      bestTimeframe: topTf?.timeframe ?? null,
      bestHour: topHour ?? null,
      todayReport: today ?? null,
    };
  },

  async getDailyReportFile(): Promise<string> {
    const reports = await this.getDailyReports(1);
    const ranking = await this.getAssetRanking(5);
    const hourly = await this.getHourlyPerformance();

    const today = reports[0];
    const lines: string[] = [
      "═══════════════════════════════════════════════════",
      "  RELATÓRIO DIÁRIO - FLUXO DE CONTINUIDADE PRO",
      `  Data: ${today?.day ?? new Date().toISOString().split("T")[0]}`,
      "═══════════════════════════════════════════════════",
      "",
      "── Resumo do Dia ──",
      `  Operações:    ${today?.total_operations ?? 0}`,
      `  Wins:         ${today?.wins ?? 0}`,
      `  Losses:       ${today?.losses ?? 0}`,
      `  Win Rate:     ${today?.win_rate ?? 0}%`,
      `  Lucro Líq.:   R$ ${(today?.net_profit ?? 0).toFixed(2)}`,
      `  Score Médio:  ${today?.avg_score ?? 0}`,
      "",
      "── Ranking de Ativos (Top 5) ──",
      ...ranking.map(
        (r, i) =>
          `  ${i + 1}. ${r.asset}: ${r.win_rate}% WR (${r.total_profit > 0 ? "+" : ""}R$ ${r.total_profit.toFixed(2)})`,
      ),
      "",
      "── Performance por Horário ──",
      ...hourly
        .filter((h) => h.total_ops >= 3)
        .map(
          (h) => `  ${String(h.hour).padStart(2, "0")}h: ${h.win_rate}% WR (${h.total_ops} ops)`,
        ),
      "",
      "═══════════════════════════════════════════════════",
    ];

    return lines.join("\n");
  },

  async getBestHourFromStats(): Promise<number | null> {
    const { data } = await supabase
      .from("pattern_stats")
      .select("hour, win_rate")
      .gte("sample_size", 5)
      .order("win_rate", { ascending: false })
      .limit(1)
      .single();

    return data?.hour ?? null;
  },
};
