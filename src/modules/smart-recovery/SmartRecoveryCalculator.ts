import type { SorosGaleConfig, SorosGaleState, LevelRow } from "./SmartRecoveryTypes";
import { DEFAULT_SOROS_CONFIG } from "./SmartRecoveryTypes";

export class SmartRecoveryCalculator {
  private config: SorosGaleConfig;

  constructor(config?: Partial<SorosGaleConfig>) {
    this.config = { ...DEFAULT_SOROS_CONFIG, ...config };
  }

  updateConfig(config: Partial<SorosGaleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SorosGaleConfig {
    return { ...this.config };
  }

  /**
   * Gera a tabela completa de níveis (0 até maxLevel).
   * Se config.customLevels[] for fornecido, usa entry1 = customLevels[level].
   * Caso contrário: níveis 0,1,2 = initialStake, nível 3+ = accLossBefore / 2
   */
  generateLevelTable(config?: SorosGaleConfig): LevelRow[] {
    const cfg = config ?? this.config;
    const table: LevelRow[] = [];
    let accLoss = 0;
    const hasCustomLevels = cfg.customLevels && cfg.customLevels.length > 0;

    for (let level = 0; level <= cfg.maxLevel; level++) {
      const accLossBefore = parseFloat(accLoss.toFixed(2));
      let entry1: number;

      if (hasCustomLevels && level < cfg.customLevels!.length) {
        entry1 = cfg.customLevels![level];
      } else if (level <= 2) {
        entry1 = cfg.initialStake;
      } else {
        entry1 = parseFloat((accLossBefore / 2).toFixed(2));
      }

      const profit1 = parseFloat((entry1 * cfg.payout).toFixed(2));
      const entry2 = parseFloat((entry1 + profit1).toFixed(2));
      const profit2 = parseFloat((entry2 * cfg.payout).toFixed(2));

      const accLossAfter = parseFloat((accLoss + entry1).toFixed(2));

      // Pode recuperar? Só se passar pelo SOROS (entry2):
      // Se entry1 ganhar (profit1) + entry2 ganhar (profit2) >= accLossAfter
      const totalRecovery = parseFloat((profit1 + profit2).toFixed(2));
      const canRecover = totalRecovery >= accLossAfter;

      table.push({
        level,
        entry1,
        profit1,
        entry2,
        profit2,
        accLossBefore,
        accLossAfter,
        canRecover,
      });

      // Para o próximo nível, o acumulado só aumenta com entry1 (entry2 não acumula)
      accLoss = accLossAfter;
    }

    return table;
  }

  /**
   * Busca a linha da tabela para um nível específico.
   */
  getLevelRow(level: number, table: LevelRow[]): LevelRow {
    const idx = Math.min(level, table.length - 1);
    return table[idx];
  }

  /**
   * Calcula o valor da entrada baseado no nível e fase atual.
   */
  calculateEntry1(level: number, table: LevelRow[]): number {
    return this.getLevelRow(level, table).entry1;
  }

  /**
   * Calcula a Entry 2 (SOROS) = entry1 + (entry1 × payout)
   */
  calculateEntry2(entry1: number, payout?: number): number {
    const p = payout ?? this.config.payout;
    return parseFloat((entry1 + entry1 * p).toFixed(2));
  }

  /**
   * Calcula profit de uma entrada
   */
  calculateProfit(stake: number, payout?: number): number {
    const p = payout ?? this.config.payout;
    return parseFloat((stake * p).toFixed(2));
  }

  /**
   * Encontra o primeiro nível onde a recuperação total (profit1 + profit2)
   * é >= accLossAfter. Retorna o level ou -1 se nenhum for suficiente.
   */
  findRecoveryLevel(accLoss: number, table: LevelRow[]): number {
    for (const row of table) {
      if (row.accLossAfter >= accLoss && row.canRecover) {
        return row.level;
      }
    }
    return -1;
  }

  // ── Utilitários de estado ──

  isStopLossAtingido(dailyLoss: number): boolean {
    return this.config.stopLoss > 0 && dailyLoss >= this.config.stopLoss;
  }

  isStopWinAtingido(dailyProfit: number): boolean {
    return this.config.stopWin > 0 && dailyProfit >= this.config.stopWin;
  }

  canOperate(state: SorosGaleState): boolean {
    if (state.phase === "STOP" || state.phase === "FINALIZADO") return false;
    if (this.isStopLossAtingido(state.dailyLoss)) return false;
    if (this.isStopWinAtingido(state.dailyProfit)) return false;
    return true;
  }

  calculateWinRate(wins: number, total: number): number {
    if (total === 0) return 0;
    return parseFloat(((wins / total) * 100).toFixed(1));
  }

  generateSessionId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `SG-${ts}-${rand}`.toUpperCase();
  }

  formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2)}`;
  }

  formatTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
}
