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
      } else if (level <= 0) {
        entry1 = cfg.initialStake;
      } else {
        const recovery = accLossBefore / 2;
        const minStake = parseFloat((cfg.initialStake * (1 + level * 0.3)).toFixed(2));
        entry1 = parseFloat(Math.max(recovery, minStake).toFixed(2));
      }

      const profit1 = parseFloat((entry1 * cfg.payout).toFixed(2));
      const entry2 = parseFloat((entry1 + profit1).toFixed(2));
      const profit2 = parseFloat((entry2 * cfg.payout).toFixed(2));

      const accLossAfter = parseFloat((accLoss + entry1).toFixed(2));

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

      accLoss = accLossAfter;
    }

    return table;
  }

  getLevelRow(level: number, table: LevelRow[]): LevelRow {
    const idx = Math.min(level, table.length - 1);
    return table[idx];
  }

  calculateEntry1(level: number, table: LevelRow[]): number {
    return this.getLevelRow(level, table).entry1;
  }

  calculateEntry2(entry1: number, payout: number): number {
    return parseFloat((entry1 + entry1 * payout).toFixed(2));
  }

  calculateProfit(stake: number, payout: number): number {
    return parseFloat((stake * payout).toFixed(2));
  }

  findRecoveryLevel(accLoss: number, table: LevelRow[]): number {
    for (const row of table) {
      if (row.accLossAfter >= accLoss && row.canRecover) {
        return row.level;
      }
    }
    return -1;
  }

  isStopLossAtingido(dailyLoss: number, stopLoss: number): boolean {
    return stopLoss > 0 && dailyLoss >= stopLoss;
  }

  isStopWinAtingido(dailyProfit: number, stopWin: number): boolean {
    return stopWin > 0 && dailyProfit >= stopWin;
  }

  canOperate(state: SorosGaleState, stopLoss: number, stopWin: number): boolean {
    if (state.phase === "STOP" || state.phase === "FINALIZADO") return false;
    if (this.isStopLossAtingido(state.dailyLoss, stopLoss)) return false;
    if (this.isStopWinAtingido(state.dailyProfit, stopWin)) return false;
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
