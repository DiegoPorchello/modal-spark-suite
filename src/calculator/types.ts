export type Outcome = "WIN" | "LOSS" | "DRAW";

export interface RecoveryConfig {
  initialStake: number;
  payout: number;
  stopLoss: number;
  maxLevels: number;
}

export const DEFAULT_CONFIG: RecoveryConfig = {
  initialStake: 2,
  payout: 0.86,
  stopLoss: 50,
  maxLevels: 10,
};

export interface DynamicLevel {
  level: number;
  entry1Stake: number;
  entry2Stake: number;
  accumulatedLossAtEntry: number;
  recoveryBudgetAtEntry: number;
}

export interface FSMState {
  level: number;
  entry: 1 | 2;
  currentStake: number;
  state: string;
  recoveryBudget: number;
  accumulatedLoss: number;
  accumulatedProfit: number;
  netProfit: number;
  stopConsumed: number;
  stopAvailable: number;
  recoveryHealth: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  sessionStartTime: Date;
  levels: DynamicLevel[];
}

export interface SREv2Dashboard {
  initialStake: number;
  currentStake: number;
  nextStake: number;
  level: number;
  entry: 1 | 2;
  recoveryBudget: number;
  accumulatedLoss: number;
  accumulatedProfit: number;
  netProfit: number;
  stopConfigurado: number;
  stopConsumido: number;
  stopRestante: number;
  recoveryHealth: number;
  healthLabel: string;
  healthColor: string;
  payout: number;
  state: string;
  totalLevels: number;
  isStopAtingido: boolean;
}

export interface SREv2TableRow {
  level: number;
  entry: 1 | 2;
  stake: number;
  lucroEsperado: number;
  perdaAcumulada: number;
  valorARecuperar: number;
  stopRestante: number;
  status: string;
  isCurrent: boolean;
}

export interface FSMEntry {
  valor: number;
  level: number;
  entry: 1 | 2;
  isSoros: boolean;
}

export interface RecoveryHistoryEntry {
  timestamp: Date;
  asset: string;
  direction: "call" | "put";
  stake: number;
  profit: number;
  recoveryBudgetBefore: number;
  recoveryBudgetAfter: number;
  fsmState: string;
  result: Outcome;
}

export interface IRecoveryEngine {
  getEntradaAtual(): FSMEntry;
  registrarResultado(resultado: Outcome): void;
  getState(): FSMState;
  getDashboard(): SREv2Dashboard;
  getTableRows(): SREv2TableRow[];
  reset(): void;
  alterarConfiguracao(config: Partial<RecoveryConfig>): void;
  isStopAtingido(): boolean;
  isStopped(): boolean;
  getWinRate(): number;
  getSaldo(): number;
  getActiveLevels(): DynamicLevel[];
}
