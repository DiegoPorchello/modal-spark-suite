import type {
  SmartRecoveryConfig,
  SmartRecoverySimulationResult,
  SmartRecoveryOperation,
  SmartRecoveryState,
  SorosGaleConfig,
  SorosGaleState,
  SorosGaleOperation,
} from "./SmartRecoveryTypes";
import { DEFAULT_SOROS_CONFIG } from "./SmartRecoveryTypes";
import { SmartRecoveryCalculator } from "./SmartRecoveryCalculator";
import { SmartRecoveryHistory } from "./SmartRecoveryHistory";

export class SmartRecoverySimulator {
  private calculator: SmartRecoveryCalculator;

  constructor() {
    this.calculator = new SmartRecoveryCalculator();
  }

  run(config: Partial<SorosGaleConfig>, numOperations: number, winRatePercent: number = 55): any {
    this.calculator.updateConfig(config);
    const fullConfig = this.calculator.getConfig();
    const history = new SmartRecoveryHistory();
    const levelTable = this.calculator.generateLevelTable(fullConfig);

    const state: SorosGaleState = this.createInitialState(fullConfig, levelTable);
    let peakProfit = 0;
    let maxDrawdown = 0;

    for (let i = 0; i < numOperations; i++) {
      const row = this.calculator.getLevelRow(state.currentLevel, levelTable);
      const stake = state.entryNumber === 1 ? row.entry1 : row.entry2;
      if (stake <= 0) break;

      const outcome = Math.random() * 100 < winRatePercent ? "WIN" : "LOSS";
      const profit = this.calculator.calculateProfit(stake, fullConfig.payout);

      const cprBefore = state.capitalPending;
      let cprAfter = state.capitalPending;

      if (outcome === "LOSS") {
        cprAfter = state.capitalPending + stake;
        state.dailyLoss += stake;
        state.consecutiveLosses++;
        state.consecutiveWins = 0;
        state.maxConsecutiveLosses = Math.max(state.maxConsecutiveLosses, state.consecutiveLosses);
        state.currentLevel++;
        state.entryNumber = 1;
        state.lastEntry1Profit = 0;
        state.phase = "ENTRY_1";
      } else {
        if (state.entryNumber === 1) {
          state.entryNumber = 2;
          state.lastEntry1Profit = profit;
          state.consecutiveWins++;
          state.consecutiveLosses = 0;
          state.maxConsecutiveWins = Math.max(state.maxConsecutiveWins, state.consecutiveWins);
          state.phase = "SOROS";
        } else {
          const totalProfit = state.lastEntry1Profit + profit;
          cprAfter = Math.max(0, state.capitalPending - totalProfit);
          state.dailyProfit += totalProfit;
          state.consecutiveWins++;
          state.consecutiveLosses = 0;
          state.maxConsecutiveWins = Math.max(state.maxConsecutiveWins, state.consecutiveWins);

          if (cprAfter <= 0) {
            state.currentLevel = 0;
            state.entryNumber = 1;
            state.lastEntry1Profit = 0;
            state.phase = "IDLE";
          } else {
            state.entryNumber = 1;
            state.phase = "ENTRY_1";
          }
        }
      }

      state.capitalPending = cprAfter;
      state.sessionProfit += profit;

      const op: any = {
        id: `sim-${i}`,
        timestamp: new Date(),
        hour: new Date().toLocaleTimeString("pt-BR"),
        asset: "",
        direction: Math.random() > 0.5 ? "call" : "put",
        stake,
        payout: fullConfig.payout,
        cprBefore,
        cprAfter,
        result: outcome,
        profit,
        sessionProfit: state.sessionProfit,
        entryNumber: state.entryNumber,
        level: state.currentLevel,
        aiConfidence: Math.floor(Math.random() * 40) + 60,
        aiReason: outcome === "WIN" ? "Padrão confirmado" : "Padrão falhou",
        robotState: `N${state.currentLevel}-E${state.entryNumber}`,
        sessionCycle: i + 1,
      };

      history.addOperation(op);

      peakProfit = Math.max(peakProfit, state.sessionProfit);
      const dd =
        peakProfit > 0
          ? parseFloat((((peakProfit - state.sessionProfit) / peakProfit) * 100).toFixed(1))
          : 0;
      maxDrawdown = Math.max(maxDrawdown, dd);
    }

    return history.calculateSummary(fullConfig.bankroll, state.sessionProfit, maxDrawdown);
  }

  runMultiple(
    config: Partial<SorosGaleConfig>,
    numOperations: number,
    simulations: number,
    winRatePercent: number = 55,
  ): any {
    const results: any[] = [];

    for (let i = 0; i < simulations; i++) {
      results.push(this.run(config, numOperations, winRatePercent));
    }

    return this.averageResults(results);
  }

  private averageResults(results: any[]): any {
    const n = results.length;
    if (n === 0) {
      return this.emptyResult();
    }

    return {
      operations: Math.round(results.reduce((s: number, r: any) => s + r.operations, 0) / n),
      winRate: parseFloat((results.reduce((s: number, r: any) => s + r.winRate, 0) / n).toFixed(1)),
      roi: parseFloat((results.reduce((s: number, r: any) => s + r.roi, 0) / n).toFixed(2)),
      drawdown: parseFloat(
        (results.reduce((s: number, r: any) => s + r.drawdown, 0) / n).toFixed(1),
      ),
      avgCPR: parseFloat((results.reduce((s: number, r: any) => s + r.avgCPR, 0) / n).toFixed(2)),
      avgRecovery: parseFloat(
        (results.reduce((s: number, r: any) => s + r.avgRecovery, 0) / n).toFixed(2),
      ),
      avgTimeToClearCPR: parseFloat(
        (results.reduce((s: number, r: any) => s + r.avgTimeToClearCPR, 0) / n).toFixed(0),
      ),
      totalCycles: Math.round(results.reduce((s: number, r: any) => s + r.totalCycles, 0) / n),
      finalBankroll: parseFloat(
        (results.reduce((s: number, r: any) => s + r.finalBankroll, 0) / n).toFixed(2),
      ),
      maxConsecutiveLosses: Math.max(...results.map((r: any) => r.maxConsecutiveLosses)),
      totalWins: Math.round(results.reduce((s: number, r: any) => s + r.totalWins, 0) / n),
      totalLosses: Math.round(results.reduce((s: number, r: any) => s + r.totalLosses, 0) / n),
      profitFactor: parseFloat(
        (results.reduce((s: number, r: any) => s + r.profitFactor, 0) / n).toFixed(2),
      ),
    };
  }

  private emptyResult(): any {
    return {
      operations: 0,
      winRate: 0,
      roi: 0,
      drawdown: 0,
      avgCPR: 0,
      avgRecovery: 0,
      avgTimeToClearCPR: 0,
      totalCycles: 0,
      finalBankroll: 0,
      maxConsecutiveLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      profitFactor: 0,
    };
  }

  private createInitialState(config: SorosGaleConfig, levelTable: any[]): SorosGaleState {
    return {
      phase: "IDLE",
      currentLevel: 0,
      entryNumber: 1,
      bankroll: config.bankroll,
      dailyProfit: 0,
      dailyLoss: 0,
      capitalPending: 0,
      lastEntry1Profit: 0,
      sessionProfit: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      winRate: 0,
      isStopAtingido: false,
      levelTable,
      sessionStartTime: new Date(),
      lastOperationTime: null,
    };
  }
}
