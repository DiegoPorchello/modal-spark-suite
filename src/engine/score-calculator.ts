/**
 * engine/score-calculator.ts
 * Calculadora de Score — pesos e classificação.
 *
 * ===========================================================================
 * SCORE        40%  Continuidade
 *              25%  Dominância
 *              15%  Força (Candle Strength)
 *              10%  Estrutura (S/R + Lateralização)
 *              10%  Histórico (Catálogo Estatístico)
 * ===========================================================================
 * CLASSIFICAÇÃO
 *   95+  EXTREMO
 *   90+  PREMIUM
 *   85+  FORTE
 *   80+  MODERADO
 *   <80  IGNORAR
 * ===========================================================================
 */

export interface ScoreInput {
  continuity: number; // 0-100
  dominance: number; // -100 a +100 (absoluto)
  candleStrength: number; // 0-100
  structure: number; // 0-100 (S/R + lateralização)
  history: number; // 0-100 (catálogo estatístico)
}

export interface ScoreResult {
  total: number;
  continuityScore: number;
  dominanceScore: number;
  strengthScore: number;
  structureScore: number;
  historyScore: number;
  classification: ScoreClassification;
}

export type ScoreClassification = "EXTREMO" | "PREMIUM" | "FORTE" | "MODERADO" | "IGNORAR";

const WEIGHTS = {
  continuity: 0.4,
  dominance: 0.25,
  strength: 0.15,
  structure: 0.1,
  history: 0.1,
} as const;

export function calculateScore(input: ScoreInput): ScoreResult {
  const continuityScore = input.continuity * WEIGHTS.continuity;
  const dominanceScore = Math.abs(input.dominance) * WEIGHTS.dominance;
  const strengthScore = input.candleStrength * WEIGHTS.strength;
  const structureScore = input.structure * WEIGHTS.structure;
  const historyScore = input.history * WEIGHTS.history;

  const total = continuityScore + dominanceScore + strengthScore + structureScore + historyScore;
  const classification = classifyScore(total);

  return {
    total: Math.round(total * 100) / 100,
    continuityScore: Math.round(continuityScore * 100) / 100,
    dominanceScore: Math.round(dominanceScore * 100) / 100,
    strengthScore: Math.round(strengthScore * 100) / 100,
    structureScore: Math.round(structureScore * 100) / 100,
    historyScore: Math.round(historyScore * 100) / 100,
    classification,
  };
}

function classifyScore(score: number): ScoreClassification {
  if (score >= 95) return "EXTREMO";
  if (score >= 90) return "PREMIUM";
  if (score >= 85) return "FORTE";
  if (score >= 80) return "MODERADO";
  return "IGNORAR";
}

export function shouldTrade(classification: ScoreClassification): boolean {
  return classification !== "IGNORAR";
}
