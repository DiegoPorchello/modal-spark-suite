/**
 * catalog/index.ts
 * Catálogo de Padrões (Pattern Catalog)
 *
 * Responsabilidade: Repositório de formações reconhecidas pelo robô.
 * Mantém o histórico de padrões catalogados, permite consulta por tipo/ativo/timeframe,
 * e alimenta o motor de score com dados de comparação.
 *
 * Funções principais (a implementar):
 *   - findPatterns(filter) → Pattern[]
 *   - getPatternById(id) → Pattern
 *   - matchCurrentMarket(asset, timeframe) → PatternMatch[]
 *   - getCatalogSummary() → CatalogSummary
 *   - addPattern(pattern) → Pattern
 *   - updatePatternStatus(id, status) → void
 *
 * Integra-se com: engine (fornece padrões para comparação de score)
 */

export type {
  Pattern,
  PatternType,
  PatternCategory,
  PatternStrength,
  PatternStatus,
  PatternFilter,
  PatternMatch,
  CatalogSummary,
} from "../types";
