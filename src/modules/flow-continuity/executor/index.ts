/**
 * executor/index.ts
 * Executor de Operações (Operation Executor)
 *
 * Responsabilidade: Gerenciar o ciclo de vida completo de uma operação.
 * Recebe sinais confirmados da análise, envia ordens ao broker,
 * monitora a execução e registra o resultado.
 *
 * Funções principais (a implementar):
 *   - executeSignal(signal) → Operation
 *   - cancelOperation(operationId) → void
 *   - getOperationStatus(operationId) → OperationStatus
 *   - getOperationsHistory(filter) → Operation[]
 *   - getExecutorStats() → ExecutorHistory
 *   - subscribeToOperations() → Observable<OperationUpdateEvent>
 *
 * Integra-se com: broker (envio de ordens), analysis (recebe sinais),
 *                 calculator (consulta nível Sorosgale)
 */

export type {
  Operation,
  OperationDirection,
  OperationStatus,
  OperationResult,
  ExecutorConfig,
  Order,
  OrderStatus,
  OperationUpdateEvent,
  ExecutorHistory,
} from "../types";
