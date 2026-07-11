/**
 * hooks/index.ts
 * Custom Hooks do Fluxo de Continuidade PRO
 *
 * Responsabilidade: Encapsular lógica de estado e efeitos colaterais
 * para serem consumidos pelos componentes React. Seguem a convenção
 * use[Recurso]() → retorna estado + ações.
 *
 * Hooks planejados:
 *   - useContinuityEngine(): conecta ao motor de score
 *   - useAnalysisRunner(): executa ciclo de análise
 *   - useOperationExecutor(): gerencia operações ao vivo
 *   - useBrokerConnection(): monitora conexão com broker
 *   - useSorosgaleCalculator(): calculadora Sorosgale reativa
 *   - useAssetRanking(): ranking de ativos com filtros
 *   - usePatternCatalog(): consulta ao catálogo de padrões
 *   - useContinuityState(): estado global do módulo
 *
 * Cada hook deve usar os serviços em services/ para operações
 * e retornar tuplas ou objetos com [state, actions].
 */

export type {};
