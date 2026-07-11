/**
 * engine/flow-continuity-engine.ts
 * Motor principal Flow Continuity PRO — orquestrador do robô.
 *
 * LOOP PRINCIPAL (a cada 5 segundos):
 *   1. Atualizar mercado (getCandles dos ativos do ranking)
 *   2. Atualizar ranking (recalcular scores)
 *   3. Selecionar melhor ativo
 *   4. Validar score (>=80, classificação)
 *   5. Verificar bloqueios (S/R, lateralização)
 *   6. Consultar calculadora (SorosGale: getEntradaAtual)
 *   7. Executar ordem (CALL/PUT via executor)
 *   8. Aguardar resultado
 *   9. Atualizar calculadora (registrarWin/Loss)
 *   10. Registrar resultado no catálogo
 *   11. Registrar operação no banco
 *   12. Atualizar ranking
 *
 * Estratégia:
 * - CALL: candle anterior verde + candle atual verde + body > 60% + pavio contrário < 30%
 * - PUT:  candle anterior vermelho + candle atual vermelho + body > 60% + pavio contrário < 30%
 * - Score: Continuidade 40% | Dominância 25% | Força 15% | Estrutura 10% | Histórico 10%
 */

import type { IBroker } from "../broker/types";
import type { Timeframe, Candle } from "../market/types";
import type { RankedAsset } from "../ranking/types";
import type { ScoreResult, ScoreInput } from "./score-calculator";
import type { EngineSignal, EngineConfig } from "./types";
import type { ExecutorParams, ExecutionReport } from "../executor/types";
import { MarketDataService } from "../market";
import { CatalogManager } from "../catalog";
import { RankingManager } from "../ranking";
import { SorosGaleCalculator } from "../calculator";
import { Executor } from "../executor";
import type { DatabaseClient } from "../database";
import { detectContinuity, detectDominance } from "./continuity-detector";
import { calculateCandleStrength } from "./candle-strength";
import { detectSupportResistance } from "./support-resistance";
import { detectLateralization } from "./lateralization";
import { calculateScore, shouldTrade } from "./score-calculator";
import { engineLogger as log } from "./logger";
import { DEFAULT_ENGINE_CONFIG } from "./types";

export type EngineStatus = "stopped" | "running" | "paused" | "error";

export interface EngineState {
  status: EngineStatus;
  currentAsset: string | null;
  currentDirection: "CALL" | "PUT" | null;
  lastSignal: EngineSignal | null;
  lastResult: ExecutionReport | null;
  uptime: number;
  totalSignals: number;
  totalTrades: number;
  wins: number;
  losses: number;
  error: string | null;
}

export class FlowContinuityEngine {
  private config: EngineConfig;
  private marketData: MarketDataService;
  private catalog: CatalogManager;
  private ranking: RankingManager;
  private calculator: SorosGaleCalculator;
  private executor: Executor;
  private db?: DatabaseClient;
  private broker: IBroker;

  private state: EngineState;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;

  private readonly TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15"];
  private readonly ASSETS = [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "BTCUSD",
    "ETHUSD",
    "BETHUSDT",
    "XAUUSD",
    "USDCAD",
    "NZDUSD",
    "BTSOLUSDT",
    "MAPEUSDT",
    "XRDOGUSDT",
    "XRPSOLUSDT",
  ];

  constructor(
    broker: IBroker,
    marketData: MarketDataService,
    catalog: CatalogManager,
    ranking: RankingManager,
    calculator: SorosGaleCalculator,
    executor: Executor,
    config?: Partial<EngineConfig>,
    db?: DatabaseClient,
  ) {
    this.broker = broker;
    this.marketData = marketData;
    this.catalog = catalog;
    this.ranking = ranking;
    this.calculator = calculator;
    this.executor = executor;
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.db = db;
    this.state = {
      status: "stopped",
      currentAsset: null,
      currentDirection: null,
      lastSignal: null,
      lastResult: null,
      uptime: 0,
      totalSignals: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      error: null,
    };
  }

  getState(): EngineState {
    return { ...this.state };
  }

  async start(): Promise<void> {
    if (this.state.status === "running") {
      log.warn("Engine", "Tentativa de iniciar engine já em execução");
      return;
    }

    this.startTime = Date.now();
    this.state.status = "running";
    this.state.error = null;

    log.info("Engine", "Flow Continuity PRO Engine iniciado", {
      config: this.config,
    });

    // Executa primeiro ciclo imediatamente
    await this.tick();

    // Inicia loop
    this.loopTimer = setInterval(() => this.tick(), this.config.loopIntervalMs);
  }

  stop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.state.status = "stopped";
    this.state.uptime = Date.now() - this.startTime;
    log.info("Engine", "Engine parado", { uptime: this.state.uptime });
  }

  pause(): void {
    this.state.status = "paused";
    log.info("Engine", "Engine pausado");
  }

  resume(): void {
    this.state.status = "running";
    log.info("Engine", "Engine retomado");
  }

  private async tick(): Promise<void> {
    if (this.state.status !== "running") return;

    try {
      this.state.uptime = Date.now() - this.startTime;

      // 1. Verificar se há ordens ativas para checar resultado
      await this.checkActiveOrders();

      // 2. Atualizar ranking se necessário
      if (this.ranking.shouldRefresh()) {
        await this.updateRanking();
        this.ranking.markRefreshed();
      }

      // 3. Selecionar melhor ativo do ranking
      const topAsset = this.ranking.getTopAsset();
      if (!topAsset) {
        log.debug("Engine", "Nenhum ativo no ranking com score mínimo");
        return;
      }

      // 4. Analisar mercado para o melhor ativo em cada timeframe
      for (const timeframe of this.TIMEFRAMES) {
        const signal = await this.analyzeAsset(topAsset.asset, timeframe);
        if (signal && !signal.blocked) {
          await this.executeSignal(signal);
          break; // Executa apenas um sinal por tick
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
      log.error("Engine", "Erro no tick", { error: errorMsg });
      this.state.error = errorMsg;
      this.state.status = "error";
    }
  }

  private async updateRanking(): Promise<void> {
    log.info("Engine", "Atualizando ranking...");

    for (const asset of this.ASSETS) {
      try {
        for (const timeframe of this.TIMEFRAMES) {
          const candles = await this.marketData.getCandles(asset, timeframe, 30);
          if (candles.length < 3) continue;

          const continuity = detectContinuity(candles);
          const dominance = detectDominance(candles);
          const lastCandle = candles[candles.length - 1];
          const prevCandle = candles[candles.length - 2];
          const prevMeanRange = candles.slice(-10).reduce((s, c) => s + (c.high - c.low), 0) / 10;
          const strength = calculateCandleStrength(lastCandle, prevCandle, prevMeanRange);
          const sr = detectSupportResistance(candles.map((c) => c.close));
          const lat = detectLateralization(candles);

          let structureScore = 100;
          if (sr.blockCall || sr.blockPut) structureScore -= 40;
          if (lat.isLateralized) structureScore -= 30;
          structureScore = Math.max(0, structureScore);

          const historyScore = this.catalog.getHistoryScore(asset, timeframe, "CALL");

          const direction = continuity.direction;

          const scoreInput: ScoreInput = {
            continuity: continuity.strength,
            dominance: Math.abs(dominance),
            candleStrength: strength.total,
            structure: structureScore,
            history: historyScore,
          };

          const score = calculateScore(scoreInput);

          this.ranking.updateAsset(
            asset,
            asset,
            score,
            this.catalog.getWinrate(asset, timeframe, direction ?? "CALL"),
            continuity.strength,
            historyScore,
            direction,
          );
        }
      } catch (error) {
        log.warn("Engine", `Erro ao atualizar ${asset}`, { error });
      }
    }

    const rankings = this.ranking.getRankings();
    log.info("Engine", `Ranking atualizado: ${rankings.length} ativos`);
  }

  private async analyzeAsset(asset: string, timeframe: Timeframe): Promise<EngineSignal | null> {
    const candles = await this.marketData.getCandles(asset, timeframe, 30);
    if (candles.length < 5) return null;

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    // Continuidade
    const continuity = detectContinuity(candles);
    if (!continuity.hasContinuity || !continuity.direction) {
      return null;
    }

    // Dominância
    const dominance = detectDominance(candles);
    if (dominance === 0) return null;

    // Força do candle
    const prevMeanRange = candles.slice(-10).reduce((s, c) => s + (c.high - c.low), 0) / 10;
    const strength = calculateCandleStrength(lastCandle, prevCandle, prevMeanRange);

    // Estrutura (S/R)
    const sr = detectSupportResistance(candles.map((c) => c.close));

    // Lateralização
    const lat = detectLateralization(candles);

    // Histórico (catálogo)
    const historyScore = this.catalog.getHistoryScore(asset, timeframe, continuity.direction);

    // Score de estrutura
    let structureScore = 100;
    if (continuity.direction === "CALL" && sr.blockCall) structureScore -= 60;
    if (continuity.direction === "PUT" && sr.blockPut) structureScore -= 60;
    if (lat.isLateralized) structureScore -= 50;
    structureScore = Math.max(0, structureScore);

    // Calcular score total
    const scoreInput: ScoreInput = {
      continuity: continuity.strength,
      dominance: Math.abs(dominance),
      candleStrength: strength.total,
      structure: structureScore,
      history: historyScore,
    };

    const score = calculateScore(scoreInput);

    // Verificar bloqueios
    let blocked = false;
    let blockReason: string | null = null;

    if (!shouldTrade(score.classification)) {
      blocked = true;
      blockReason = `Score ${score.total} (${score.classification}) abaixo de 80`;
    } else if (continuity.direction === "CALL" && sr.blockCall) {
      blocked = true;
      blockReason = "CALL bloqueado: perto de resistência";
    } else if (continuity.direction === "PUT" && sr.blockPut) {
      blocked = true;
      blockReason = "PUT bloqueado: perto de suporte";
    } else if (lat.isLateralized) {
      blocked = true;
      blockReason = `Lateralizado: ${lat.reason}`;
    }

    const signal: EngineSignal = {
      asset,
      timeframe,
      direction: continuity.direction,
      score,
      continuity,
      candleStrength: strength,
      srAnalysis: sr,
      lateralization: lat,
      dominance,
      historyWinrate: historyScore,
      entryPrice: lastCandle.close,
      timestamp: Date.now(),
      blocked,
      blockReason,
    };

    this.state.lastSignal = signal;
    this.state.totalSignals++;

    log.debug("Engine", `Sinal ${asset} ${timeframe} ${continuity.direction}`, {
      score: score.total,
      classification: score.classification,
      blocked,
      blockReason,
    });

    return signal;
  }

  private async executeSignal(signal: EngineSignal): Promise<void> {
    if (this.executor.getActiveOrders().length >= this.config.maxConcurrentTrades) {
      log.warn("Engine", "Máximo de trades concorrentes atingido");
      return;
    }

    // Consultar calculadora para valor da entrada
    const entrada = this.calculator.getEntradaAtual();

    // Verificar se pode operar (stop)
    if (this.calculator.stop()) {
      log.warn("Engine", "Saldo insuficiente para operar", {
        saldo: this.calculator.getSaldo(),
        entrada: entrada.valor,
      });
      this.state.status = "error";
      this.state.error = "Saldo insuficiente";
      return;
    }

    // Determinar expiração baseada no timeframe
    const expirationMap: Record<string, number> = { M1: 60, M5: 300, M15: 900 };
    const expiration = expirationMap[signal.timeframe] ?? 60;

    const params: ExecutorParams = {
      asset: signal.asset,
      direction: signal.direction,
      amount: entrada.valor,
      expiration,
      entryPrice: signal.entryPrice,
      score: signal.score.total,
      classification: signal.score.classification,
      strategy: `FLOW_CONTINUITY_${signal.timeframe}`,
    };

    log.trade("Engine", `Executando ${signal.direction} ${signal.asset}`, {
      amount: entrada.valor,
      level: entrada.level,
      score: signal.score.total,
    });

    // Atualizar estado
    this.state.currentAsset = signal.asset;
    this.state.currentDirection = signal.direction;

    // Executar ordem
    const result = await this.executor.execute(params);

    if (result.status === "rejected" || result.status === "error") {
      log.error("Engine", `Ordem rejeitada: ${result.message}`);
      return;
    }

    this.state.totalTrades++;

    // Aguardar resultado (polling a cada 2s por até 60s)
    const orderResult = await this.pollOrderResult(result.orderId, expiration * 1000 + 5000);

    if (orderResult) {
      this.state.lastResult = orderResult;

      // Atualizar calculadora
      if (orderResult.result === "WIN") {
        this.calculator.registrarWin();
        this.state.wins++;
        log.trade("Engine", `WIN ${signal.asset} ${signal.direction}`, {
          profit: orderResult.profit,
          nivel: this.calculator.getNivel(),
        });
      } else if (orderResult.result === "LOSS") {
        this.calculator.registrarLoss();
        this.state.losses++;
        log.trade("Engine", `LOSS ${signal.asset} ${signal.direction}`, {
          loss: orderResult.profit,
          nivel: this.calculator.getNivel(),
        });
      } else {
        log.trade("Engine", `DRAW ${signal.asset} ${signal.direction}`);
      }

      // Registrar no catálogo
      const pattern = `${signal.direction}_${signal.timeframe}_${signal.continuity.consecutiveCandles}x`;
      this.catalog.addPattern({
        asset: signal.asset,
        timeframe: signal.timeframe,
        direction: signal.direction,
        padrao: pattern,
        score: signal.score.total,
        resultado: orderResult.result === "WIN" ? "WIN" : "LOSS",
        data: new Date().toISOString().split("T")[0],
        hora: new Date().toTimeString().split(" ")[0],
      });

      // Atualizar ranking
      this.ranking.updateAsset(
        signal.asset,
        signal.asset,
        signal.score,
        this.catalog.getWinrate(signal.asset, signal.timeframe, signal.direction),
        signal.continuity.strength,
        signal.historyWinrate,
        signal.direction,
      );

      // Registrar no banco
      if (this.db) {
        await this.db.saveOperation({
          asset: signal.asset,
          timeframe: signal.timeframe,
          direction: signal.direction,
          amount: params.amount,
          entry_price: signal.entryPrice,
          exit_price: orderResult.exitPrice,
          result: orderResult.result,
          profit: orderResult.profit,
          score: signal.score.total,
          score_continuity: signal.score.continuityScore,
          score_dominance: signal.score.dominanceScore,
          score_strength: signal.score.strengthScore,
          score_structure: signal.score.structureScore,
          score_history: signal.score.historyScore,
          classification: signal.score.classification,
          strategy: params.strategy,
          pattern,
          block_reason: signal.blockReason,
        });
      }

      // Log resumo
      const winrate =
        this.state.totalTrades > 0
          ? ((this.state.wins / this.state.totalTrades) * 100).toFixed(1)
          : "0.0";
      log.info(
        "Engine",
        `Resumo: ${this.state.totalTrades} trades | ${this.state.wins}W ${this.state.losses}L | WR ${winrate}%`,
      );
    }
  }

  private async pollOrderResult(
    orderId: string,
    timeout: number,
    interval = 2000,
  ): Promise<ExecutionReport | null> {
    const deadline = Date.now() + Math.min(timeout, 65000);

    while (Date.now() < deadline) {
      const result = await this.executor.checkResult(orderId);
      if (result) return result;
      await sleep(interval);
    }

    log.warn("Executor", "Timeout ao aguardar resultado da ordem");
    return null;
  }

  private async checkActiveOrders(): Promise<void> {
    const orders = this.executor.getActiveOrders();
    for (const orderId of orders) {
      const result = await this.executor.checkResult(orderId);
      if (result) {
        log.info("Executor", `Ordem ${orderId} resolvida: ${result.result}`);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
