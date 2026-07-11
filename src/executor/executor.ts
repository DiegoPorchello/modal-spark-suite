/**
 * executor/executor.ts
 * Executor desacoplado — recebe parâmetros, executa ordem, retorna resultado.
 *
 * Responsabilidades:
 * - Conectar com broker via IBroker
 * - Executar CALL ou PUT
 * - Aguardar resultado (WIN/LOSS)
 * - Retornar ExecutionReport completo
 *
 * Não gerencia níveis, stake ou cálculo — apenas execução.
 */

import type { IBroker } from "../broker/types";
import type { ExecutorParams, ExecutorResult, ExecutionReport } from "./types";
import { engineLogger } from "../engine/logger";

export class Executor {
  private broker: IBroker;
  private activeOrders: Map<string, { params: ExecutorParams; startTime: number }> = new Map();
  private results: ExecutionReport[] = [];
  private readonly maxResults = 100;

  constructor(broker: IBroker) {
    this.broker = broker;
  }

  async execute(params: ExecutorParams): Promise<ExecutorResult> {
    try {
      const payout = await this.broker.getPayout(params.asset);

      const orderResult =
        params.direction === "CALL"
          ? await this.broker.buyCall({
              asset: params.asset,
              amount: params.amount,
              expiration: params.expiration,
              entryPrice: params.entryPrice,
              timeframe: "M1",
            })
          : await this.broker.buyPut({
              asset: params.asset,
              amount: params.amount,
              expiration: params.expiration,
              entryPrice: params.entryPrice,
              timeframe: "M1",
            });

      if (orderResult.status === "rejected") {
        return {
          orderId: orderResult.orderId,
          status: "rejected",
          asset: params.asset,
          direction: params.direction,
          amount: params.amount,
          expiration: params.expiration,
          entryPrice: params.entryPrice,
          payout,
          timestamp: Date.now(),
          message: orderResult.message ?? "Ordem rejeitada",
          brokerResult: orderResult,
        };
      }

      this.activeOrders.set(orderResult.orderId, { params, startTime: Date.now() });

      return {
        orderId: orderResult.orderId,
        status: "executed",
        asset: params.asset,
        direction: params.direction,
        amount: params.amount,
        expiration: params.expiration,
        entryPrice: params.entryPrice,
        payout,
        timestamp: Date.now(),
        brokerResult: orderResult,
      };
    } catch (error) {
      return {
        orderId: `error_${Date.now()}`,
        status: "error",
        asset: params.asset,
        direction: params.direction,
        amount: params.amount,
        expiration: params.expiration,
        entryPrice: params.entryPrice,
        payout: 0,
        timestamp: Date.now(),
        message: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  async checkResult(orderId: string): Promise<ExecutionReport | null> {
    const active = this.activeOrders.get(orderId);
    if (!active) {
      return this.results.find((r) => r.orderId === orderId) ?? null;
    }

    try {
      const brokerStatus = await this.broker.getResult(orderId);

      if (brokerStatus === "ACTIVE") {
        return null;
      }

      const payout = await this.broker.getPayout(active.params.asset);
      const isWin = brokerStatus === "WIN";
      const isLoss = brokerStatus === "LOSS";
      const profit = isWin ? active.params.amount * payout : isLoss ? -active.params.amount : 0;

      const report: ExecutionReport = {
        orderId,
        asset: active.params.asset,
        direction: active.params.direction,
        amount: active.params.amount,
        entryPrice: active.params.entryPrice,
        result: isWin ? "WIN" : isLoss ? "LOSS" : "DRAW",
        profit,
        payout,
        score: active.params.score,
        strategy: active.params.strategy,
        openedAt: active.startTime,
        closedAt: Date.now(),
      };

      this.activeOrders.delete(orderId);
      this.results.push(report);
      if (this.results.length > this.maxResults) {
        this.results = this.results.slice(-this.maxResults);
      }

      return report;
    } catch (err) {
      engineLogger.error("Executor", "Falha ao consultar resultado da ordem", {
        orderId,
        error: String(err),
      });
      return null;
    }
  }

  getActiveOrders(): string[] {
    return Array.from(this.activeOrders.keys());
  }

  getRecentResults(count = 20): ExecutionReport[] {
    return this.results.slice(-count);
  }

  getStats(): { totalOrders: number; wins: number; losses: number; winrate: number } {
    const totalOrders = this.results.length;
    const wins = this.results.filter((r) => r.result === "WIN").length;
    const losses = this.results.filter((r) => r.result === "LOSS").length;
    return {
      totalOrders,
      wins,
      losses,
      winrate: totalOrders > 0 ? (wins / totalOrders) * 100 : 0,
    };
  }

  clear(): void {
    this.activeOrders.clear();
    this.results = [];
  }
}
