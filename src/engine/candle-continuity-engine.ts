/**
 * engine/candle-continuity-engine.ts
 * Motor de Continuidade por Confirmação de Candles (FSM).
 *
 * REGRAS SIMPLIFICADAS:
 * - Nunca opera durante formação de vela. Sempre aguarda fechamento completo.
 * - Exige DOIS candles consecutivos no mesmo sentido (verde/verde ou vermelho/vermelho).
 * - Após WIN: a vela vencedora conta como 1ª do próximo padrão (só precisa de 1 vela extra).
 * - Após LOSS: padrão quebrado, precisa de 2 candles frescos da mesma cor.
 * - Sem filtros extras: sem score, sem força, sem doji, sem inside bar, sem S/R.
 */

import type { Candle } from "../market/types";
import type { SRAnalysis } from "./support-resistance";
import type { LateralizationResult } from "./lateralization";
import type { CandleStrengthResult } from "./candle-strength";
import type { ScoreResult } from "./score-calculator";

export interface CandleContinuityResult {
  direction: "call" | "put" | null;
  state: CandleContinuityState;
  filters: FilterCheck[];
  reason: string | null;
  candles: Candle[];
  srAnalysis: SRAnalysis;
  lateralization: LateralizationResult;
  candleStrength: CandleStrengthResult | null;
  continuityStrength: number;
  dominance: number;
  score: ScoreResult | null;
}

export interface FilterCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export type CandleContinuityState = "AGUARDANDO_PADRAO" | "ANALISANDO" | "SINAL_CONFIRMADO";

export class CandleContinuityEngine {
  private state: CandleContinuityState = "AGUARDANDO_PADRAO";
  private processedUntil = 0;
  private pendingDirection: "call" | "put" | null = null;
  private pendingCandleTime = 0;
  private reason: string | null = null;
  private filters: FilterCheck[] = [];
  private _lastWinningCandleColor: "call" | "put" | null = null;

  analyze(candles: Candle[]): CandleContinuityResult {
    this.filters = [];

    if (candles.length < 2) {
      this.state = "AGUARDANDO_PADRAO";
      return this.makeResult(null, { candles });
    }

    const lastCandle = candles[candles.length - 1];
    const prevCandle = candles[candles.length - 2];

    if (this.pendingDirection && lastCandle.time > this.pendingCandleTime) {
      this.state = "SINAL_CONFIRMADO";
      return this.makeResult(this.pendingDirection, { candles });
    }

    if (this.pendingDirection) {
      this.state = "SINAL_CONFIRMADO";
      return this.makeResult(this.pendingDirection, { candles });
    }

    if (lastCandle.time <= this.processedUntil) {
      this.state = "AGUARDANDO_PADRAO";
      return this.makeResult(null, { candles });
    }

    this.state = "ANALISANDO";

    // ── Lógica pós-WIN: último candle ganhador conta como 1ª vela do padrão ──
    if (this._lastWinningCandleColor) {
      const isLastGreen = lastCandle.close > lastCandle.open;
      const lastColor: "call" | "put" = isLastGreen ? "call" : "put";

      if (lastColor === this._lastWinningCandleColor) {
        // Mesma cor = padrão confirmado com apenas 1 vela extra
        this.filter(
          "Continuidade pós-WIN",
          true,
          `Vela ${lastColor.toUpperCase()} confirma padrão`,
        );
        this._lastWinningCandleColor = null;
        this.pendingDirection = lastColor;
        this.pendingCandleTime = lastCandle.time;
        this.state = "SINAL_CONFIRMADO";
        return this.makeResult(lastColor, { candles });
      } else {
        // Cor diferente = padrão quebrado, reseta
        this.filter(
          "Continuidade pós-WIN",
          false,
          `Vela ${lastColor.toUpperCase()} quebra padrão ${this._lastWinningCandleColor.toUpperCase()}`,
        );
        this._lastWinningCandleColor = null;
        this.processedUntil = lastCandle.time;
        this.state = "AGUARDANDO_PADRAO";
        return this.makeResult(null, { candles });
      }
    }

    // ── Lógica padrão: 2 candles consecutivos da mesma cor ──
    const prevGreen = prevCandle.close > prevCandle.open;
    const currGreen = lastCandle.close > lastCandle.open;

    if (prevGreen && currGreen) {
      this.filter("Direção", true, "Dois candles verdes consecutivos");
      this.pendingDirection = "call";
      this.pendingCandleTime = lastCandle.time;
      this.state = "SINAL_CONFIRMADO";
      return this.makeResult("call", { candles });
    }

    if (!prevGreen && !currGreen) {
      this.filter("Direção", true, "Dois candles vermelhos consecutivos");
      this.pendingDirection = "put";
      this.pendingCandleTime = lastCandle.time;
      this.state = "SINAL_CONFIRMADO";
      return this.makeResult("put", { candles });
    }

    // Candles de cores diferentes = sem padrão
    this.filter("Candles consecutivos", false, "Candles sem continuidade de cor");
    this.processedUntil = lastCandle.time;
    this.state = "AGUARDANDO_PADRAO";
    return this.makeResult(null, { candles });
  }

  consumeSignal(result?: "win" | "loss" | "draw"): void {
    if (result === "win" && this.pendingDirection) {
      // WIN: salva a direção ganhadora para reutilizar como 1ª vela do próximo padrão
      this._lastWinningCandleColor = this.pendingDirection;
    } else {
      // LOSS ou DRAW: reseta completamente, precisa de 2 candles frescos
      this._lastWinningCandleColor = null;
    }
    this.processedUntil = this.pendingCandleTime;
    this.pendingDirection = null;
    this.pendingCandleTime = 0;
    this.state = "AGUARDANDO_PADRAO";
    this.reason = null;
  }

  reset(): void {
    this.processedUntil = 0;
    this.pendingDirection = null;
    this.pendingCandleTime = 0;
    this.state = "AGUARDANDO_PADRAO";
    this.reason = null;
    this.filters = [];
    this._lastWinningCandleColor = null;
  }

  private filter(name: string, passed: boolean, detail: string): void {
    this.filters.push({ name, passed, detail });
  }

  private makeResult(
    direction: "call" | "put" | null,
    extra?: Partial<CandleContinuityResult>,
  ): CandleContinuityResult {
    return {
      direction,
      state: this.state,
      filters: [...this.filters],
      reason: this.reason,
      candles: extra?.candles ?? [],
      srAnalysis: extra?.srAnalysis ?? {
        supports: [],
        resistances: [],
        blockCall: false,
        blockPut: false,
        proximityPercent: 0,
      },
      lateralization: extra?.lateralization ?? {
        isLateralized: false,
        rangePercent: 0,
        repeatedTop: false,
        repeatedBottom: false,
        reason: null,
      },
      candleStrength: extra?.candleStrength ?? null,
      continuityStrength: extra?.continuityStrength ?? 0,
      dominance: extra?.dominance ?? 0,
      score: extra?.score ?? null,
    };
  }
}

export default CandleContinuityEngine;
