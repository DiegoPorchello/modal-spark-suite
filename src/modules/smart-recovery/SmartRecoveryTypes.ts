export type SorosGalePhase = "IDLE" | "WAIT" | "ENTRY_1" | "SOROS" | "STOP" | "FINALIZADO";

export type OperationOutcome = "WIN" | "LOSS" | "DRAW";

export interface SorosGaleConfig {
  bankroll: number;
  initialStake: number;
  payout: number;
  stopLoss: number;
  stopWin: number;
  maxLevel: number;
  customLevels?: number[];
}

export const DEFAULT_SOROS_CONFIG: SorosGaleConfig = {
  bankroll: 1000,
  initialStake: 2,
  payout: 0.87,
  stopLoss: 100,
  stopWin: 50,
  maxLevel: 15,
};

export interface LevelRow {
  level: number;
  entry1: number;
  profit1: number;
  entry2: number;
  profit2: number;
  accLossBefore: number;
  accLossAfter: number;
  canRecover: boolean;
}

export interface SorosGaleState {
  phase: SorosGalePhase;
  currentLevel: number;
  entryNumber: 1 | 2;
  bankroll: number;
  dailyProfit: number;
  dailyLoss: number;
  capitalPending: number;
  lastEntry1Profit: number;
  sessionProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  winRate: number;
  isStopAtingido: boolean;
  levelTable: LevelRow[];
  sessionStartTime: Date;
  lastOperationTime: Date | null;
}

export interface SorosGaleEntry {
  valor: number;
  level: number;
  entry: 1 | 2;
  isSoros: boolean;
  capitalPending: number;
}

export interface SorosGaleOperation {
  id: string;
  timestamp: Date;
  hour: string;
  asset: string;
  direction: "call" | "put";
  stake: number;
  payout: number;
  cprBefore: number;
  cprAfter: number;
  result: OperationOutcome;
  profit: number;
  sessionProfit: number;
  entryNumber: 1 | 2;
  level: number;
}

export interface SorosGaleDashboard {
  initialStake: number;
  bankroll: number;
  sessionProfit: number;
  capitalPending: number;
  currentStake: number;
  nextStake: number;
  payout: number;
  dailyLoss: number;
  dailyProfit: number;
  stopLoss: number;
  stopWin: number;
  stopLossRemaining: number;
  stopWinRemaining: number;
  winRate: number;
  phase: SorosGalePhase;
  currentLevel: number;
  entryNumber: 1 | 2;
  isSoros: boolean;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  isStopAtingido: boolean;
  isMetaBatida: boolean;
  levelTable: LevelRow[];
}

// Tipos adicionais para simulação/relatório
export interface SorosGaleSimulationResult {
  simulationId: string;
  config: SorosGaleConfig;
  operations: SorosGaleOperation[];
  finalBankroll: number;
  totalProfit: number;
  maxDrawdown: number;
  winRate: number;
}

export interface SorosGaleBacktestResult {
  backtestId: string;
  config: SorosGaleConfig;
  operations: SorosGaleOperation[];
  finalBankroll: number;
  totalProfit: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
}

export interface SorosGaleReportData {
  reportId: string;
  period: { start: Date; end: Date };
  config: SorosGaleConfig;
  operations: SorosGaleOperation[];
  finalBankroll: number;
  totalProfit: number;
  maxDrawdown: number;
  winRate: number;
  dailyBreakdown: DailyBreakdown[];
}

export interface DailyBreakdown {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  profit: number;
  bankroll: number;
}

export const DEFAULT_SMART_RECOVERY_CONFIG = DEFAULT_SOROS_CONFIG;

// Manter exportações antigas para compatibilidade
export type SmartRecoveryPhase = SorosGalePhase;
export type SmartRecoveryConfig = SorosGaleConfig;
export type SmartRecoveryState = SorosGaleState;
export type SmartRecoveryEntry = SorosGaleEntry;
export type SmartRecoveryOperation = SorosGaleOperation;
export type SmartRecoveryDashboard = SorosGaleDashboard;
export type SmartRecoverySimulationResult = SorosGaleSimulationResult;
export type SmartRecoveryBacktestResult = SorosGaleBacktestResult;
export type SmartRecoveryReportData = SorosGaleReportData;
export type AIFinancialDecision = {
  action: "continue" | "reduce-stake" | "pause" | "adjust-recovery" | "stop-session";
  reason: string;
  confidence: number;
  suggestedStake?: number;
  suggestedRecoveryFactor?: number;
  timestamp: Date;
};
