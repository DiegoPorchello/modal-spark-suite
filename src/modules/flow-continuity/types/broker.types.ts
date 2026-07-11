/**
 * broker.types.ts
 * Tipos da Integração com Broker — abstrai a comunicação com a corretora
 * (Puma Broker ou outras). Gerencia conexão, envio de ordens, saldo
 * e status da conta.
 */

/** Estado da conexão com o broker */
export interface BrokerConnection {
  status: BrokerStatus;
  server: string;
  account: BrokerAccount;
  latencyMs: number;
  connectedAt?: string;
  lastHeartbeat?: string;
}

export type BrokerStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

/** Dados da conta do trader no broker */
export interface BrokerAccount {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

export type AccountType = "real" | "demo" | "contest";

/** Configuração de conexão com o broker */
export interface BrokerConfig {
  type: BrokerProvider;
  host: string;
  port: number;
  accountId: string;
  credentials?: BrokerCredentials;
  ssl: boolean;
  timeoutMs: number;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
}

export type BrokerProvider = "puma" | "metatrader4" | "metatrader5" | "ctrader" | "custom";

/** Credenciais de acesso (nunca armazenar em texto puro) */
export interface BrokerCredentials {
  login: string;
  password: string;
  server: string;
}

/** Preço de mercado atual de um ativo */
export interface MarketPrice {
  asset: string;
  bid: number;
  ask: number;
  spread: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

/** Resposta do broker após envio de ordem */
export interface BrokerOrderResult {
  brokerOrderId: string;
  status: "accepted" | "rejected" | "pending";
  message?: string;
  executedAt?: string;
  executedPrice?: number;
}

/** Status geral de saúde da integração */
export interface BrokerHealth {
  connected: boolean;
  uptimeMs: number;
  lastError?: string;
  ordersToday: number;
  errorsToday: number;
  averageLatencyMs: number;
}
