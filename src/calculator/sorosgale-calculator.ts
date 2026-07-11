import type {
  RecoveryConfig,
  FSMState,
  SREv2Dashboard,
  SREv2TableRow,
  DynamicLevel,
} from "./types";
import { SmartRecoveryEngine } from "./smart-recovery-engine";

export class SorosGaleCalculator {
  private engine: SmartRecoveryEngine;
  private niveisCustomizados: number[] = [];

  constructor(saldoInicial = 1000, niveis?: number[], payout?: number) {
    const config: Partial<RecoveryConfig> = {
      payout: payout ?? 0.86,
    };
    this.engine = new SmartRecoveryEngine(config);
    if (niveis && niveis.length > 0) {
      this.niveisCustomizados = [...niveis];
    }
  }

  updateLevels(niveis: number[]): void {
    this.niveisCustomizados = [...niveis];
  }

  setPayout(payout: number): void {
    this.engine.alterarConfiguracao({ payout });
  }

  getPayout(): number {
    return this.engine.getDashboard().payout;
  }

  getLevels(): number[] {
    if (this.niveisCustomizados.length > 0) return [...this.niveisCustomizados];
    return [this.engine.getDashboard().initialStake];
  }

  getEntradaAtual(): { valor: number; level: number; entry: number; isSoros: boolean } {
    const entry = this.engine.getEntradaAtual();
    return {
      valor: entry.valor,
      level: entry.level,
      entry: entry.entry,
      isSoros: entry.isSoros,
    };
  }

  registrarWin(): void {
    this.engine.registrarResultado("WIN");
  }

  registrarLoss(): void {
    this.engine.registrarResultado("LOSS");
  }

  reset(): void {
    this.engine.reset();
  }

  stop(): boolean {
    return this.engine.isStopped();
  }

  getState() {
    return this.engine.getState();
  }

  getSaldo(): number {
    return this.engine.getSaldo();
  }

  getNivel(): number {
    return this.engine.getState().level + 1;
  }

  getWinRate(): number {
    return this.engine.getWinRate();
  }

  getSREState(): FSMState {
    return this.engine.getState();
  }

  getSRESummary(): SREv2Dashboard {
    return this.engine.getDashboard();
  }

  getTableRows(): SREv2TableRow[] {
    return this.engine.getTableRows();
  }

  getActiveLevels(): DynamicLevel[] {
    return this.engine.getActiveLevels();
  }

  updateConfig(config: Partial<RecoveryConfig>): void {
    this.engine.alterarConfiguracao(config);
  }
}

export default SorosGaleCalculator;
