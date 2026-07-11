/**
 * broker/index.ts
 * Integração com Broker (Broker Gateway)
 *
 * Responsabilidade: Abstrair a comunicação com a corretora (Puma Broker, MT4/5, etc.).
 * Gerencia conexão WebSocket/TCP, envia ordens, consulta saldo e preços de mercado.
 *
 * Funções principais (a implementar):
 *   - connect(config) → BrokerConnection
 *   - disconnect() → void
 *   - getConnectionStatus() → BrokerStatus
 *   - getAccountInfo() → BrokerAccount
 *   - sendOrder(order) → BrokerOrderResult
 *   - getMarketPrice(asset) → MarketPrice
 *   - getBrokerHealth() → BrokerHealth
 *   - subscribeToPrices(assets) → Observable<MarketPrice>
 *
 * Integra-se com: executor (envio de ordens), services (orquestração geral)
 */

export type {
  BrokerConnection,
  BrokerStatus,
  BrokerAccount,
  AccountType,
  BrokerConfig,
  BrokerProvider,
  BrokerCredentials,
  MarketPrice,
  BrokerOrderResult,
  BrokerHealth,
} from "../types";
