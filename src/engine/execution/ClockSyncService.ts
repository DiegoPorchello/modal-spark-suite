import { engineLogger } from "../logger";

/**
 * ClockSyncService
 *
 * Mantém uma estimativa do timestamp do servidor (Puma Broker) através de
 * amostras coletadas de respostas heartbeat/time do broker.
 *
 * Usa mediana das últimas N amostras para filtrar outliers de latência.
 */
export class ClockSyncService {
  private _offset = 0;
  private _samples: number[] = [];
  private readonly _maxSamples = 50;
  private _lastSyncAt = 0;

  /**
   * Registra uma amostra de sync.
   * serverTime: timestamp do servidor em ms.
   * localTime: timestamp local no momento do recebimento (default Date.now()).
   */
  record(serverTime: number, localTime: number = Date.now()): void {
    if (!serverTime || serverTime <= 0) return;
    const sample = localTime - serverTime;
    this._samples.push(sample);
    if (this._samples.length > this._maxSamples) {
      this._samples.shift();
    }
    this._offset = this._median();
    this._lastSyncAt = localTime;
  }

  /** Timestamp atual estimado do servidor (ms) */
  get now(): number {
    return Date.now() - this._offset;
  }

  /** Offset local - servidor (positivo = local adiantado) */
  get offset(): number {
    return this._offset;
  }

  /** Timestamp do servidor (ms) no qual o candle M1 atual abriu */
  get currentCandleTime(): number {
    return Math.floor(this.now / 60000) * 60000;
  }

  /** Timestamp do servidor (ms) no qual o PRÓXIMO candle M1 abrirá */
  get nextCandleTime(): number {
    return this.currentCandleTime + 60000;
  }

  /** Segundos até a abertura do próximo candle M1 */
  get secondsToNextCandle(): number {
    return Math.max(0, (this.nextCandleTime - this.now) / 1000);
  }

  /** Ms até a abertura do próximo candle */
  get msToNextCandle(): number {
    return Math.max(0, this.nextCandleTime - this.now);
  }

  /** Ms desde a abertura do candle atual */
  get msSinceLastCandle(): number {
    return Math.max(0, this.now - this.currentCandleTime);
  }

  private _median(): number {
    if (this._samples.length === 0) return 0;
    const sorted = [...this._samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  getDiagnostics(): Record<string, number> {
    return {
      offset: this._offset,
      samples: this._samples.length,
      lastSyncAgo: Date.now() - this._lastSyncAt,
      now: this.now,
      msToNext: this.msToNextCandle,
    };
  }
}
