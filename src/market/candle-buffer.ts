/**
 * market/candle-buffer.ts
 * Buffer circular de candles — mantém mínimo de 70 candles por ativo.
 *
 * Regras:
 *   - Apenas candles fechados são armazenados
 *   - Buffer circular com tamanho máximo configurável
 *   - Mínimo de 70 candles para Decision Engine
 *   - Detecta candle em formação vs fechado
 */

import type { Candle } from "./types";
import { engineLogger } from "../engine/logger";

export interface CandleBufferOptions {
  maxSize?: number;
  minRequired?: number;
}

export class CandleBuffer {
  static _nextId = 1;
  readonly instanceId: number;
  private _buffer = new Map<string, Candle[]>();
  private _maxSize: number;
  private _minRequired: number;
  constructor(options: CandleBufferOptions = {}) {
    this.instanceId = CandleBuffer._nextId++;
    this._maxSize = options.maxSize ?? 500;
    this._minRequired = options.minRequired ?? 70;
    engineLogger.info("CandleBuffer", `Nova instância #${this.instanceId}`, {
      minRequired: this._minRequired,
      maxSize: this._maxSize,
    });
  }

  get minRequired(): number {
    return this._minRequired;
  }

  /* ── Adicionar Candle ───────────────────────────────────────────────────── */

  /**
   * Adiciona um candle ao buffer com validação cronológica adaptativa.
   *
   * Regras:
   *   newBar.time > lastBar.time  → PUSH (novo candle, avanço no tempo)
   *   newBar.time == lastBar.time → UPDATE (forming candle)
   *
   *   newBar.time < lastBar.time:
   *     ─ Se buffer ainda está em fase de preenchimento (< minRequired):
   *       Insere na posição correta (gap-fill) para permitir que
   *       histórico e real-time coexistam durante inicialização.
   *     ─ Se buffer já está pronto (>= minRequired):
   *       REJEITA — proteção contra reintrodução de dados velhos
   *       após o stream real-time estar ativo.
   *
   * Retorna true se o candle foi aceito no buffer.
   */
  addCandle(symbol: string, candle: Candle, isClosed: boolean = false): boolean {
    let candles = this._buffer.get(symbol);

    if (!candles) {
      candles = [];
      this._buffer.set(symbol, candles);
    }

    const lastBar = candles.length > 0 ? candles[candles.length - 1] : null;
    const lastTime = lastBar?.time ?? 0;

    // ── NOVO candle: time > lastTime ──
    if (candle.time > lastTime) {
      candles.push(candle);
      while (candles.length > this._maxSize) {
        candles.shift();
      }
      return isClosed;
    }

    // ── MESMO candle: time === lastTime (update do forming candle) ──
    if (candle.time === lastTime) {
      candles[candles.length - 1] = candle;
      return isClosed;
    }

    // ── candle.time < lastTime ──
    // Se o buffer já tem dados suficientes, rejeita (modo estrito)
    if (candles.length >= this._minRequired) {
      engineLogger.warn(
        "CandleBuffer",
        `⛔ VIOLAÇÃO CRONOLÓGICA — buffer pronto (${candles.length}/${this._minRequired}) — candle IGNORADO ${symbol} time=${new Date(candle.time).toISOString()} lastTime=${new Date(lastTime).toISOString()} diff=${lastTime - candle.time}ms`,
        {
          symbol,
          candleTime: new Date(candle.time).toISOString(),
          candleClose: candle.close,
          lastTime: new Date(lastTime).toISOString(),
          lastClose: lastBar?.close,
          diffMs: lastTime - candle.time,
          totalCandles: candles.length,
        },
      );
      return false;
    }

    // Fase de preenchimento — insere na posição correta (gap-fill)
    const existingIdx = candles.findIndex(c => c.time === candle.time);
    if (existingIdx >= 0) {
      candles[existingIdx] = candle;
      return isClosed;
    }

    const insertIdx = candles.findIndex(c => c.time > candle.time);
    if (insertIdx === -1) {
      candles.push(candle);
    } else {
      candles.splice(insertIdx, 0, candle);
    }
    while (candles.length > this._maxSize) {
      candles.shift();
    }

    engineLogger.info(
      "CandleBuffer",
      `GAP-FILL ${symbol} (${candles.length}/${this._minRequired}) time=${new Date(candle.time).toISOString()} atrás de ${new Date(lastTime).toISOString()}`,
      {
        symbol,
        candleTime: new Date(candle.time).toISOString(),
        lastTime: new Date(lastTime).toISOString(),
        diffMs: lastTime - candle.time,
        totalCandles: candles.length,
      },
    );

    return isClosed;
  }

  /* ── Obter Candles ──────────────────────────────────────────────────────── */

  getCandles(symbol: string, limit?: number): Candle[] {
    const candles = this._buffer.get(symbol) ?? [];
    if (limit && limit > 0) {
      return candles.slice(-limit);
    }
    return [...candles];
  }

  getLastCandle(symbol: string): Candle | null {
    const candles = this._buffer.get(symbol) ?? [];
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  /* ── Status do Buffer ───────────────────────────────────────────────────── */

  getBufferCount(symbol: string): number {
    return this._buffer.get(symbol)?.length ?? 0;
  }

  hasMinimumData(symbol: string): boolean {
    return this.getBufferCount(symbol) >= this._minRequired;
  }

  getBufferStatus(): Array<{
    symbol: string;
    count: number;
    hasMinimum: boolean;
    lastTime: string;
    lastClose: number;
  }> {
    return Array.from(this._buffer.entries()).map(([symbol, candles]) => ({
      symbol,
      count: candles.length,
      hasMinimum: candles.length >= this._minRequired,
      lastTime:
        candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A",
      lastClose: candles.length > 0 ? candles[candles.length - 1].close : 0,
    }));
  }

  /* ── Limpar ─────────────────────────────────────────────────────────────── */

  clear(symbol?: string): void {
    if (symbol) {
      this._buffer.delete(symbol);
    } else {
      this._buffer.clear();
    }
  }

  /* ── Diagnóstico ────────────────────────────────────────────────────────── */

  getDiagnostics(): {
    symbols: string[];
    counts: Record<string, number>;
    allReady: boolean;
  } {
    const symbols = Array.from(this._buffer.keys());
    const counts: Record<string, number> = {};

    for (const symbol of symbols) {
      counts[symbol] = this.getBufferCount(symbol);
    }

    const allReady = symbols.length > 0 && symbols.every((s) => this.hasMinimumData(s));

    return { symbols, counts, allReady };
  }
}
