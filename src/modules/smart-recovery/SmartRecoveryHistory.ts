import type { SorosGaleOperation, SorosGaleConfig, DailyBreakdown } from "./SmartRecoveryTypes";

export class SmartRecoveryHistory {
  private operations: SorosGaleOperation[] = [];
  private bankrollHistory: { time: string; value: number }[] = [];
  private cprHistory: { time: string; value: number }[] = [];
  private recoveryHistory: { time: string; value: number }[] = [];
  private stakeHistory: { time: string; value: number }[] = [];

  addOperation(op: SorosGaleOperation): void {
    this.operations.push(op);
  }

  addBankrollSnapshot(time: string, value: number): void {
    this.bankrollHistory.push({ time, value });
  }

  addCPRSnapshot(time: string, value: number): void {
    this.cprHistory.push({ time, value });
  }

  addRecoverySnapshot(time: string, value: number): void {
    this.recoveryHistory.push({ time, value });
  }

  addStakeSnapshot(time: string, value: number): void {
    this.stakeHistory.push({ time, value });
  }

  getOperations(): SorosGaleOperation[] {
    return [...this.operations];
  }

  getOperationCount(): number {
    return this.operations.length;
  }

  getLastN(n: number): SorosGaleOperation[] {
    return this.operations.slice(-n);
  }

  getWins(): SorosGaleOperation[] {
    return this.operations.filter((op) => op.result === "WIN");
  }

  getLosses(): SorosGaleOperation[] {
    return this.operations.filter((op) => op.result === "LOSS");
  }

  getConsecutiveSequence(): { wins: number; losses: number } {
    let wins = 0;
    let losses = 0;
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const op = this.operations[i];
      if (op.result === "WIN") {
        if (losses > 0) break;
        wins++;
      } else if (op.result === "LOSS") {
        if (wins > 0) break;
        losses++;
      } else {
        break;
      }
    }
    return { wins, losses };
  }

  getMaxConsecutiveLosses(): number {
    let max = 0;
    let current = 0;
    for (const op of this.operations) {
      if (op.result === "LOSS") {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    return max;
  }

  getMaxConsecutiveWins(): number {
    let max = 0;
    let current = 0;
    for (const op of this.operations) {
      if (op.result === "WIN") {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    return max;
  }

  getDailyBreakdown(): any[] {
    const grouped: Record<string, SorosGaleOperation[]> = {};
    for (const op of this.operations) {
      const date = op.timestamp.toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(op);
    }

    return Object.entries(grouped).map(([date, ops]) => {
      const wins = ops.filter((o) => o.result === "WIN").length;
      const losses = ops.filter((o) => o.result === "LOSS").length;
      const profit = ops.reduce((sum, o) => sum + o.profit, 0);
      const cprMax = Math.max(...ops.map((o) => o.cprBefore));
      const drawdown = this.calculateDailyDrawdown(ops);

      return {
        date,
        operations: ops.length,
        wins,
        losses,
        profit: parseFloat(profit.toFixed(2)),
        cprMax: parseFloat(cprMax.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(1)),
      };
    });
  }

  private calculateDailyDrawdown(ops: SorosGaleOperation[]): number {
    let peak = 0;
    let current = 0;
    let maxDD = 0;
    for (const op of ops) {
      current += op.profit;
      peak = Math.max(peak, current);
      const dd = peak > 0 ? ((peak - current) / peak) * 100 : 0;
      maxDD = Math.max(maxDD, dd);
    }
    return maxDD;
  }

  calculateSummary(bankroll: number, finalProfit: number, maxDD: number): any {
    const total = this.operations.length;
    const wins = this.getWins().length;
    const losses = this.getLosses().length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const roi = bankroll > 0 ? (finalProfit / bankroll) * 100 : 0;
    const avgCPR = this.calculateAvgCPR();
    const avgRecovery = this.calculateAvgRecovery();
    const avgTimeToClear = this.calculateAvgTimeToClearCPR();
    const cycles = this.countCycles();

    return {
      operations: total,
      winRate: parseFloat(winRate.toFixed(1)),
      roi: parseFloat(roi.toFixed(2)),
      drawdown: parseFloat(maxDD.toFixed(1)),
      avgCPR: parseFloat(avgCPR.toFixed(2)),
      avgRecovery: parseFloat(avgRecovery.toFixed(2)),
      avgTimeToClearCPR: parseFloat(avgTimeToClear.toFixed(0)),
      totalCycles: cycles,
      finalBankroll: parseFloat((bankroll + finalProfit).toFixed(2)),
      maxConsecutiveLosses: this.getMaxConsecutiveLosses(),
      totalWins: wins,
      totalLosses: losses,
      profitFactor: this.calculateProfitFactor(),
    };
  }

  private calculateAvgCPR(): number {
    if (this.operations.length === 0) return 0;
    const sum = this.operations.reduce((acc, op) => acc + op.cprBefore, 0);
    return sum / this.operations.length;
  }

  private calculateAvgRecovery(): number {
    const lossOps = this.operations.filter((o) => o.result === "LOSS");
    if (lossOps.length === 0) return 0;
    const sum = lossOps.reduce((acc, op) => acc + ((op as any).recoveryFactor || 0), 0);
    return sum / lossOps.length;
  }

  private calculateAvgTimeToClearCPR(): number {
    if (this.operations.length === 0) return 0;
    let totalTime = 0;
    let count = 0;
    let cprStart = -1;

    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];
      if (op.cprBefore > 0 && cprStart === -1) {
        cprStart = i;
      } else if (op.cprBefore === 0 && cprStart !== -1) {
        totalTime += i - cprStart;
        count++;
        cprStart = -1;
      }
    }

    return count > 0 ? (totalTime / count) * 60 : 0;
  }

  private countCycles(): number {
    let cycles = 0;
    for (const op of this.operations) {
      if (op.cprBefore === 0 && op.result === "WIN") {
        cycles++;
      }
    }
    return Math.max(1, cycles);
  }

  private calculateProfitFactor(): number {
    const totalProfit = this.operations
      .filter((o) => o.profit > 0)
      .reduce((sum, o) => sum + o.profit, 0);
    const totalLoss = Math.abs(
      this.operations.filter((o) => o.profit < 0).reduce((sum, o) => sum + o.profit, 0),
    );
    if (totalLoss === 0) return totalProfit > 0 ? Infinity : 0;
    return parseFloat((totalProfit / totalLoss).toFixed(2));
  }

  buildReportData(
    sessionId: string,
    startTime: Date,
    config: SorosGaleConfig,
    finalProfit: number,
    maxDD: number,
    bankroll: number,
  ): any {
    return {
      sessionId,
      startTime,
      endTime: new Date(),
      config,
      summary: this.calculateSummary(bankroll, finalProfit, maxDD),
      operations: [...this.operations],
      dailyBreakdown: this.getDailyBreakdown(),
      bankrollHistory: [...this.bankrollHistory],
      cprHistory: [...this.cprHistory],
      recoveryHistory: [...this.recoveryHistory],
      stakeHistory: [...this.stakeHistory],
    };
  }

  reset(): void {
    this.operations = [];
    this.bankrollHistory = [];
    this.cprHistory = [];
    this.recoveryHistory = [];
    this.stakeHistory = [];
  }
}
