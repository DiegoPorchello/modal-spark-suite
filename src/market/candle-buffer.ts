/**
 * market/candle-buffer.ts
 * Buffer circular de candles — mantém mínimo configurável de candles por ativo.
 *
 * Estados do buffer:
 *   INITIALIZING      → Buffer vazio, aguardando primeiro candle
 *   SYNCING_HISTORY   → Recebendo candles (histórico + real-time),
 *                        validação cronológica relaxada
 *   LIVE              → Sincronizado, proteção cronológica ativa
 *
 * Regras:
 *   - Apenas candles fechados são armazenados
 *   - Buffer circular com tamanho máximo configurável
 *   - Mínimo configurável para Decision Engine (default 70, hybrid 200)
 *   - Detecta candle em formação vs fechado
 *   - Duplicados são substituídos (time duplicado)
 *   - Ao entrar em LIVE, buffer é ordenado e validado
 */

import type { Candle } from "./types";
import { engineLogger } from "../engine/logger";

export type BufferState = "INITIALIZING" | "SYNCING_HISTORY" | "LIVE";

export interface BufferStateInfo {
  state: BufferState;
  totalCandles: number;
  firstTime: string;
  lastTime: string;
  candleCount: number;
  minRequired: number;
}

export interface CandleBufferOptions {
  maxSize?: number;
  minRequired?: number;
}

export type CandleAddResult = "updated" | "closed" | "added" | "rejected";

export class CandleBuffer {
  static _nextId = 1;
  readonly instanceId: number;
  private _buffer = new Map<string, Candle[]>();
  private _maxSize: number;
  private _minRequired: number;
  private _states = new Map<string, BufferState>();

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

  /** Define o estado do buffer para um símbolo com log detalhado */
  setState(symbol: string, state: BufferState): void {
    const s = symbol.toUpperCase();
    const prev = this._states.get(s) ?? null;
    if (prev === state) return;
    this._states.set(s, state);
    const candles = this._buffer.get(s) ?? [];
    engineLogger.info(
      "CandleBuffer",
      `STATE TRANSITION: ${s} ${prev ?? "INITIALIZING"} → ${state}`,
      {
        symbol: s,
        de: prev ?? "INITIALIZING",
        para: state,
        totalCandles: candles.length,
        primeiro: candles.length > 0 ? new Date(candles[0].time).toISOString() : "N/A",
        ultimo:
          candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A",
        minRequired: this._minRequired,
      },
    );
    console.log(
      `[CANDLE BUFFER DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ STATE TRANSITION ${s} ${prev ?? "INITIALIZING"} → ${state} ═══ count=${candles.length} first=${candles.length > 0 ? new Date(candles[0].time).toISOString() : "N/A"} last=${candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A"}`,
    );
  }

  getState(symbol: string): BufferState {
    return this._states.get(symbol.toUpperCase()) ?? "INITIALIZING";
  }

  getStateInfo(symbol: string): BufferStateInfo {
    const candles = this._buffer.get(symbol.toUpperCase()) ?? [];
    return {
      state: this.getState(symbol),
      totalCandles: candles.length,
      firstTime: candles.length > 0 ? new Date(candles[0].time).toISOString() : "N/A",
      lastTime:
        candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A",
      candleCount: candles.length,
      minRequired: this._minRequired,
    };
  }

  /* ── Adicionar Candle ───────────────────────────────────────────────────── */

  /**
   * Adiciona um candle ao buffer.
   *
   * Parâmetro origin:
   *   "history"  → candle carregado de fonte histórica (Binance API)
   *   "realtime" → candle recebido em tempo real (WebSocket)
   *
   * Regras por estado:
   *   INITIALIZING      → Aceita qualquer candle
   *   SYNCING_HISTORY   → Aceita candles fora de ordem (gap-fill)
   *   LIVE              → Rejeita candles com time < lastTime (proteção)
   *
   * Duplicatas (time já existente) sempre são substituídas.
   *
   * Retorna true se o candle foi aceito no buffer.
   */
  addCandle(
    symbol: string,
    candle: Candle,
    isClosed: boolean = false,
    origin?: "history" | "realtime",
  ): CandleAddResult {
    const upperSymbol = symbol.toUpperCase();
    let candles = this._buffer.get(upperSymbol);

    if (!candles) {
      candles = [];
      this._buffer.set(upperSymbol, candles);
    }

    candle.origin = origin;

    const state = this._states.get(upperSymbol) ?? "INITIALIZING";

    // Auto-transição INITIALIZING → SYNCING_HISTORY
    if (state === "INITIALIZING") {
      this.setState(upperSymbol, "SYNCING_HISTORY");
    }

    const lastBar = candles.length > 0 ? candles[candles.length - 1] : null;

    // ── UPDATE: mesmo timestamp do forming candle ──
    if (lastBar && candle.time === lastBar.time) {
      candle.open = lastBar.open;
      candles[candles.length - 1] = candle;
      engineLogger.debug(
        "CandleBuffer",
        `Candle atualizado ${upperSymbol} time=${new Date(candle.time).toISOString()} close=${candle.close}`,
        {
          symbol: upperSymbol,
          time: new Date(candle.time).toISOString(),
          close: candle.close,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          volume: candle.volume,
          origin,
          state,
        },
      );
      return "updated";
    }

    // ── NOVO candle: time > lastTime ──
    if (!lastBar || candle.time > lastBar.time) {
      if (!lastBar) {
        engineLogger.info(
          "CandleBuffer",
          `📥 PRIMEIRO CANDLE ${upperSymbol} time=${new Date(candle.time).toISOString()} close=${candle.close} origin=${origin}`,
          {
            symbol: upperSymbol,
            time: new Date(candle.time).toISOString(),
            close: candle.close,
            origin,
          },
        );
      }
      candles.push(candle);
      while (candles.length > this._maxSize) {
        candles.shift();
      }

      if (state === "LIVE" && lastBar) {
        engineLogger.info(
          "CandleBuffer",
          `Candle FECHADO ${upperSymbol} time=${new Date(lastBar.time).toISOString()} O=${lastBar.open} H=${lastBar.high} L=${lastBar.low} C=${lastBar.close}`,
          {
            symbol: upperSymbol,
            time: new Date(lastBar.time).toISOString(),
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
            volume: lastBar.volume,
          },
        );
        console.log(
          `[TIMING] BUFFER_CANDLE_CLOSED symbol=${upperSymbol} time=${lastBar.time} open=${lastBar.open} close=${lastBar.close} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`
        );
        return "closed";
      }
      return "added";
    }

    // ── candle.time < lastTime ──

    // LIVE → rejeita (proteção cronológica estrita)
    if (state === "LIVE") {
      const stateInfo = this.getStateInfo(upperSymbol);
      engineLogger.warn(
        "CandleBuffer",
        `⛔ VIOLAÇÃO CRONOLÓGICA [LIVE] — IGNORADO ${upperSymbol} origin=${origin} candle=${new Date(candle.time).toISOString()} last=${stateInfo.lastTime}`,
        {
          symbol: upperSymbol,
          state,
          totalCandles: candles.length,
          candleTime: new Date(candle.time).toISOString(),
          candleClose: candle.close,
          origin,
          firstTime: stateInfo.firstTime,
          lastTime: stateInfo.lastTime,
          diffMs: (lastBar?.time ?? 0) - candle.time,
          minRequired: this._minRequired,
        },
      );
      return "rejected";
    }

    // SYNCING_HISTORY → gap-fill
    const firstBar = candles.length > 0 ? candles[0] : null;
    const insertIdx = candles.findIndex((c) => c.time > candle.time);
    if (insertIdx === -1) {
      candles.push(candle);
      engineLogger.info(
        "CandleBuffer",
        `📥 GAP-FILL (append) ${upperSymbol} [${candles.length}/${this._minRequired}]
         time=${new Date(candle.time).toISOString()} close=${candle.close} origin=${origin}
         após lastTime=${new Date(lastBar?.time ?? 0).toISOString()}`,
        {
          symbol: upperSymbol,
          acao: "append",
          state,
          totalCandles: candles.length,
          candleTime: new Date(candle.time).toISOString(),
          candleClose: candle.close,
          origin,
          lastTime: new Date(lastBar?.time ?? 0).toISOString(),
          firstTime: firstBar ? new Date(firstBar.time).toISOString() : "N/A",
        },
      );
    } else {
      candles.splice(insertIdx, 0, candle);
      engineLogger.info(
        "CandleBuffer",
        `📥 GAP-FILL (insert) ${upperSymbol} [${candles.length}/${this._minRequired}]
         time=${new Date(candle.time).toISOString()} close=${candle.close} origin=${origin}
         pos=${insertIdx} (entre ${new Date(candles[insertIdx - 1]?.time ?? 0).toISOString()} e ${new Date(candles[insertIdx + 1]?.time ?? 0).toISOString()})`,
        {
          symbol: upperSymbol,
          acao: "insert",
          state,
          totalCandles: candles.length,
          candleTime: new Date(candle.time).toISOString(),
          candleClose: candle.close,
          origin,
          posicao: insertIdx,
          anterior: candles[insertIdx - 1]
            ? new Date(candles[insertIdx - 1].time).toISOString()
            : "N/A",
          proximo: candles[insertIdx + 1]
            ? new Date(candles[insertIdx + 1].time).toISOString()
            : "N/A",
          firstTime: firstBar ? new Date(firstBar.time).toISOString() : "N/A",
          lastTime: new Date(lastBar?.time ?? 0).toISOString(),
        },
      );
    }

    while (candles.length > this._maxSize) {
      candles.shift();
    }

    return "added";
  }

  /**
   * Marca o buffer como LIVE.
   *
   * Antes da transição:
   *   1. Ordena candles por time (garante consistência)
   *   2. Valida sequência cronológica (log warnings se violações)
   *   3. Aplica proteção cronológica estrita daqui em diante
   */
  markAsLive(symbol: string): void {
    const s = symbol.toUpperCase();
    const candles = this._buffer.get(s);

    if (!candles || candles.length === 0) {
      engineLogger.warn("CandleBuffer", `markAsLive ignorado: buffer vazio para ${s}`, {
        symbol: s,
      });
      return;
    }

    // 1. Ordena por time crescente
    candles.sort((a, b) => a.time - b.time);

    // 2. Valida sequência cronológica
    let violations = 0;
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].time <= candles[i - 1].time) {
        violations++;
        engineLogger.warn(
          "CandleBuffer",
          `⚠️ INCONSISTÊNCIA CRONOLÓGICA (pré-LIVE) ${s}
           [${i - 1}] time=${new Date(candles[i - 1].time).toISOString()} close=${candles[i - 1].close}
           [${i}] time=${new Date(candles[i].time).toISOString()} close=${candles[i].close}`,
          {
            symbol: s,
            index: i,
            prevTime: new Date(candles[i - 1].time).toISOString(),
            prevClose: candles[i - 1].close,
            currTime: new Date(candles[i].time).toISOString(),
            currClose: candles[i].close,
          },
        );
      }
    }

    // 3. Transiciona para LIVE
    this.setState(s, "LIVE");

    engineLogger.info(
      "CandleBuffer",
      `🔒 BUFFER AGORA LIVE ${s} candles=${candles.length} first=${new Date(candles[0].time).toISOString()} last=${new Date(candles[candles.length - 1].time).toISOString()} violations=${violations}`,
      {
        symbol: s,
        totalCandles: candles.length,
        firstTime: new Date(candles[0].time).toISOString(),
        lastTime: new Date(candles[candles.length - 1].time).toISOString(),
        violations,
      },
    );
  }

  /* ── Obter Candles ──────────────────────────────────────────────────────── */

  getCandles(symbol: string, limit?: number): Candle[] {
    const candles = this._buffer.get(symbol.toUpperCase()) ?? [];
    if (limit && limit > 0) {
      return candles.slice(-limit);
    }
    return [...candles];
  }

  getLastCandle(symbol: string): Candle | null {
    const candles = this._buffer.get(symbol.toUpperCase()) ?? [];
    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  getFirstCandle(symbol: string): Candle | null {
    const candles = this._buffer.get(symbol.toUpperCase()) ?? [];
    return candles.length > 0 ? candles[0] : null;
  }

  /* ── Status do Buffer ───────────────────────────────────────────────────── */

  getBufferCount(symbol: string): number {
    return this._buffer.get(symbol.toUpperCase())?.length ?? 0;
  }

  hasMinimumData(symbol: string): boolean {
    return this.getBufferCount(symbol) >= this._minRequired;
  }

  isLive(symbol: string): boolean {
    return this._states.get(symbol.toUpperCase()) === "LIVE";
  }

  getBufferStatus(): Array<{
    symbol: string;
    count: number;
    hasMinimum: boolean;
    lastTime: string;
    lastClose: number;
    state: BufferState;
  }> {
    return Array.from(this._buffer.entries()).map(([symbol, candles]) => ({
      symbol,
      count: candles.length,
      hasMinimum: candles.length >= this._minRequired,
      lastTime:
        candles.length > 0 ? new Date(candles[candles.length - 1].time).toISOString() : "N/A",
      lastClose: candles.length > 0 ? candles[candles.length - 1].close : 0,
      state: this._states.get(symbol) ?? "INITIALIZING",
    }));
  }

  /* ── Limpar ─────────────────────────────────────────────────────────────── */

  clear(symbol?: string): void {
    if (symbol) {
      const upper = symbol.toUpperCase();
      this._buffer.delete(upper);
      this._states.delete(upper);
    } else {
      this._buffer.clear();
      this._states.clear();
    }
  }

  /* ── Diagnóstico ────────────────────────────────────────────────────────── */

  getDiagnostics(): {
    symbols: string[];
    counts: Record<string, number>;
    states: Record<string, BufferState>;
    allReady: boolean;
  } {
    const symbols = Array.from(this._buffer.keys());
    const counts: Record<string, number> = {};
    const states: Record<string, BufferState> = {};

    for (const symbol of symbols) {
      counts[symbol] = this.getBufferCount(symbol);
      states[symbol] = this._states.get(symbol) ?? "INITIALIZING";
    }

    const allReady = symbols.length > 0 && symbols.every((s) => this.hasMinimumData(s));

    return { symbols, counts, states, allReady };
  }
}
