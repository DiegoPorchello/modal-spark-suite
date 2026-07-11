/**
 * broker/index.ts
 * Barrel do módulo Broker.
 * Exporta a interface IBroker e os adaptadores disponíveis.
 */

export type {
  IBroker,
  BrokerAsset,
  OrderParams,
  OrderResult,
  OrderStatus,
  MarketPrice,
  AccountBalance,
} from "./types";

export { PumaBrokerAdapter } from "./puma-broker-adapter";
export { PumaSocketClient } from "./puma-socket-client";
export type { TickData, CandleData, TradeUpdateData } from "./puma-socket-client";
export { MockBroker } from "./mock-broker";
