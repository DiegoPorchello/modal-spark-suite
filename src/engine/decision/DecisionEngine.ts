/**
 * engine/decision/DecisionEngine.ts
 * Motor de decisão principal. Orquestra todos os engines e decide entrar ou bloquear.
 *
 * REGRAS (Score Engine):
 * - Nunca operar com candle aberto
 * - Score Engine soma pontos de cada filtro (nenhum bloqueia)
 * - Faixas: 0-39 Não operar | 40-59 Fraco | 60-69 Observação | 70-84 Entrada | 85-100 Forte
 * - Nunca bloquear entrada apenas porque um filtro falhou
 * - Debug mode com dados reais de todos os filtros
 * - Auto-teste no startup
 */

import type { Candle } from "../../market/types";
import { TrendEngine, type TrendResult } from "./TrendEngine";
import { StructureEngine, type StructureResult } from "./StructureEngine";
import { PriceActionEngine, type PriceActionResult } from "./PriceActionEngine";
import { SmartMoneyEngine, type SmartMoneyResult } from "./SmartMoneyEngine";
import { MomentumEngine, type MomentumResult } from "./MomentumEngine";
import { ScoreEngine, type ScoreBreakdownResult, type ScoreFilterItem } from "./ScoreEngine";
import { MicroReversalEngine, type MicroReversalResult } from "./MicroReversalEngine";
import { engineLogger } from "../logger";

export type DecisionDirection = "CALL" | "PUT" | null;

export type BlockedRule =
  | "INSUFFICIENT_DATA"
  | "LOW_SCORE"
  | "NO_CLEAR_DIRECTION"
  | "NO_TREND"
  | "SIDEWAYS_MARKET"
  | "PAYOUT_LOW"
  | "BROKER_ERROR"
  | "ANALYSIS_ERROR"
  | "MICRO_REVERSAL"
  | "STRONG_TREND_VETO"
  | "STRONG_MOMENTUM_VETO"
  | null;

export interface FilterItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SRLevel {
  price: number;
  strength: number;
  touches: number;
  type: "support" | "resistance";
}

export interface SRAnalysis {
  supports: SRLevel[];
  resistances: SRLevel[];
  blockCall: boolean;
  blockPut: boolean;
}

export interface LateralizationData {
  isLateralized: boolean;
  rangePercent: number;
  direction: string;
  reason: string | null;
}

export interface CandleStrengthData {
  bodyScore: number;
  wickScore: number;
  rangeScore: number;
  expansionScore: number;
  accelerationScore: number;
  total: number;
}

export interface ScoreBreakdown {
  continuityScore: number;
  dominanceScore: number;
  strengthScore: number;
  structureScore: number;
  historyScore: number;
  total: number;
  classification: string;
}

export interface DebugData {
  ema9: number;
  ema21: number;
  ema50: number;
  trendDirection: string;
  trendScore: number;
  rsi: number;
  rsiZone: string;
  macdTrend: string;
  macdHistogram: number;
  adx: number;
  atr: number;
  volumeAboveAvg: boolean;
  bos: string | null;
  choch: string | null;
  pullbackZone: boolean;
  paPattern: string | null;
  paDirection: string;
  obCount: number;
  fvgType: string | null;
  sweepType: string | null;
  totalScore: number;
  canOperate: boolean;
  direction: DecisionDirection;
}

export interface DecisionResult {
  direction: DecisionDirection;
  scoreBreakdown: ScoreBreakdownResult;
  trend: TrendResult;
  structure: StructureResult;
  priceAction: PriceActionResult;
  smartMoney: SmartMoneyResult;
  momentum: MomentumResult;
  timestamp: Date;
  asset: string;
  log: string;
  blockedReason: string | null;
  blockedRule: BlockedRule;

  microReversal: MicroReversalResult;

  // ── Backward-compatible properties (used by UI) ──
  filters: FilterItem[];
  score: ScoreBreakdown;
  reason: string | null;
  candles: Candle[];
  srAnalysis: SRAnalysis;
  candleStrength: CandleStrengthData;
  dominance: number;
  continuityStrength: number;
  lateralization: LateralizationData;

  // ── Debug mode data ──
  debugData?: DebugData;

  // ── Legacy compatibility (for FlowRobotEngine) ──
  probability: {
    total: number;
    level: string;
    canOperate: boolean;
    trendScore: number;
    structureScore: number;
    priceActionScore: number;
    smartMoneyScore: number;
    momentumScore: number;
    breakdown: {
      trend: { score: number; max: number; label: string };
      structure: { score: number; max: number; label: string };
      priceAction: { score: number; max: number; label: string };
      smartMoney: { score: number; max: number; label: string };
      momentum: { score: number; max: number; label: string };
      bonuses: { score: number; max: number; label: string };
    };
    details: string[];
  };
}

export class DecisionEngine {
  private trendEngine = new TrendEngine();
  private structureEngine = new StructureEngine();
  private priceActionEngine = new PriceActionEngine();
  private smartMoneyEngine = new SmartMoneyEngine();
  private momentumEngine = new MomentumEngine();
  private scoreEngine = new ScoreEngine();
  private microReversalEngine = new MicroReversalEngine();
  microReversalEnabled = false;

  private history: DecisionResult[] = [];

  static isCryptoAsset(asset: string): boolean {
    const upper = asset.toUpperCase();
    return (
      upper.includes("USDT") ||
      upper.includes("BTC") ||
      upper.includes("ETH") ||
      upper.includes("BTSOL") ||
      upper.includes("MAPE") ||
      upper.includes("XRP") ||
      upper.includes("DOGE") ||
      upper.includes("BETH") ||
      upper.includes("SOL") ||
      upper.includes("BNB") ||
      upper.includes("ADA") ||
      upper.includes("AVAX") ||
      upper.includes("DOT") ||
      upper.includes("LINK") ||
      upper.includes("MATIC") ||
      upper.includes("SHIB") ||
      upper.includes("LTC") ||
      upper.includes("BCH") ||
      upper.includes("XLM") ||
      upper.includes("ATOM")
    );
  }

  analyze(candles: Candle[], asset: string): DecisionResult {
    const timestamp = new Date();

    // ══ ETAPA 1: Recebeu candles? ══
    engineLogger.info("DecisionEngine", `═══ DIAGNÓSTICO ${asset} ═══`, {
      candleCount: candles.length,
      firstTime: candles.length > 0 ? new Date(candles[0].time).toISOString() : "N/A",
      lastTime:
        candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A",
    });

    if (!candles || candles.length === 0) {
      engineLogger.error("DecisionEngine", "❌ ETAPA 1 FALHOU: Nenhum candle recebido", {
        asset,
        reason: "getCandles retornou array vazio — WebSocket pode não estar conectado",
      });
      return this.buildBlocked(
        "Nenhum candle recebido — WebSocket desconectado",
        "INSUFFICIENT_DATA",
        asset,
        timestamp,
        [],
      );
    }

    // RULE: Never trade with open candle — use only closed candles
    const closedCandles = candles.slice(0, -1);
    engineLogger.info("DecisionEngine", `ETAPA 1: Candles recebidos`, {
      total: candles.length,
      closed: closedCandles.length,
      dropped_open: candles.length - closedCandles.length,
    });

    const HYBRID_PUMA_ASSETS = new Set(["BETHUSDT","BTSOLUSDT","MAPEUSDT","XRDOGUSDT","XRPSOLUSDT"]);
    const minCandlesForAsset = HYBRID_PUMA_ASSETS.has(asset.toUpperCase()) ? 5 : 30;
    if (closedCandles.length < minCandlesForAsset) {
      engineLogger.error("DecisionEngine", `❌ ETAPA 1 FALHOU: Poucos dados`, {
        closed: closedCandles.length,
        required: minCandlesForAsset,
        reason: `getCandles retornou apenas ${candles.length} candles — buffer do WebSocket pode estar populando`,
      });
      return this.buildBlocked(
        `Poucos dados (${closedCandles.length}/${minCandlesForAsset} candles fechados)`,
        "INSUFFICIENT_DATA",
        asset,
        timestamp,
        closedCandles,
      );
    }

    // ══ ETAPA 2: Indicadores calculados? ══
    engineLogger.info(
      "DecisionEngine",
      `ETAPA 2: Calculando indicadores para ${closedCandles.length} candles`,
      {},
    );

    // Run all engines
    const trend = this.trendEngine.analyze(closedCandles);
    engineLogger.info("DecisionEngine", `ETAPA 2: TrendEngine`, {
      direction: trend.direction,
      score: `${trend.score}/20`,
      ema9: trend.ema9.toFixed(4),
      ema21: trend.ema21.toFixed(4),
      ema50: trend.ema50.toFixed(4),
      emaAlignment: trend.emaAlignment,
      structure: trend.structure,
      passed: trend.passed,
      details: trend.details,
    });

    const structure = this.structureEngine.analyze(closedCandles);
    engineLogger.info("DecisionEngine", `ETAPA 2: StructureEngine`, {
      score: `${structure.score}/15`,
      support: structure.support.toFixed(4),
      resistance: structure.resistance === Infinity ? "Infinity" : structure.resistance.toFixed(4),
      bos: structure.bos ?? "none",
      choch: structure.choch ?? "none",
      pullbackZone: structure.pullbackZone,
      passed: structure.passed,
      details: structure.details,
    });

    const priceAction = this.priceActionEngine.analyze(closedCandles);
    engineLogger.info("DecisionEngine", `ETAPA 2: PriceActionEngine`, {
      score: `${priceAction.score}/15`,
      pattern: priceAction.pattern ?? "none",
      direction: priceAction.direction,
      strength: priceAction.strength,
      confirmation: priceAction.confirmation,
      consecutive: priceAction.consecutive,
      bodyRatio: priceAction.bodyRatio.toFixed(2),
      passed: priceAction.passed,
      details: priceAction.details,
    });

    const smartMoney = this.smartMoneyEngine.analyze(closedCandles);
    engineLogger.info("DecisionEngine", `ETAPA 2: SmartMoneyEngine`, {
      score: `${smartMoney.score}/10`,
      obCount: smartMoney.orderBlocks.length,
      obTypes: smartMoney.orderBlocks.map((ob) => `${ob.type}(tested=${ob.tested})`),
      fvg: smartMoney.fvg
        ? `${smartMoney.fvg.type} ${smartMoney.fvg.low.toFixed(4)}-${smartMoney.fvg.high.toFixed(4)}`
        : "none",
      sweep: smartMoney.liquiditySweep ?? "none",
      displacement: smartMoney.displacement,
      passed: smartMoney.passed,
      details: smartMoney.details,
    });

    const momentum = this.momentumEngine.analyze(closedCandles);
    engineLogger.info("DecisionEngine", `ETAPA 2: MomentumEngine`, {
      score: `${momentum.score}/15`,
      rsi: momentum.rsi.toFixed(1),
      rsiZone: momentum.rsiZone,
      macd: momentum.macdTrend,
      macdHistogram: momentum.macdHistogram.toFixed(4),
      adx: momentum.adx.toFixed(1),
      adxStrength: momentum.adxStrength,
      atr: momentum.atr.toFixed(4),
      atrPercent: momentum.atrPercent.toFixed(2) + "%",
      volumeAboveAvg: momentum.volumeAboveAverage,
      volumeTrend: momentum.volumeTrend,
      passed: momentum.passed,
      details: momentum.details,
    });

    const lastPrice = closedCandles[closedCandles.length - 1].close;

    // ══ ETAPA 3: Score Engine (substitui lógica AND) ══
    const scoreBreakdown = this.scoreEngine.calculate(
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
    );

    engineLogger.info("DecisionEngine", `═══ ETAPA 3: SCORE ENGINE ═══`, {
      total: `${scoreBreakdown.total}/100`,
      band: scoreBreakdown.bandLabel,
      filters: scoreBreakdown.filters
        .map((f) => `${f.name}: ${f.points}/${f.maxPoints}`)
        .join(", "),
      strategy: scoreBreakdown.strategy,
    });

    // Log detalhado de cada filtro
    for (const line of scoreBreakdown.logLines) {
      engineLogger.info("DecisionEngine", `  ${line}`);
    }

    // ══ ETAPA 4: Direção e decisão ══
    let direction: DecisionDirection = null;
    let blockedReason: string | null = null;
    let blockedRule: BlockedRule = null;

    const isCrypto = DecisionEngine.isCryptoAsset(asset);
    const minScore = isCrypto ? 60 : 60;
    const minDirectionScore = isCrypto ? 45 : 45;
    const sidewaysMinScore = isCrypto ? 80 : 80;

    // Score baixo = não operar (mas nunca bloquear por filtro individual)
    if (scoreBreakdown.total < minScore) {
      blockedReason =
        scoreBreakdown.refusalReason ?? `Score ${scoreBreakdown.total}/100 — abaixo de ${minScore}${isCrypto ? " (crypto)" : ""}`;
      blockedRule = "LOW_SCORE";
      engineLogger.warn("DecisionEngine", `❌ ETAPA 4: RECUSADO — ${blockedReason}`, {
        total: scoreBreakdown.total,
        band: scoreBreakdown.bandLabel,
        minScore,
        isCrypto,
      });
    } else if (trend.direction === "SIDEWAYS" && scoreBreakdown.total < sidewaysMinScore) {
      // Mercado lateral SÓ bloqueia se score < threshold
      blockedReason = `Mercado lateral (SIDEWAYS) — score insuficiente (${scoreBreakdown.total} < ${sidewaysMinScore}${isCrypto ? " crypto" : ""})`;
      blockedRule = "SIDEWAYS_MARKET";
      engineLogger.warn("DecisionEngine", `❌ ETAPA 4: RECUSADO — ${blockedReason}`);
    } else {
      // Score >= minScore: determinar direção
      const callScore = this.calcDirectionScore(
        "CALL",
        trend,
        structure,
        priceAction,
        smartMoney,
        momentum,
      );
      const putScore = this.calcDirectionScore(
        "PUT",
        trend,
        structure,
        priceAction,
        smartMoney,
        momentum,
      );

      engineLogger.info("DecisionEngine", `ETAPA 4: Scores de direção`, {
        callScore,
        putScore,
        minRequired: minDirectionScore,
        isCrypto,
      });

      // Direção precisa de pelo menos X pts (mais rigoroso para crypto)
      if (callScore > putScore && callScore >= minDirectionScore) {
        direction = "CALL";
      } else if (putScore > callScore && putScore >= minDirectionScore) {
        direction = "PUT";
      } else {
        blockedReason = `Sem direção clara (CALL: ${callScore}, PUT: ${putScore}, mínimo: ${minDirectionScore})`;
        blockedRule = "NO_CLEAR_DIRECTION";
        engineLogger.warn("DecisionEngine", `❌ ETAPA 4: RECUSADO — ${blockedReason}`);
      }
    }

    if (direction) {
      engineLogger.info("DecisionEngine", `✅ ETAPA 4: AUTORIZADO — ${direction}`, {
        score: scoreBreakdown.total,
        band: scoreBreakdown.bandLabel,
        trend: trend.direction,
        pattern: priceAction.pattern,
        strategy: scoreBreakdown.strategy,
      });
    }

    // ══ ETAPA 4B: Micro Reversal Filter (veto independente) ══
    const microReversal = this.microReversalEnabled
      ? this.microReversalEngine.analyze(closedCandles)
      : { probability: 0, passed: true, details: ["Micro Reversal desativado"] };
    engineLogger.info("DecisionEngine", `ETAPA 4B: MicroReversalFilter`, {
      probability: `${microReversal.probability}%`,
      passed: microReversal.passed,
      enabled: this.microReversalEnabled,
      details: microReversal.details.filter((d) => d.startsWith("✔") || d.startsWith("◐") || d.includes("desativado")).join(", "),
    });

    if (direction && !microReversal.passed) {
      blockedReason = `Micro Reversal: probabilidade ${microReversal.probability}% — alta chance de reversão no próximo candle`;
      blockedRule = "MICRO_REVERSAL";
      direction = null;
      engineLogger.warn("DecisionEngine", `❌ ETAPA 4B: BLOQUEADO — ${blockedReason}`, {
        probability: microReversal.probability,
        threshold: MicroReversalEngine.BLOCK_THRESHOLD,
      });
    } else if (direction) {
      engineLogger.info("DecisionEngine", `✅ ETAPA 4B: MicroReversal liberado (${microReversal.probability}% < ${MicroReversalEngine.BLOCK_THRESHOLD}%)`);
    }

    // ══ ETAPA 4C: Trend Veto (se score de tendência for muito baixo, não opera) ══
    if (direction && trend.score < 8) {
      blockedReason = `Trend Veto: score de tendência ${trend.score}/20 — tendência insuficiente (mínimo 8)`;
      blockedRule = "STRONG_TREND_VETO";
      direction = null;
      engineLogger.warn("DecisionEngine", `❌ ETAPA 4C: BLOQUEADO — ${blockedReason}`);
    } else if (direction) {
      engineLogger.info("DecisionEngine", `✅ ETAPA 4C: Trend liberado (${trend.score}/20 >= 8)`);
    }

    // ══ ETAPA 4D: Momentum Veto ══
    if (direction && momentum.adx < 20) {
      blockedReason = `Momentum Veto: ADX ${momentum.adx.toFixed(1)} < 20 — sem força direcional`;
      blockedRule = "STRONG_MOMENTUM_VETO";
      direction = null;
      engineLogger.warn("DecisionEngine", `❌ ETAPA 4D: BLOQUEADO — ${blockedReason}`);
    } else if (direction) {
      engineLogger.info("DecisionEngine", `✅ ETAPA 4D: Momentum liberado (ADX ${momentum.adx.toFixed(1)} >= 20)`);
    }

    // ══ ETAPA 5: Relatório final ══
    engineLogger.info("DecisionEngine", `═══ RELATÓRIO ${asset} ═══`, {
      candles: `${closedCandles.length} fechados`,
      trend: `${trend.direction} (${trend.score}/20)`,
      structure: `BOS=${structure.bos ?? "none"} CHoCH=${structure.choch ?? "none"} (${structure.score}/15)`,
      priceAction: `${priceAction.pattern ?? "nenhum"} ${priceAction.direction} (${priceAction.score}/15)`,
      smartMoney: `OB=${smartMoney.orderBlocks.length} FVG=${smartMoney.fvg?.type ?? "none"} (${smartMoney.score}/10)`,
      momentum: `RSI=${momentum.rsi.toFixed(1)} MACD=${momentum.macdTrend} ADX=${momentum.adx.toFixed(1)} (${momentum.score}/15)`,
      score: `${scoreBreakdown.total}/100 (${scoreBreakdown.bandLabel})`,
      direction: direction ?? "BLOQUEADO",
      reason: blockedReason ?? "N/A",
      strategy: scoreBreakdown.strategy,
    });

    // Build log
    const log = this.buildLog(
      asset,
      timestamp,
      direction,
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
      scoreBreakdown,
      blockedReason,
    );

    // Build debug data
    const debugData: DebugData = {
      ema9: trend.ema9,
      ema21: trend.ema21,
      ema50: trend.ema50,
      trendDirection: trend.direction,
      trendScore: trend.score,
      rsi: momentum.rsi,
      rsiZone: momentum.rsiZone,
      macdTrend: momentum.macdTrend,
      macdHistogram: momentum.macdHistogram,
      adx: momentum.adx,
      atr: momentum.atr,
      volumeAboveAvg: momentum.volumeAboveAverage,
      bos: structure.bos,
      choch: structure.choch,
      pullbackZone: structure.pullbackZone,
      paPattern: priceAction.pattern,
      paDirection: priceAction.direction,
      obCount: smartMoney.orderBlocks.length,
      fvgType: smartMoney.fvg?.type ?? null,
      sweepType: smartMoney.liquiditySweep,
      totalScore: scoreBreakdown.total,
      canOperate: scoreBreakdown.band !== "NAO_OPERAR" && scoreBreakdown.band !== "FRACO",
      direction,
    };

    const result: DecisionResult = {
      direction,
      scoreBreakdown,
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
      microReversal,
      timestamp,
      asset,
      log,
      blockedReason,
      blockedRule,
      // ── Backward-compatible fields ──
      filters: this.buildFiltersFromScore(scoreBreakdown, microReversal),
      score: this.buildScoreBreakdown(scoreBreakdown),
      reason: blockedReason,
      candles: closedCandles,
      srAnalysis: this.buildSRAnalysis(structure, lastPrice),
      candleStrength: this.buildCandleStrength(priceAction, momentum),
      dominance: momentum.volumeAboveAverage
        ? priceAction.direction === "bullish"
          ? 0.8
          : 0.2
        : 0.5,
      continuityStrength: scoreBreakdown.total,
      lateralization: this.buildLateralization(trend, closedCandles),
      debugData,
      // ── Legacy compatibility ──
      probability: this.buildLegacyProbability(
        scoreBreakdown,
        trend,
        structure,
        priceAction,
        smartMoney,
        momentum,
      ),
    };

    this.history.push(result);
    if (this.history.length > 500) this.history = this.history.slice(-500);

    return result;
  }

  /**
   * Cálculo de direção —Score Engine flexível.
   * Em vez de retornar 0 imediatamente se não há tendência perfeita,
   * atribui pontuação parcial baseada em confluências.
   */
  private calcDirectionScore(
    dir: "CALL" | "PUT",
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
  ): number {
    let score = 0;

    // Trend alignment —Score parcial se alinhamento indireto
    if (dir === "CALL" && trend.direction === "UPTREND") score += trend.score;
    else if (dir === "PUT" && trend.direction === "DOWNTREND") score += trend.score;
    else if (dir === "CALL" && trend.emaAlignment === "bullish")
      score += Math.floor(trend.score * 0.6);
    else if (dir === "PUT" && trend.emaAlignment === "bearish")
      score += Math.floor(trend.score * 0.6);
    else if (dir === "CALL" && trend.ema9 > trend.ema21) score += Math.floor(trend.score * 0.3);
    else if (dir === "PUT" && trend.ema9 < trend.ema21) score += Math.floor(trend.score * 0.3);
    // NÃO retorna 0 mais — Score Engine nunca bloqueia por filtro individual

    // Structure
    if (dir === "CALL" && (structure.bos === "bullish" || structure.choch === "bullish"))
      score += structure.score;
    else if (dir === "PUT" && (structure.bos === "bearish" || structure.choch === "bearish"))
      score += structure.score;
    else if (structure.pullbackZone) score += Math.floor(structure.score * 0.5);
    else score += Math.floor(structure.score * 0.3);

    // Price Action
    if (dir === "CALL" && priceAction.direction === "bullish") score += priceAction.score;
    else if (dir === "PUT" && priceAction.direction === "bearish") score += priceAction.score;
    else score += Math.floor(priceAction.score * 0.2);

    // Smart Money
    if (dir === "CALL" && smartMoney.orderBlocks.some((ob) => ob.type === "bullish"))
      score += smartMoney.score;
    else if (dir === "PUT" && smartMoney.orderBlocks.some((ob) => ob.type === "bearish"))
      score += smartMoney.score;
    else if (dir === "CALL" && smartMoney.fvg?.type === "bullish")
      score += Math.floor(smartMoney.score * 0.6);
    else if (dir === "PUT" && smartMoney.fvg?.type === "bearish")
      score += Math.floor(smartMoney.score * 0.6);
    else score += Math.floor(smartMoney.score * 0.2);

    // Momentum
    if (dir === "CALL" && momentum.macdTrend === "bullish") score += momentum.score;
    else if (dir === "PUT" && momentum.macdTrend === "bearish") score += momentum.score;
    else score += Math.floor(momentum.score * 0.3);

    return score;
  }

  private buildLog(
    asset: string,
    timestamp: Date,
    direction: DecisionDirection,
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
    scoreBreakdown: ScoreBreakdownResult,
    blockedReason: string | null,
  ): string {
    const time = timestamp.toLocaleTimeString("pt-BR");
    const lines: string[] = [];

    lines.push(`═══════════════════════════════════════`);
    lines.push(`  NEXOR V2 — SCORE ENGINE LOG`);
    lines.push(`═══════════════════════════════════════`);
    lines.push(`Ativo: ${asset}`);
    lines.push(`Hora: ${time}`);
    lines.push(`Candles: ${trend.ema9 > 0 ? "OK" : "INSUFICIENTES"}`);
    lines.push("");

    lines.push(`── PONTUAÇÃO POR FILTRO ──`);
    for (const f of scoreBreakdown.filters) {
      const sign = f.points >= 0 ? "+" : "";
      lines.push(`  ${f.name.padEnd(20)} ${sign}${f.points} pts  (${f.detail})`);
    }
    lines.push(`  ${"─".repeat(40)}`);
    lines.push(`  TOTAL: ${scoreBreakdown.total}/100 (${scoreBreakdown.bandLabel})`);
    lines.push("");

    lines.push(`── DETALHES DOS ENGINES ──`);
    for (const d of trend.details) lines.push(`  Trend: ${d}`);
    for (const d of structure.details) lines.push(`  Structure: ${d}`);
    for (const d of priceAction.details) lines.push(`  PA: ${d}`);
    for (const d of smartMoney.details) lines.push(`  SM: ${d}`);
    for (const d of momentum.details) lines.push(`  Mom: ${d}`);
    lines.push("");

    if (scoreBreakdown.strategy) {
      lines.push(`── ESTRATÉGIA ──`);
      lines.push(`  ${scoreBreakdown.strategy}`);
      lines.push("");
    }

    if (direction) {
      lines.push(`▶ DECISÃO: ${direction}`);
      lines.push(`Status: ✅ ENTRADA AUTORIZADA`);
      lines.push(`Score: ${scoreBreakdown.total}/100 (${scoreBreakdown.bandLabel})`);
      if (scoreBreakdown.entryReason) {
        lines.push(`Motivo: ${scoreBreakdown.entryReason}`);
      }
    } else {
      lines.push(`▶ DECISÃO: BLOQUEADO`);
      lines.push(`Motivo: ${blockedReason}`);
    }

    lines.push(`═══════════════════════════════════════`);

    return lines.join("\n");
  }

  private buildBlocked(
    reason: string,
    blockedRule: BlockedRule,
    asset: string,
    timestamp: Date,
    candles: Candle[],
  ): DecisionResult {
    const trend = this.trendEngine.analyze(candles);
    const structure = this.structureEngine.analyze(candles);
    const priceAction = this.priceActionEngine.analyze(candles);
    const smartMoney = this.smartMoneyEngine.analyze(candles);
    const momentum = this.momentumEngine.analyze(candles);
    const scoreBreakdown = this.scoreEngine.calculate(
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
    );
    const lastPrice = candles[candles.length - 1]?.close ?? 0;

    const debugData: DebugData = {
      ema9: trend.ema9,
      ema21: trend.ema21,
      ema50: trend.ema50,
      trendDirection: trend.direction,
      trendScore: trend.score,
      rsi: momentum.rsi,
      rsiZone: momentum.rsiZone,
      macdTrend: momentum.macdTrend,
      macdHistogram: momentum.macdHistogram,
      adx: momentum.adx,
      atr: momentum.atr,
      volumeAboveAvg: momentum.volumeAboveAverage,
      bos: structure.bos,
      choch: structure.choch,
      pullbackZone: structure.pullbackZone,
      paPattern: priceAction.pattern,
      paDirection: priceAction.direction,
      obCount: smartMoney.orderBlocks.length,
      fvgType: smartMoney.fvg?.type ?? null,
      sweepType: smartMoney.liquiditySweep,
      totalScore: scoreBreakdown.total,
      canOperate: scoreBreakdown.band !== "NAO_OPERAR" && scoreBreakdown.band !== "FRACO",
      direction: null,
    };

    return {
      direction: null,
      scoreBreakdown,
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
      microReversal: { probability: 0, passed: true, details: ["Sem análise — dados insuficientes"] },
      timestamp,
      asset,
      log: `[BLOCKED] ${reason}`,
      blockedReason: reason,
      blockedRule,
      filters: this.buildFiltersFromScore(scoreBreakdown, undefined),
      score: this.buildScoreBreakdown(scoreBreakdown),
      reason,
      candles,
      srAnalysis: this.buildSRAnalysis(structure, lastPrice),
      candleStrength: this.buildCandleStrength(priceAction, momentum),
      dominance: 0.5,
      continuityStrength: 0,
      lateralization: this.buildLateralization(trend, candles),
      debugData,
      probability: this.buildLegacyProbability(
        scoreBreakdown,
        trend,
        structure,
        priceAction,
        smartMoney,
        momentum,
      ),
    };
  }

  /**
   * Constrói FilterItem[] a partir do ScoreEngine (compatibilidade com UI existente)
   */
  private buildFiltersFromScore(
    scoreBreakdown: ScoreBreakdownResult,
    microReversal?: MicroReversalResult,
  ): FilterItem[] {
    const items = scoreBreakdown.filters
      .filter((f) => f.maxPoints > 0)
      .map((f) => ({
        name: f.name,
        passed: f.points > 0,
        detail: f.detail,
      }));
    if (microReversal) {
      items.push({
        name: "Micro Reversal",
        passed: microReversal.passed,
        detail: `${microReversal.probability}% — ${microReversal.passed ? "Fluxo saudável" : "Alta probabilidade de reversão"}`,
      });
    }
    return items;
  }

  private buildScoreBreakdown(scoreBreakdown: ScoreBreakdownResult): ScoreBreakdown {
    const filters = scoreBreakdown.filters;
    const getPoints = (name: string) => filters.find((f) => f.name === name)?.points ?? 0;

    return {
      continuityScore: getPoints("Continuidade"),
      dominanceScore: getPoints("Volume"),
      strengthScore: getPoints("Força da vela"),
      structureScore: getPoints("Suporte/Resistência"),
      historyScore: getPoints("Pullback"),
      total: scoreBreakdown.total,
      classification: scoreBreakdown.bandLabel,
    };
  }

  private buildCandleStrength(
    priceAction: PriceActionResult,
    momentum: MomentumResult,
  ): CandleStrengthData {
    const bodyScore = priceAction.direction !== "neutral" ? Math.floor(priceAction.score * 0.6) : 0;
    const wickScore =
      priceAction.pattern?.includes("pin") || priceAction.pattern?.includes("hammer") ? 15 : 5;
    const rangeScore = momentum.atr > 0 ? Math.min(20, Math.floor(momentum.atr * 2)) : 10;
    const expansionScore = momentum.macdTrend !== "neutral" ? 8 : 3;
    const accelerationScore = momentum.adx > 25 ? Math.min(10, Math.floor(momentum.adx / 5)) : 3;
    const total = Math.min(
      100,
      bodyScore + wickScore + rangeScore + expansionScore + accelerationScore,
    );

    return { bodyScore, wickScore, rangeScore, expansionScore, accelerationScore, total };
  }

  private buildLateralization(trend: TrendResult, candles: Candle[]): LateralizationData {
    const isLateralized = trend.direction === "SIDEWAYS";
    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const rangePercent = max > 0 ? ((max - min) / max) * 100 : 0;
    const reason = isLateralized ? "Mercado sem direção clara (SIDEWAYS)" : null;

    return { isLateralized, rangePercent, direction: trend.direction, reason };
  }

  private buildSRAnalysis(structure: StructureResult, lastPrice: number): SRAnalysis {
    const supports: SRLevel[] = [];
    const resistances: SRLevel[] = [];

    if (structure.support > 0) {
      supports.push({ price: structure.support, strength: 70, touches: 2, type: "support" });
    }
    if (structure.resistance < Infinity && structure.resistance > lastPrice) {
      resistances.push({
        price: structure.resistance,
        strength: 70,
        touches: 2,
        type: "resistance",
      });
    }

    const blockCall =
      resistances.length > 0 && resistances[0].price - lastPrice < lastPrice * 0.002;
    const blockPut = supports.length > 0 && lastPrice - supports[0].price < lastPrice * 0.002;

    return { supports, resistances, blockCall, blockPut };
  }

  /**
   * Constrói objeto legacy de probabilidade para compatibilidade com FlowRobotEngine
   */
  private buildLegacyProbability(
    scoreBreakdown: ScoreBreakdownResult,
    trend: TrendResult,
    structure: StructureResult,
    priceAction: PriceActionResult,
    smartMoney: SmartMoneyResult,
    momentum: MomentumResult,
  ) {
    const filters = scoreBreakdown.filters;
    const getPoints = (name: string) => filters.find((f) => f.name === name)?.points ?? 0;

    return {
      total: scoreBreakdown.total,
      level: scoreBreakdown.bandLabel,
      canOperate: scoreBreakdown.band !== "NAO_OPERAR" && scoreBreakdown.band !== "FRACO",
      trendScore: getPoints("Tendência"),
      structureScore: getPoints("LTA/LTB") + getPoints("Suporte/Resistência"),
      priceActionScore: getPoints("Força da vela") + getPoints("Padrão de Candle"),
      smartMoneyScore: getPoints("Smart Money") + getPoints("Order Block") + getPoints("Liquidez"),
      momentumScore: getPoints("Continuidade") + getPoints("Volume"),
      breakdown: {
        trend: { score: getPoints("Tendência"), max: 20, label: "Tendência" },
        structure: {
          score: getPoints("LTA/LTB") + getPoints("Suporte/Resistência"),
          max: 25,
          label: "Estrutura",
        },
        priceAction: {
          score: getPoints("Força da vela") + getPoints("Padrão de Candle"),
          max: 25,
          label: "Price Action",
        },
        smartMoney: {
          score: getPoints("Smart Money") + getPoints("Order Block") + getPoints("Liquidez"),
          max: 50,
          label: "Smart Money",
        },
        momentum: {
          score: getPoints("Continuidade") + getPoints("Volume"),
          max: 25,
          label: "Momentum",
        },
        bonuses: { score: 0, max: 0, label: "Score Engine (sem bônus separado)" },
      },
      details: scoreBreakdown.logLines,
    };
  }

  // ── PUBLIC: Auto-teste ──
  runSelfTest(): { passed: boolean; results: { name: string; ok: boolean; detail: string }[] } {
    const results: { name: string; ok: boolean; detail: string }[] = [];

    // 1. TrendEngine com dados sintéticos
    const trendCandles = this.generateTestCandles(60, 1.1, 0.001);
    const trendResult = this.trendEngine.analyze(trendCandles);
    results.push({
      name: "TrendEngine",
      ok: trendResult.score > 0 && trendResult.ema9 > 0,
      detail: `Score=${trendResult.score}/20, EMA9=${trendResult.ema9.toFixed(4)}, Dir=${trendResult.direction}`,
    });

    // 2. StructureEngine
    const structCandles = this.generateTestCandles(40, 1.1, 0.002);
    const structResult = this.structureEngine.analyze(structCandles);
    results.push({
      name: "StructureEngine",
      ok: structResult.score >= 0,
      detail: `Score=${structResult.score}/15, S=${structResult.support.toFixed(4)}, R=${structResult.resistance.toFixed(4)}`,
    });

    // 3. PriceActionEngine
    const paCandles = this.generateTestCandles(10, 1.1, 0.001);
    const paResult = this.priceActionEngine.analyze(paCandles);
    results.push({
      name: "PriceActionEngine",
      ok: paResult.score >= 0,
      detail: `Score=${paResult.score}/15, Pattern=${paResult.pattern ?? "none"}, Dir=${paResult.direction}`,
    });

    // 4. SmartMoneyEngine
    const smCandles = this.generateTestCandles(30, 1.1, 0.002);
    const smResult = this.smartMoneyEngine.analyze(smCandles);
    results.push({
      name: "SmartMoneyEngine",
      ok: smResult.score >= 0,
      detail: `Score=${smResult.score}/10, OB=${smResult.orderBlocks.length}, FVG=${smResult.fvg?.type ?? "none"}`,
    });

    // 5. MomentumEngine
    const momCandles = this.generateTestCandles(40, 1.1, 0.001);
    const momResult = this.momentumEngine.analyze(momCandles);
    results.push({
      name: "MomentumEngine",
      ok: momResult.score >= 0 && momResult.rsi > 0 && momResult.adx >= 0,
      detail: `Score=${momResult.score}/15, RSI=${momResult.rsi.toFixed(1)}, ADX=${momResult.adx.toFixed(1)}`,
    });

    // 6. ScoreEngine
    const scoreResult = this.scoreEngine.calculate(
      trendResult,
      structResult,
      paResult,
      smResult,
      momResult,
    );
    results.push({
      name: "ScoreEngine",
      ok: scoreResult.total >= 0 && scoreResult.total <= 100,
      detail: `Total=${scoreResult.total}/100, Band=${scoreResult.bandLabel}, Filters=${scoreResult.filters.length}`,
    });

    // 7. DecisionEngine integration
    const testCandles = this.generateTestCandles(70, 1.1, 0.001);
    const decision = this.analyze(testCandles, "TEST_ASSET");
    results.push({
      name: "DecisionEngine",
      ok: decision.log.length > 0 && decision.debugData !== undefined,
      detail: `Direction=${decision.direction ?? "BLOCKED"}, Score=${decision.scoreBreakdown.total}/100`,
    });

    const allPassed = results.every((r) => r.ok);

    engineLogger.info("DecisionEngine", `Auto-teste ${allPassed ? "✅ PASSOU" : "❌ FALHOU"}`, {
      passed: allPassed,
      results: results.map((r) => `${r.name}: ${r.ok ? "OK" : "FAIL"}`),
    });

    return { passed: allPassed, results };
  }

  private generateTestCandles(count: number, startPrice: number, volatility: number): Candle[] {
    const candles: Candle[] = [];
    let price = startPrice;
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.48) * volatility;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      const volume = Math.floor(1000 + Math.random() * 5000);
      candles.push({
        time: now - (count - i) * 60000,
        open,
        high,
        low,
        close,
        volume,
        asset: "TEST",
      });
      price = close;
    }
    return candles;
  }

  getHistory(): DecisionResult[] {
    return [...this.history];
  }

  getLastDecision(): DecisionResult | null {
    return this.history[this.history.length - 1] ?? null;
  }
}
