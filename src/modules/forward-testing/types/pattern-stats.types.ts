/**
 * pattern-stats.types.ts
 * Tipos da entidade pattern_stats — estatísticas agregadas
 * que alimentam o motor de aprendizado para ajustar scores
 * baseado em assertividade real (ativos, horários, padrões).
 */

export interface PatternStats {
  id: string;
  session_id: string;

  asset: string;
  timeframe: string;
  hour: number;
  pattern_type: string;

  total_signals: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number | null;
  avg_score: number | null;
  avg_payout: number | null;
  avg_profit: number | null;
  total_profit: number | null;

  priority_weight: number;
  confidence: number | null;
  sample_size: number;

  last_signal_at: string | null;
  first_signal_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Score ajustado com base no aprendizado do motor */
export interface AdjustedScore {
  baseScore: number;
  adjustments: ScoreAdjustment[];
  finalScore: number;
}

export interface ScoreAdjustment {
  factor: string;
  multiplier: number;
  reason: string;
  confidence: number;
}
