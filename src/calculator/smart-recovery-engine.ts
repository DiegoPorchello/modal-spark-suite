import type {
  RecoveryConfig,
  Outcome,
  DynamicLevel,
  FSMState,
  SREv2Dashboard,
  SREv2TableRow,
  FSMEntry,
  IRecoveryEngine,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

export class SmartRecoveryEngine implements IRecoveryEngine {
  private config: RecoveryConfig;
  private state: FSMState;

  constructor(config?: Partial<RecoveryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  getEntradaAtual(): FSMEntry {
    const stake = this.getCurrentStake();
    return {
      valor: stake,
      level: this.state.level,
      entry: this.state.entry,
      isSoros: this.state.entry === 2,
    };
  }

  registrarResultado(resultado: Outcome): void {
    if (this.isStopped()) return;

    const stake = this.getCurrentStake();
    const profit = resultado === "WIN" ? stake * this.config.payout : -stake;

    if (resultado === "WIN") {
      this.handleWin(profit, stake);
    } else {
      this.handleLoss(stake);
    }

    this.updateStats();
    this.state.currentStake = this.getCurrentStake();
    this.state.state = this.getFSMStateLabel();
    this.updateStopTracking();
  }

  getState(): FSMState {
    return { ...this.state, levels: [...this.state.levels] };
  }

  getDashboard(): SREv2Dashboard {
    const s = this.state;
    const next = this.calcNextStake();
    const { label, color } = this.getHealthInfo(s.recoveryHealth);

    return {
      initialStake: this.config.initialStake,
      currentStake: s.currentStake,
      nextStake: next > 0 ? next : 0,
      level: s.level,
      entry: s.entry,
      recoveryBudget: s.recoveryBudget,
      accumulatedLoss: s.accumulatedLoss,
      accumulatedProfit: s.accumulatedProfit,
      netProfit: s.netProfit,
      stopConfigurado: this.config.stopLoss,
      stopConsumido: s.stopConsumed,
      stopRestante: s.stopAvailable,
      recoveryHealth: s.recoveryHealth,
      healthLabel: label,
      healthColor: color,
      payout: this.config.payout,
      state: this.getFSMStateLabel(),
      totalLevels: s.levels.length,
      isStopAtingido: s.state === "STOP",
    };
  }

  getTableRows(): SREv2TableRow[] {
    const rows: SREv2TableRow[] = [];
    const s = this.state;

    for (const lv of s.levels) {
      for (const e of [1, 2] as const) {
        const stake = e === 1 ? lv.entry1Stake : lv.entry2Stake;
        const isCurrent = lv.level === s.level && e === s.entry;
        const lossAtThisPoint = lv.accumulatedLossAtEntry;

        rows.push({
          level: lv.level,
          entry: e,
          stake,
          lucroEsperado: parseFloat((stake * this.config.payout).toFixed(2)),
          perdaAcumulada: lossAtThisPoint,
          valorARecuperar: s.recoveryBudget,
          stopRestante: parseFloat((this.config.stopLoss - s.stopConsumed).toFixed(2)),
          status: isCurrent
            ? e === 2
              ? "SOROS"
              : "OPERANDO"
            : lv.level < s.level || (lv.level === s.level && e < s.entry)
              ? "FINALIZADO"
              : "AGUARDANDO",
          isCurrent,
        });
      }
    }

    return rows;
  }

  getActiveLevels(): DynamicLevel[] {
    return [...this.state.levels];
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  alterarConfiguracao(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateStopTracking();
  }

  isStopAtingido(): boolean {
    return this.state.state === "STOP";
  }

  isStopped(): boolean {
    return this.state.state === "STOP" || this.state.state === "FINALIZADO";
  }

  getWinRate(): number {
    return this.state.winRate;
  }

  getSaldo(): number {
    return this.state.netProfit;
  }

  private getCurrentStake(): number {
    if (this.state.entry === 1) {
      if (this.state.level === 0 && this.state.recoveryBudget <= 0) {
        return this.config.initialStake;
      }
      const raw = this.state.recoveryBudget / this.config.payout;
      return Math.max(this.config.initialStake, Math.ceil(raw * 100) / 100);
    }
    const e1Stake = this.getEntry1StakeAtLevel(this.state.level);
    return parseFloat((e1Stake + e1Stake * this.config.payout).toFixed(2));
  }

  private getEntry1StakeAtLevel(level: number): number {
    if (level === 0 && this.state.recoveryBudget <= 0) {
      return this.config.initialStake;
    }
    const raw = this.state.recoveryBudget / this.config.payout;
    return Math.max(this.config.initialStake, Math.ceil(raw * 100) / 100);
  }

  private calcNextStake(): number {
    const raw = this.state.recoveryBudget / this.config.payout;
    const stake = Math.max(this.config.initialStake, Math.ceil(raw * 100) / 100);
    if (this.state.stopConsumed + stake > this.config.stopLoss) return -1;
    if (this.state.level + 1 >= this.config.maxLevels) return -1;
    return stake;
  }

  private handleWin(profit: number, _stake: number): void {
    this.state.totalWins++;

    if (this.state.entry === 1) {
      this.state.accumulatedProfit += profit;
      this.state.netProfit += profit;
      this.state.entry = 2;
      return;
    }

    this.state.accumulatedProfit += profit;
    this.state.netProfit += profit;
    this.state.recoveryBudget = Math.max(0, this.state.recoveryBudget - profit);

    if (this.state.recoveryBudget <= 0) {
      this.state.level = 0;
      this.state.entry = 1;
      this.state.accumulatedLoss = 0;
      this.state.stopConsumed = 0;
      this.state.levels = [];
      this.addLevelToHistory();
      return;
    }

    this.state.entry = 1;
  }

  private handleLoss(stake: number): void {
    this.state.totalLosses++;
    this.state.accumulatedLoss += stake;
    this.state.netProfit -= stake;
    this.state.stopConsumed += stake;
    this.state.recoveryBudget += stake;

    this.updateStopTracking();

    if (this.state.stopConsumed >= this.config.stopLoss) {
      this.state.state = "STOP";
      return;
    }

    if (this.state.level + 1 >= this.config.maxLevels) {
      this.state.state = "FINALIZADO";
      return;
    }

    const nextStake = this.calcNextStake();
    if (nextStake <= 0 || this.state.stopConsumed + nextStake > this.config.stopLoss) {
      this.state.state = "STOP";
      return;
    }

    this.state.level++;
    this.state.entry = 1;
    this.addLevelToHistory();
  }

  private addLevelToHistory(): void {
    const e1Stake = this.getEntry1StakeAtLevel(this.state.level);
    const e2Stake = parseFloat((e1Stake + e1Stake * this.config.payout).toFixed(2));

    const exists = this.state.levels.some((l) => l.level === this.state.level);
    if (exists) {
      const idx = this.state.levels.findIndex((l) => l.level === this.state.level);
      this.state.levels[idx] = {
        level: this.state.level,
        entry1Stake: e1Stake,
        entry2Stake: e2Stake,
        accumulatedLossAtEntry: this.state.accumulatedLoss,
        recoveryBudgetAtEntry: this.state.recoveryBudget,
      };
      return;
    }

    this.state.levels.push({
      level: this.state.level,
      entry1Stake: e1Stake,
      entry2Stake: e2Stake,
      accumulatedLossAtEntry: this.state.accumulatedLoss,
      recoveryBudgetAtEntry: this.state.recoveryBudget,
    });
    this.state.levels.sort((a, b) => a.level - b.level);
  }

  private getFSMStateLabel(): string {
    if (this.state.state === "STOP") return "STOP";
    if (this.state.state === "FINALIZADO") return "FINALIZADO";
    return `N${this.state.level}-E${this.state.entry}`;
  }

  private updateStopTracking(): void {
    this.state.stopAvailable = Math.max(0, this.config.stopLoss - this.state.stopConsumed);
    this.state.recoveryHealth =
      this.config.stopLoss > 0
        ? Math.round((this.state.stopAvailable / this.config.stopLoss) * 100)
        : 100;
  }

  private getHealthInfo(health: number): { label: string; color: string } {
    if (health >= 80) return { label: "Confortável", color: "text-success" };
    if (health >= 60) return { label: "Atenção", color: "text-warning" };
    if (health >= 30) return { label: "Crítico", color: "text-orange-500" };
    return { label: "Limite atingido", color: "text-danger" };
  }

  private updateStats(): void {
    const total = this.state.totalWins + this.state.totalLosses;
    this.state.winRate = total > 0 ? (this.state.totalWins / total) * 100 : 0;
  }

  private createInitialState(): FSMState {
    return {
      level: 0,
      entry: 1,
      currentStake: this.config.initialStake,
      state: "N0-E1",
      recoveryBudget: 0,
      accumulatedLoss: 0,
      accumulatedProfit: 0,
      netProfit: 0,
      stopConsumed: 0,
      stopAvailable: this.config.stopLoss,
      recoveryHealth: 100,
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      sessionStartTime: new Date(),
      levels: [],
    };
  }
}

export default SmartRecoveryEngine;
