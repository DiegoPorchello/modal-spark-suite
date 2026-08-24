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
  onEntryError?: (error: string, trade: NextTrade) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  onDelayDetected?: (reason: string) => void;
}

const CHECK_INTERVAL_MS = 50;
// Janela de decisão ANTES do fechamento da vela. Precisa cobrir o custo de
// getCandles + análise (~centenas de ms via daemon): se a decisão terminar
// depois da abertura, o nextTrade nasce tarde e a vela passa sem entrada.
const DECISION_ADVANCE_MS = 1500;
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
  private _statsLogCounter = 0;
  private _pendingOrderCount = 0;

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
    engineLogger.info(
      "ExecutionEngine",
      `NextTrade definido: ${trade.symbol} ${trade.direction} score=${trade.score} traceId=${trade.traceId}`,
      {
        traceId: trade.traceId,
        symbol: trade.symbol,
        direction: trade.direction,
        score: trade.score,
        decidedAt: new Date(trade.decidedAt).toISOString(),
        signalCandleTime: new Date(trade.signalCandleTime).toISOString(),
      },
    );
    console.log(
      `[TIMING] SET_NEXT_TRADE traceId=${trade.traceId} asset=${trade.symbol} dir=${trade.direction} signalCandle=${trade.signalCandleTime} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`,
    );
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
    const msToNext = Math.max(0, currentCandle + 60000 - now);
    const tsDate = Date.now();
    const tsPerf = performance.now();

    // ── LOGGING COMPLETO ──
    console.log(
      `[TICK]now=${now} nextDecision=${this._nextTrade?.decidedAt ?? "null"} msToNext=${msToNext} status=${this._phase} decisionTriggered=${this._decisionTriggered} nextTrade=${!!this._nextTrade} activeOperation=${!!this._nextTrade?.valid} traceId=${this._nextTrade?.traceId ?? "none"} tsDate=${tsDate} tsPerf=${tsPerf.toFixed(2)}`,
    );

    // ── DETECÇÃO DE ABERTURA DE CANDLE ──
    if (currentCandle > this._lastCandleTime) {
      this._lastCandleTime = currentCandle;
      this._decisionTriggered = false;
      console.log(
        `[TIMING] CANDLE_OPEN_DETECTED candleTime=${currentCandle} msToNext=${msToNext} traceId=${this._nextTrade?.traceId ?? "none"} pendingOrders=${this._pendingOrderCount} tsDate=${tsDate} tsPerf=${tsPerf.toFixed(2)}`,
      );
      this._onCandleOpen(currentCandle);
      console.log(`[TICK RESULT]motivo=CALL_ON_DECISION`);
      return;
    }

    // ── JANELA DE DECISÃO (200ms antes do fechamento) ──
    const msToNextTooHigh = msToNext > DECISION_ADVANCE_MS;
    const msToNextNegative = msToNext <= 0;
    const decisionAlreadyTriggered = this._decisionTriggered;
    const nextTradeExists = !!this._nextTrade;
    const activeOperation = !!this._nextTrade?.valid;

    // Determina o motivo da saída
    let reason = "";
    if (msToNextTooHigh) {
      reason = "MS_TO_NEXT_TOO_HIGH";
    } else if (msToNextNegative) {
      reason = "MS_TO_NEXT_NEGATIVE";
    } else if (decisionAlreadyTriggered) {
      reason = "DECISION_ALREADY_TRIGGERED";
    } else if (nextTradeExists) {
      reason = "NEXT_TRADE_EXISTS";
    } else if (activeOperation) {
      reason = "ACTIVE_OPERATION";
    }

    if (reason) {
      console.log(`[TICK RESULT]motivo=${reason}`);
      return;
    }

    // Checagem explícita da condição
    if (
      msToNext <= DECISION_ADVANCE_MS &&
      msToNext > 0 &&
      !this._decisionTriggered &&
      !this._nextTrade
    ) {
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
      console.log(`[TICK RESULT]motivo=CALL_ON_DECISION`);
    } else {
      console.log(`[TICK RESULT]motivo=CONDITION_NOT_MET`);
    }
  }

  private async _onCandleOpen(candleTime: number): Promise<void> {
    if (this._phase === "executing") return;
    this._phase = "executing";
    this._callbacks?.onPhaseChange?.(this._phase);
    this._callbacks?.onCandleOpen?.(candleTime);

    const trade = this._nextTrade;
    if (!trade?.valid) {
      engineLogger.info(
        "ExecutionEngine",
        `Candle aberto ${new Date(candleTime).toISOString()} — sem nextTrade`,
        {},
      );
      this._phase = "monitoring";
      this._callbacks?.onPhaseChange?.(this._phase);
      return;
    }

    this._pendingOrderCount++;
    const t0 = performance.now();
    const tsDateNow = Date.now();
    const tsClockNow = this.clock.now;
    const tsPerfNow = t0;

    console.log(`[AUDIT] [CANDLE_OPEN] symbol=${trade.symbol} candleTime=${new Date(candleTime).toISOString()} local=${new Date().toISOString()} perf=${t0}`);
    console.log(`[AUDIT] [EXECUTION_START] symbol=${trade.symbol} perf=${t0}`);
    console.log(
      `[TIMING] EXECUTION_START traceId=${trade.traceId} asset=${trade.symbol} candleTime=${candleTime} signalCandleTime=${trade.signalCandleTime} tsDate=${tsDateNow} tsClock=${tsClockNow} tsPerf=${tsPerfNow.toFixed(2)} queueLen=${this._pendingOrderCount}`
    );

    const decisionTime = trade.decidedAt;
    const sendTime = Date.now();
    latencyTracker.mark("candle_open", "Candle Open", {
      candleTime: new Date(candleTime).toISOString(),
    });

    engineLogger.info("ExecutionEngine", `═══ EXECUTANDO ORDEM NA ABERTURA ═══`, {
      traceId: trade.traceId,
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
        decidedAt: trade.decidedAt,
        traceId: trade.traceId,
        signalCandleTime: trade.signalCandleTime,
        signalCandleOpen: trade.signalCandleOpen,
        signalCandleClose: trade.signalCandleClose,
        candleId: trade.candleId,
        durationReceived: trade.expiration,
      };

      console.log("[EXECUTION]", {
        traceId: trade.traceId,
        asset: trade.symbol,
        direction: trade.direction,
        amount: trade.amount,
        expiration: trade.expiration,
        entryPrice: trade.entryPrice,
        timeframe: trade.timeframe,
        candleOpen: new Date(candleTime).toISOString(),
        decisionDelay,
        signalCandleTime: trade.signalCandleTime,
        candleId: trade.candleId,
      });
      engineLogger.info("ExecutionEngine", "[AMOUNT TRACE] nextTrade → orderParams", {
        traceId: trade.traceId,
        amount: trade.amount,
        direction: trade.direction,
        symbol: trade.symbol,
      });

      console.log(
        `[TIMING] BEFORE_BROKER traceId=${trade.traceId} asset=${trade.symbol} dir=${trade.direction} duration=${trade.expiration} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`
      );
      latencyTracker.mark("order_sent_proxy", "Order Sent to Proxy", {
        symbol: trade.symbol,
        direction: trade.direction,
      });
      const orderResult =
        trade.direction === "call"
          ? await this._broker.buyCall(orderParams)
          : await this._broker.buyPut(orderParams);
      latencyTracker.mark("proxy_responded", "Proxy Responded", { orderId: orderResult.orderId });

      const confirmationTime = Date.now();
      this._pendingOrderCount = Math.max(0, this._pendingOrderCount - 1);
      latencyTracker.mark("trade_opened", "Trade Opened", { orderId: orderResult.orderId });
      const executionDelay = confirmationTime - sendTime;
      const totalLatency = confirmationTime - candleTime;

      console.log(
        `[TIMING] AFTER_BROKER traceId=${trade.traceId} orderId=${orderResult.orderId} executionMs=${executionDelay} totalMs=${totalLatency} pendingOrders=${this._pendingOrderCount} tsDate=${confirmationTime} tsPerf=${performance.now().toFixed(2)}`
      );

      const record: EntryRecord = {
        traceId: trade.traceId,
        tradeId: orderResult.orderId,
        decisionId: trade.decisionId,
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
        signalCandleTime: trade.signalCandleTime,
        signalCandleOpen: trade.signalCandleOpen,
        signalCandleClose: trade.signalCandleClose,
        expectedEntryCandle: trade.signalCandleTime + 60000,
        actualEntryTime: sendTime,
        expectedExpiration: trade.signalCandleTime + 60000 + trade.expiration * 1000,
        actualExpiration: "",
        candleId: trade.candleId,
        durationReceived: trade.expiration,
        durationPropagated: trade.expiration,
        durationEffective: trade.expiration,
        tsDateNow,
        tsClockNow,
        tsPerfNow,
      };

      this._records.push(record);
      if (this._records.length > this._maxRecords) {
        this._records.shift();
      }
      this._logLatencyStats();

      const decisionCandle = Math.floor(trade.decidedAt / 60000) * 60000;
      const expectedExecutionCandle = decisionCandle + 60000;
      const actualExecutionCandle = candleTime;
      const sameCandle = expectedExecutionCandle === actualExecutionCandle;
      const candleOpenTimeStr = new Date(candleTime).toISOString();
      const sendTimeStr = new Date(sendTime).toISOString();

      console.log("[ORDER CREATED]", {
        traceId: trade.traceId,
        decisionId: trade.decisionId,
        tradeId: record.tradeId,
        decidedAt: trade.decidedAt,
        symbol: trade.symbol,
        amount: trade.amount,
        direction: trade.direction,
        level: (trade as any).level,
        entry: (trade as any).entry,
        totalLatency: `${totalLatency}ms`,
      });
      console.log("[DECISION EXECUTED]", {
        traceId: trade.traceId,
        decisionId: trade.decisionId,
        tradeId: record.tradeId,
        direction: trade.direction,
        amount: trade.amount,
        decidedAt: new Date(trade.decidedAt).toISOString(),
        expectedExecutionCandle: new Date(expectedExecutionCandle).toISOString(),
        actualExecutionCandle: new Date(actualExecutionCandle).toISOString(),
        sameCandle,
        expectedOpen: candleOpenTimeStr,
        actualOpen: sendTimeStr,
        clockDrift: `${sendTime - candleTime}ms`,
        decisionAge: `${decisionDelay}ms`,
        brokerLatency: `${executionDelay}ms`,
        totalLatency: `${totalLatency}ms`,
      });

      console.log(
        `[TIMING] ENTRY_RECORD traceId=${trade.traceId} tradeId=${record.tradeId} signalCandle=${trade.signalCandleTime} expectedEntry=${record.expectedEntryCandle} actualEntry=${record.actualEntryTime} expectedExp=${record.expectedExpiration} durationReceived=${trade.expiration} durationPropagated=${trade.expiration} durationEffective=${trade.expiration} sameCandle=${sameCandle} totalMs=${totalLatency}`
      );
      engineLogger.info("ExecutionEngine", `═══ ORDEM EXECUTADA ═══`, {
        traceId: trade.traceId,
        decisionId: trade.decisionId,
        tradeId: record.tradeId,
        totalLatency: `${totalLatency}ms`,
        decisionDelay: `${decisionDelay}ms`,
        executionDelay: `${executionDelay}ms`,
        color: getPrecisionColor(totalLatency),
      });

      // Detectar atraso
      if (totalLatency > MAX_LATENCY_WARN_MS) {
        this._callbacks?.onDelayDetected?.(
          `ENTRY DELAY DETECTED: ${totalLatency}ms (symbol=${trade.symbol}, decisionDelay=${decisionDelay}ms, executionDelay=${executionDelay}ms)`,
        );
      }

      this._callbacks?.onEntry?.(record);
      this._nextTrade = null;
    } catch (err) {
      this._pendingOrderCount = Math.max(0, this._pendingOrderCount - 1);
      // Limpa a ordem pendente: se reenviássemos no próximo tick após uma
      // falha de rede ambígua (ex.: timeout pós-envio), criaríamos duplicata.
      this._nextTrade = null;
      engineLogger.error("ExecutionEngine", "Falha ao executar ordem na abertura", {
        error: String(err),
        symbol: trade.symbol,
        traceId: trade.traceId,
      });
      this._callbacks?.onEntryError?.(String(err), trade);
    }

    this._phase = "monitoring";
    this._callbacks?.onPhaseChange?.(this._phase);
  }

  private _logLatencyStats(): void {
    this._statsLogCounter++;
    if (this._statsLogCounter % 10 !== 0) return;

    const recs = this._records;
    if (recs.length === 0) return;

    let sumClockDrift = 0;
    let sumBroker = 0;
    let sumTotal = 0;
    let worstTotal = 0;
    let maxDecisionAge = 0;
    let count = 0;

    for (const r of recs) {
      const drift = r.sendTime - r.candleOpenTime;
      const decisionAge = r.sendTime - r.decisionTime;
      sumClockDrift += drift;
      sumBroker += r.brokerDelay;
      sumTotal += r.totalLatency;
      if (r.totalLatency > worstTotal) worstTotal = r.totalLatency;
      if (decisionAge > maxDecisionAge) maxDecisionAge = decisionAge;
      count++;
    }

    console.log("[LATENCY STATS]", {
      operations: count,
      averageClockDrift: `${Math.round(sumClockDrift / count)}ms`,
      averageBrokerLatency: `${Math.round(sumBroker / count)}ms`,
      averageTotalLatency: `${Math.round(sumTotal / count)}ms`,
      worstTotalLatency: `${worstTotal}ms`,
      maxDecisionAge: `${maxDecisionAge}ms`,
    });
  }
}
