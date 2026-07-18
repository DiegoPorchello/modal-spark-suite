/**
 * broker/types.ts
 * Interface abstrata IBroker — camada de abstração para múltiplas corretoras.
 * Permite trocar a corretora sem alterar a lógica do robô.
 *
 * Métodos:
 *   getCandles()    → Obter candles de um ativo
 *   getAssets()     → Listar ativos disponíveis
 *   getPayout()     → Obter payout atual de um ativo
 *   buyCall()       → Executar ordem de CALL
 *   buyPut()        → Executar ordem de PUT
 *   getResult()     → Obter resultado de uma ordem
 *   subscribePrices() → Inscrever em preços em tempo real
 */

import type { Candle } from "../market/types";

export interface IBroker {
  readonly name: string;
  readonly connected: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getCandles(asset: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getAssets(): Promise<BrokerAsset[]>;
  getPayout(asset: string): Promise<number>;

  buyCall(params: OrderParams): Promise<OrderResult>;
  buyPut(params: OrderParams): Promise<OrderResult>;
  getResult(orderId: string): Promise<OrderStatus>;

  subscribePrices(assets: string[], onPrice: (price: MarketPrice) => void): () => void;
  getBalance(): Promise<AccountBalance>;
}

export interface BrokerAsset {
  symbol: string;
  name: string;
  category: string;
  payout: number;
  active: boolean;
  minAmount: number;
  maxAmount: number;
}

export interface OrderParams {
  asset: string;
  amount: number;
  expiration: number;
  entryPrice?: number;
  timeframe: string;
  decidedAt?: number;
}

export interface OrderResult {
  orderId: string;
  status: "pending" | "accepted" | "rejected";
  message?: string;
}

export type OrderStatus = "ACTIVE" | "WIN" | "LOSS" | "DRAW" | "EXPIRED" | "CANCELED" | "UNKNOWN";

export interface MarketPrice {
  asset: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
}

export interface AccountBalance {
  balance: number;
  demoBalance: number;
  currency: string;
}
