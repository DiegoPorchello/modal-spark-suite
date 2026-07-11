/**
 * pattern-stats.service.ts
 * Serviço de consulta para pattern_stats — alimenta o motor
 * de aprendizado com dados de assertividade por cenário.
 */

import { supabase } from "@/lib/supabase";
import type { PatternStats, AdjustedScore, ScoreAdjustment } from "../types";

export const PatternStatsService = {
  async getBySession(sessionId: string): Promise<PatternStats[]> {
    const { data, error } = await supabase
      .from("pattern_stats")
      .select("*")
      .eq("session_id", sessionId)
      .order("priority_weight", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getTopPatterns(limit = 10): Promise<PatternStats[]> {
    const { data, error } = await supabase
      .from("pattern_stats")
      .select("*")
      .order("confidence", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  },

  async getBestForAsset(asset: string): Promise<PatternStats[]> {
    const { data, error } = await supabase
      .from("pattern_stats")
      .select("*")
      .eq("asset", asset)
      .gte("sample_size", 5)
      .order("win_rate", { ascending: false })
      .limit(5);

    if (error) throw error;
    return data ?? [];
  },

  async getBestHourRanges(): Promise<{ hour: number; winRate: number }[]> {
    const { data, error } = await supabase
      .from("pattern_stats")
      .select("hour, win_rate")
      .gte("sample_size", 3)
      .order("win_rate", { ascending: false });

    if (error) throw error;
    return (data ?? []).map((r: { hour: number; win_rate: number }) => ({
      hour: r.hour,
      winRate: r.win_rate,
    }));
  },

  /** Calcula ajustes de score baseado no aprendizado do motor */
  async calculateScoreAdjustments(
    asset: string,
    timeframe: string,
    hour: number,
    patternType: string,
  ): Promise<AdjustedScore> {
    const baseScore = 92; // virá do Score Engine

    const { data: stats } = await supabase
      .from("pattern_stats")
      .select("*")
      .eq("asset", asset)
      .eq("timeframe", timeframe)
      .eq("hour", hour)
      .eq("pattern_type", patternType)
      .single();

    const adjustments: ScoreAdjustment[] = [];

    if (stats && stats.sample_size >= 3) {
      const confidence = (stats.confidence ?? 50) / 100;
      const weight = stats.priority_weight ?? 1.0;

      adjustments.push({
        factor: "historical_win_rate",
        multiplier: 1 + (((stats.win_rate ?? 50) - 50) / 100) * confidence * weight,
        reason: `Histórico: ${stats.win_rate}% WR em ${stats.sample_size} ops (${
          stats.asset
        } ${stats.timeframe} ${stats.hour}h)`,
        confidence: stats.confidence ?? 50,
      });

      if (stats.win_rate && stats.win_rate > 65) {
        adjustments.push({
          factor: "high_confidence_bonus",
          multiplier: 1.05,
          reason: `Bônus por alta assertividade (${stats.win_rate}% > 65%)`,
          confidence: Math.min(stats.win_rate, 95),
        });
      }
    }

    const finalScore = Math.min(
      100,
      Math.round(adjustments.reduce((acc, adj) => acc * adj.multiplier, baseScore)),
    );

    return { baseScore, adjustments, finalScore };
  },
};
