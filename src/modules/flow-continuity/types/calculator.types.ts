import type { OperationDirection } from "./executor.types";

/**
 * calculator.types.ts
 *
 * Tipos da Calculadora Sorosgale — gerenciamento de banca e estratégia
 * de recuperação progressiva. Define níveis de entrada, valores
 * e regras de progressão/regressão entre níveis.
 */

/** Configuração completa da estratégia Sorosgale */
export interface SorosgaleConfig {
  initialBankroll: number;
  currentBankroll: number;
  strategy: SorosgaleStrategy;
  baseEntryPercent: number;
  sorosMultiplier: number;
  maxLevel: number;
  targetProfit: number;
  stopLoss: number;
  currency: string;
}

export type SorosgaleStrategy = "fractional" | "full" | "custom";

/** Nível individual do Sorosgale */
export interface SorosgaleLevel {
  level: number;
  firstEntry: number;
  secondEntrySoros: number;
  totalValue: number;
  status: LevelStatus;
  payoutAtWin: number;
  payoutAtLoss: number;
}

export type LevelStatus = "inactive" | "active" | "recovering" | "completed" | "lost";

/** Estado ao vivo dos níveis durante operação */
export interface LiveLevelState {
  level: SorosgaleLevel;
  currentEntry: 1 | 2;
  timeLeft: number;
  direction: OperationDirection;
}

/** Resultado de uma simulação da calculadora */
export interface CalculatorSimulation {
  config: SorosgaleConfig;
  levels: SorosgaleLevel[];
  projectedProfit: number;
  projectedLoss: number;
  maxDrawdown: number;
  recoveryFactor: number;
}

/** Histórico de mudanças de nível */
export interface LevelChangeEvent {
  fromLevel: number;
  toLevel: number;
  reason: "win" | "loss" | "manual" | "reset";
  bankrollAfter: number;
  timestamp: string;
}
