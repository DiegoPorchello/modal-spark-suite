import type { TechnicalScore, ProbabilityScore, DecisionScore } from "./types";

export class DecisionScoreCalculator {
  calculate(
    technical: TechnicalScore,
    probability: ProbabilityScore,
    probabilityWeight: number,
  ): DecisionScore {
    const wp = Math.max(0, Math.min(1, probabilityWeight));
    const wt = 1 - wp;

    const total = Math.round(
      technical.total * wt + probability.total * wp,
    );

    return {
      total,
      technical,
      probability,
      formula: `${Math.round(wt * 100)}% * technical + ${Math.round(wp * 100)}% * probability`,
      classification: this.classify(total),
    };
  }

  private classify(score: number): string {
    if (score >= 85) return "Entrada Forte";
    if (score >= 70) return "Entrada Permitida";
    if (score >= 60) return "Mercado Observação";
    if (score >= 40) return "Mercado Fraco";
    return "Não Operar";
  }
}
