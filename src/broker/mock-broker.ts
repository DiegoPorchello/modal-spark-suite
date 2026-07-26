/**
 * broker/mock-broker.ts
 * Broker mockado para testes — implementa IBroker com dados sintéticos.
 * Útil para desenvolvimento sem conexão com a corretora.
 */

import type { Candle } from "../market/types";
import type {
  IBroker,
  BrokerAsset,
  OrderParams,
  OrderResult,
  OrderStatus,
  MarketPrice,
  AccountBalance,
} from "./types";

export class MockBroker implements IBroker {
  readonly name = "Mock Broker";
  readonly connected = true;
  private _balance = 10000;
  private _orders: Map<string, { status: string; result: OrderStatus }> = new Map();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async getCandles(asset: string, timeframe: string, limit = 50): Promise<Candle[]> {
    return generateMockCandles(asset, limit);
  }

  async getAssets(): Promise<BrokerAsset[]> {
    return [
      {
        symbol: "EURUSD",
        name: "EUR/USD",
        category: "forex",
        payout: 0.87,
        active: true,
        minAmount: 1,
        maxAmount: 1000,
      },
      {
        symbol: "GBPUSD",
        name: "GBP/USD",
        category: "forex",
        payout: 0.85,
        active: true,
        minAmount: 1,
        maxAmount: 1000,
      },
      {
        symbol: "AUDUSD",
        name: "AUD/USD",
        category: "forex",
        payout: 0.86,
        active: true,
        minAmount: 1,
        maxAmount: 1000,
      },
    ];
  }

  async getPayout(asset: string): Promise<number> {
    return 0.86;
  }

  async buyCall(params: OrderParams): Promise<OrderResult> {
    return this._placeOrder(params, "CALL");
  }

  async buyPut(params: OrderParams): Promise<OrderResult> {
    return this._placeOrder(params, "PUT");
  }

  async getResult(orderId: string): Promise<{ status: OrderStatus; profit: number }> {
    const order = this._orders.get(orderId);
    return { status: order?.result ?? "ACTIVE", profit: 0 };
  }

  subscribePrices(assets: string[], onPrice: (price: MarketPrice) => void): () => void {
    const interval = setInterval(() => {
      for (const asset of assets) {
        onPrice({
          asset,
          bid: 1 + Math.random() * 0.1,
          ask: 1.0001 + Math.random() * 0.1,
          spread: 0.0001,
          timestamp: Date.now(),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }

  async getBalance(): Promise<AccountBalance> {
    return { balance: this._balance, demoBalance: this._balance * 10, currency: "BRL" };
  }

  private async _placeOrder(params: OrderParams, direction: string): Promise<OrderResult> {
    const orderId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const win = Math.random() > 0.3;
    this._orders.set(orderId, {
      status: "accepted",
      result: win ? "WIN" : "LOSS",
    });
    if (win) {
      this._balance += params.amount * 0.86;
    } else {
      this._balance -= params.amount;
    }
    return { orderId, status: "accepted" };
  }
}

function generateMockCandles(asset: string, limit: number): Candle[] {
  const candles: Candle[] = [];
  let price = asset.includes("USD") ? 1.05 + Math.random() * 0.1 : 50000 + Math.random() * 5000;

  for (let i = 0; i < limit; i++) {
    const variation = price * 0.001 * (Math.random() - 0.5) * 2;
    const open = price;
    const close = price + variation;
    const absMove = Math.abs(close - open);
    const body = absMove;
    const wickTop = Math.random() * absMove * 0.4;
    const wickBottom = Math.random() * absMove * 0.4;

    candles.push({
      time: Date.now() - (limit - i) * 60000,
      open: parseFloat(open.toFixed(5)),
      high: parseFloat((Math.max(open, close) + wickTop).toFixed(5)),
      low: parseFloat((Math.min(open, close) - wickBottom).toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume: Math.round(100 + Math.random() * 900),
      asset,
    });
    price = close;
  }
  return candles;
}
