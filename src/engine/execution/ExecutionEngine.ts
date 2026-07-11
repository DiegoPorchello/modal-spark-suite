import type { PumaBrokerAdapter } from "../../broker/puma-broker-adapter";
import { ClockSyncService } from "./ClockSyncService";
import type { NextTrade, EntryRecord } from "./types";
import { getPrecisionColor } from "./types";
import { engineLogger } from "../logger";
import { latencyTracker } from "../latency-tracker";

export type ExecutionPhase = "idle" | "monitoring" | "decision" | "executing";

export interface ExecutionCallbacks {
  onDecisionTime?: () => Promise<void>;
  onCandleOpen?: (time: number) => void;
  onEntry?: (record: EntryRecord) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  onDelayDetected?: (reason: string) => void;
}

const CHECK_INTERVAL_MS = 50;
const DECISION_ADVANCE_MS = 200;
const MAX_LATENCY_WARN_MS = 300;

/**
 * ExecutionEngine
 *
 * Monitor de alta precisão (50ms) responsável APENAS por:
 *   - Sincronização de relógio com o servidor
 *   - Detecção de abertura de candle por timestamp (NÃO por tick)
 *   - Gerenciamento do nextTrade (pré-decisão)
 *   - Disparo de ordem na abertura exata do candle
 *   - Medição de latência (decisão → envio → confirmação)
 *   - Prevenção de atraso (>300ms)
 *
 * NENHUMA regra de estratégia, filtro ou score fica aqui.
 */
export class ExecutionEngine {
  readonly clock: ClockSyncService;
  private _broker: PumaBrokerAdapter;
  private _callbacks: ExecutionCallbacks | null = null;
  private _checkTimer: ReturnType<typeof setInterval> | null = null;

  private _phase: ExecutionPhase = "idle";
  private _nextTrade: NextTrade | null = null;
  private _lastCandleTime = 0;
  private _decisionTriggered = false;

  private _records: EntryRecord[] = [];
  private _maxRecords = 200;

  constructor(broker: PumaBrokerAdapter) {
    this._broker = broker;
    this.clock = new ClockSyncService();
  }

  get phase(): ExecutionPhase {
    return this._phase;
  }

  get nextTrade(): NextTrade | null {
    return this._nextTrade;
  }

  get records(): EntryRecord[] {
    return [...this._records];
  }

  get lastEntryPrecision(): number {
    if (this._records.length === 0) return 0;
    return this._records[this._records.length - 1].totalLatency;
  }

  get averageEntryPrecision(): number {
    if (this._records.length === 0) return 0;
    const sum = this._records.reduce((a, r) => a + r.totalLatency, 0);
    return sum / this._records.length;
  }

  get bestEntryPrecision(): number {
    if (this._records.length === 0) return 0;
    return Math.min(...this._records.map((r) => r.totalLatency));
  }

  get worstEntryPrecision(): number {
    if (this._records.length === 0) return 0;
    return Math.max(...this._records.map((r) => r.totalLatency));
  }

  get totalEntries(): number {
    return this._records.length;
  }

  /** Registra uma amostra de clock vinda de heartbeat do servidor */
  recordServerTime(serverTime: number): void {
    this.clock.record(serverTime);
  }

  /** Define a próxima trade a ser executada na abertura do candle */
  setNextTrade(trade: NextTrade): void {
    this._nextTrade = trade;
    engineLogger.info("ExecutionEngine", `NextTrade definido: ${trade.symbol} ${trade.direction} score=${trade.score}`, {
      symbol: trade.symbol,
      direction: trade.direction,
      score: trade.score,
      decidedAt: new Date(trade.decidedAt).toISOString(),
    });
  }

  /** Limpa a próxima trade (após execução ou cancelamento) */
  clearNextTrade(): void {
    this._nextTrade = null;
  }

  /** Registra callbacks */
  setCallbacks(cb: ExecutionCallbacks): void {
    this._callbacks = cb;
  }

  /** Inicia o monitor de alta precisão */
  start(): void {
    if (this._checkTimer) return;
    this._phase = "monitoring";
    this._lastCandleTime = this.clock.currentCandleTime;
    this._callbacks?.onPhaseChange?.(this._phase);

    engineLogger.info("ExecutionEngine", "═══ INICIANDO MONITOR DE ALTA PRECISÃO (50ms) ═══", {});

    this._checkTimer = setInterval(() => this._tick(), CHECK_INTERVAL_MS);
  }

  /** Para o monitor */
  stop(): void {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
    this._phase = "idle";
    this._nextTrade = null;
    this._decisionTriggered = false;
    this._callbacks?.onPhaseChange?.(this._phase);
  }

  private _tick(): void {
    const now = this.clock.now;
    const currentCandle = Math.floor(now / 60000) * 60000;
    const msToNext = Math.max(0, (currentCandle + 60000) - now);

    // ── DETECÇÃO DE ABERTURA DE CANDLE ──
    if (currentCandle > this._lastCandleTime) {
      this._lastCandleTime = currentCandle;
      this._decisionTriggered = false;
      this._onCandleOpen(currentCandle);
      return;
    }

    // ── JANELA DE DECISÃO (200ms antes do fechamento) ──
    if (msToNext <= DECISION_ADVANCE_MS && msToNext > 0 && !this._decisionTriggered && !this._nextTrade) {
      this._decisionTriggered = true;
      this._phase = "decision";
      this._callbacks?.onPhaseChange?.(this._phase);
      try {
        const result = this._callbacks?.onDecisionTime?.();
        if (result instanceof Promise) {
          result.catch((err) => {
            engineLogger.error("ExecutionEngine", "onDecisionTime rejeitou", {
              error: String(err),
            });
          });
        }
      } catch (err) {
        engineLogger.error("ExecutionEngine", "onDecisionTime lançou exceção síncrona", {
          error: String(err),
        });
      }
    }
  }

  private async _onCandleOpen(candleTime: number): Promise<void> {
    if (this._phase === "executing") return;
    this._phase = "executing";
    this._callbacks?.onPhaseChange?.(this._phase);
    this._callbacks?.onCandleOpen?.(candleTime);

    const trade = this._nextTrade;
    if (!trade?.valid) {
      engineLogger.info("ExecutionEngine", `Candle aberto ${new Date(candleTime).toISOString()} — sem nextTrade`, {});
      this._phase = "monitoring";
      this._callbacks?.onPhaseChange?.(this._phase);
      return;
    }

    const decisionTime = trade.decidedAt;
    const sendTime = Date.now();
    latencyTracker.mark("candle_open", "Candle Open", { candleTime: new Date(candleTime).toISOString() });

    engineLogger.info("ExecutionEngine", `═══ EXECUTANDO ORDEM NA ABERTURA ═══`, {
      symbol: trade.symbol,
      direction: trade.direction,
      candleOpen: new Date(candleTime).toISOString(),
      decisionDelay: sendTime - decisionTime,
      amount: trade.amount,
      score: trade.score,
    });

    // Medir latência de decisão
    const decisionDelay = sendTime - decisionTime;

    try {
      const orderParams = {
        asset: trade.symbol,
        amount: trade.amount,
        expiration: trade.expiration,
        entryPrice: trade.entryPrice,
        timeframe: trade.timeframe,
      };

      latencyTracker.mark("order_sent_proxy", "Order Sent to Proxy", { symbol: trade.symbol, direction: trade.direction });
      const orderResult = trade.direction === "call"
        ? await this._broker.buyCall(orderParams)
        : await this._broker.buyPut(orderParams);
      latencyTracker.mark("proxy_responded", "Proxy Responded", { orderId: orderResult.orderId });

      const confirmationTime = Date.now();
      latencyTracker.mark("trade_opened", "Trade Opened", { orderId: orderResult.orderId });
      const executionDelay = confirmationTime - sendTime;
      const totalLatency = confirmationTime - candleTime;

      const record: EntryRecord = {
        tradeId: orderResult.orderId,
        symbol: trade.symbol,
        timeframe: trade.timeframe,
        candleOpenTime: candleTime,
        decisionTime,
        sendTime,
        confirmationTime,
        decisionDelay,
        executionDelay,
        brokerDelay: executionDelay,
        totalLatency,
        result: "DRAW",
      };

      this._records.push(record);
      if (this._records.length > this._maxRecords) {
        this._records.shift();
      }

      engineLogger.info("ExecutionEngine", `═══ ORDEM EXECUTADA ═══`, {
        tradeId: record.tradeId,
        totalLatency: `${totalLatency}ms`,
        decisionDelay: `${decisionDelay}ms`,
        executionDelay: `${executionDelay}ms`,
        color: getPrecisionColor(totalLatency),
      });

      // Detectar atraso
      if (totalLatency > MAX_LATENCY_WARN_MS) {
        this._callbacks?.onDelayDetected?.(
          `ENTRY DELAY DETECTED: ${totalLatency}ms (symbol=${trade.symbol}, decisionDelay=${decisionDelay}ms, executionDelay=${executionDelay}ms)`
        );
      }

      this._callbacks?.onEntry?.(record);
      this._nextTrade = null;
    } catch (err) {
      engineLogger.error("ExecutionEngine", "Falha ao executar ordem na abertura", {
        error: String(err),
        symbol: trade.symbol,
      });
    }

    this._phase = "monitoring";
    this._callbacks?.onPhaseChange?.(this._phase);
  }
}
