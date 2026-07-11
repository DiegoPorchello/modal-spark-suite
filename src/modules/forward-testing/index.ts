/**
 * forward-testing/index.ts
 * Módulo Forward Testing — entrada principal.
 *
 * Responsabilidade: Operar automaticamente em conta DEMO da Puma Broker,
 * registrar todas as operações no Supabase, gerar relatórios diários
 * e alimentar o motor de aprendizado para otimizar scores.
 *
 * Submódulos:
 *   types/       → Interfaces de sessões, operações, pattern_stats, dashboard
 *   services/    → CRUD Supabase + consultas de dashboard
 *   engine/      → Motor de Forward Testing (orquestração)
 *   hooks/       → useForwardTesting (conecta UI ao engine)
 *   components/  → Componentes de dashboard e relatórios
 *   pages/       → Páginas completas do módulo
 *
 * Fluxo:
 *   1. Usuário cria sessão (saldo inicial, estratégia, stops)
 *   2. Engine conecta à Puma Broker DEMO via bridge Python
 *   3. A cada candle: engine → analysis → score → decisão → ordem
 *   4. Resultado da ordem → registrado no Supabase (operations)
 *   5. Trigger SQL atualiza test_sessions + pattern_stats
 *   6. Pattern_stats ajusta scores futuros (aprendizado)
 *   7. Dashboard reflete em tempo real
 *   8. Relatório diário automático
 */

export type {
  TestSession,
  SessionStatus,
  CreateSessionInput,
  Operation,
  OperationResult,
  CreateOperationInput,
  UpdateOperationResultInput,
  PatternStats,
  AdjustedScore,
  DailyReport,
  AssetRanking,
  HourlyPerformance,
  BestTimeframe,
  DashboardSummary,
} from "./types";

export {
  SessionService,
  OperationService,
  PatternStatsService,
  DashboardService,
} from "./services";

export { ForwardTestingEngine, forwardTestingEngine } from "./engine";

export type { EngineState, EngineStatus, EngineCallbacks } from "./engine";

export { useForwardTesting } from "./hooks";
