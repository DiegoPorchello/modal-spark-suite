/**
 * ranking/index.ts
 * Ranking de Ativos (Asset Ranking)
 *
 * Responsabilidade: Classificar e ranquear ativos por pontuação composta.
 * Ordena por score, win rate, lucro/prejuízo e outros critérios configuráveis.
 * Auxilia o trader na seleção do melhor ativo para operar.
 *
 * Funções principais (a implementar):
 *   - getRanking(config, filter) → RankingEntry[]
 *   - getTopAssets(limit) → RankingEntry[]
 *   - getRankingSummary() → RankingSummary
 *   - subscribeToRankingUpdates() → Observable<RankingEntry[]>
 *
 * Integra-se com: engine (dados de score), executor (resultados de operações)
 */

export type {
  RankingEntry,
  RankingConfig,
  RankingSortField,
  RankingFilter,
  RankingSummary,
} from "../types";
