/**
 * services/index.ts
 * Serviços de Orquestração (Service Layer)
 *
 * Responsabilidade: Coordenar a comunicação entre todos os submódulos.
 * Gerencia o pipeline completo: análise → score → sinal → execução.
 * Expõe uma API unificada para a camada de UI (pages/components).
 *
 * Serviços planejados:
 *   - ContinuityService: orquestra o ciclo análise → score → sinal
 *   - MarketDataService: gerencia dados de mercado em tempo real
 *   - StatePersistenceService: salva/restaura estado do robô
 *   - LoggingService: registro de eventos e erros
 *   - ConfigurationService: gerencia configurações do robô
 *
 * Integra-se com: todos os submódulos (engine, catalog, ranking,
 *                 analysis, executor, broker, calculator)
 */

export interface ContinuityService {
  // Ciclo completo de operação do robô
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  getStatus(): ServiceStatus;
}

export type ServiceStatus = "running" | "stopped" | "paused" | "error";

export interface ServiceLifecycle {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}
