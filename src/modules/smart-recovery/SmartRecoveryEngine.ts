import type {
  SorosGaleConfig,
  SorosGaleState,
  SorosGalePhase,
  SorosGaleEntry,
  SorosGaleOperation,
  SorosGaleDashboard,
  LevelRow,
  AIFinancialDecision,
  OperationOutcome,
} from "./SmartRecoveryTypes";
import { DEFAULT_SOROS_CONFIG } from "./SmartRecoveryTypes";
import { SmartRecoveryCalculator } from "./SmartRecoveryCalculator";
import { SmartRecoveryHistory } from "./SmartRecoveryHistory";

const sreLogger = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(`[SmartRecoveryEngine] ${msg}`, data ?? ""),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.warn(`[SmartRecoveryEngine] ⚠️ ${msg}`, data ?? ""),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[SmartRecoveryEngine] ❌ ${msg}`, data ?? ""),
};

export type SmartRecoveryListener = (event: {
  type: string;
  state: SorosGaleState;
  operation?: SorosGaleOperation;
  decision?: AIFinancialDecision;
  message?: string;
}) => void;

export class SmartRecoveryEngine {
  private config: SorosGaleConfig;
  private state: SorosGaleState;
  private calculator: SmartRecoveryCalculator;
  private listeners: SmartRecoveryListener[] = [];
  private operationCounter = 0;
  private history: SmartRecoveryHistory;

  constructor(config?: Partial<SorosGaleConfig>) {
    this.config = { ...DEFAULT_SOROS_CONFIG, ...config };
    this.calculator = new SmartRecoveryCalculator(this.config);
    this.state = this.createInitialState();
    this.history = new SmartRecoveryHistory();
  }

  on(listener: SmartRecoveryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(
    type: string,
    operation?: SorosGaleOperation,
    decision?: AIFinancialDecision,
    message?: string,
  ): void {
    const event = { type, state: this.getState(), operation, decision, message };
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch {
        /* silent */
      }
    });
  }

  // ═══════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════

  getCurrentStake(): number {
    return this.getEntry().valor;
  }

  getNextStake(): number {
    const entry = this.getEntry();
    if (entry.isSoros) {
      // Se estamos em SOROS, a próxima entry1 seria do nível atual
      const row = this.calculator.getLevelRow(this.state.currentLevel, this.state.levelTable);
      return row.entry1;
    }
    // Se estamos em ENTRY_1, a próxima entry seria SOROS se vencer
    if (this.state.entryNumber === 1) {
      return this.calculator.calculateEntry2(entry.valor);
    }
    return entry.valor;
  }

  canOperate(): boolean {
    return this.calculator.canOperate(this.state);
  }

  registerWin(direction: "call" | "put", payout?: number): SorosGaleOperation {
    const p = payout ?? this.config.payout;
    const entry = this.getEntry();
    const stake = entry.valor;
    const profit = parseFloat((stake * p).toFixed(2));
    const cprBefore = this.state.capitalPending;
    const currentEntry = this.state.entryNumber;
    const currentLevel = this.state.currentLevel;
    console.log(`[SR-DEBUG] registerWin chamado! levelAntes=${currentLevel} entry=${currentEntry} stake=R$${stake.toFixed(2)} profit=R$${profit.toFixed(2)}`);

    if (currentEntry === 1) {
      console.log("[SOROS STATE]", {
        event: "WIN_ENTRY1",
        previousLevel: currentLevel,
        currentLevel: currentLevel,
        previousEntry: 1,
        currentEntry: 2,
        previousStake: stake,
        nextStake: this.getCurrentStake(),
        capitalPending: this.state.capitalPending,
      });
    } else {
      console.log("[SOROS STATE]", {
        event: "WIN_ENTRY2",
        previousLevel: currentLevel,
        currentLevel: 0,
        previousEntry: 2,
        currentEntry: 1,
        previousStake: stake,
        nextStake: this.getCurrentStake(),
        capitalPending: this.state.capitalPending,
      });
    }

    this.state.totalWins++;
    this.state.consecutiveWins++;
    this.state.consecutiveLosses = 0;

    if (currentEntry === 1) {
      // ── ENTRY 1 WON → vai para SOROS ──
      this.state.lastEntry1Profit = profit;
      this.state.entryNumber = 2;
      this.state.phase = "SOROS";

      this.emit(
        "entry1.win",
        undefined,
        undefined,
        `Entry 1 WIN: +R$ ${profit.toFixed(2)}. Partindo para SOROS.`,
      );

      const op = this.buildOperation(direction, "WIN", stake, profit, cprBefore, cprBefore, currentEntry, currentLevel);
      this.history.addOperation(op);
      this.operationCounter++;
      this.state.lastOperationTime = new Date();
      return op;
    }

    // ── SOROS (ENTRY 2) WON → ciclo completo, reseta tudo ──
    const totalProfit = parseFloat((this.state.lastEntry1Profit + profit).toFixed(2));
    const cprAfter = Math.max(0, parseFloat((this.state.capitalPending - totalProfit).toFixed(2)));

    this.state.dailyProfit = parseFloat((this.state.dailyProfit + totalProfit).toFixed(2));
    this.state.sessionProfit = parseFloat((this.state.sessionProfit + totalProfit).toFixed(2));
    this.state.capitalPending = cprAfter;
    this.state.lastEntry1Profit = 0;

    // ══ REGRA: Entry 2 WON → SEMPRE reseta nivel=0, entry=1 ══
    this.state.currentLevel = 0;
    this.state.entryNumber = 1;
    this.state.phase = "WAIT";

    this.emit(
      "cpr.cleared",
      undefined,
      undefined,
      `Ciclo completo! Lucro total: R$ ${totalProfit.toFixed(2)}. Resetado para Nivel 0, Entry 1.`,
    );

    const op = this.buildOperation(direction, "WIN", stake, profit, cprBefore, cprAfter, currentEntry, currentLevel);
    op.sessionProfit = parseFloat(this.state.sessionProfit.toFixed(2));
    this.history.addOperation(op);
    this.operationCounter++;
    this.state.lastOperationTime = new Date();

    this.emit(
      "result.win",
      op,
      undefined,
      `SOROS WIN! Lucro: +R$ ${profit.toFixed(2)}. Total ciclo: +R$ ${totalProfit.toFixed(2)}. Reset Nivel 0.`,
    );
    return op;
  }

  registerLoss(direction: "call" | "put"): SorosGaleOperation {
    const entry = this.getEntry();
    const stake = entry.valor;
    const cprBefore = this.state.capitalPending;
    const currentEntry = this.state.entryNumber;
    const currentLevel = this.state.currentLevel;
    console.log(`[SR-DEBUG] registerLoss chamado! levelAntes=${currentLevel} entry=${currentEntry} stake=R$${stake.toFixed(2)}`);

    if (currentEntry === 1) {
      console.log("[SOROS STATE]", {
        event: "LOSS_ENTRY1",
        previousLevel: currentLevel,
        currentLevel: this.state.currentLevel + 1,
        previousEntry: 1,
        currentEntry: 1,
        previousStake: stake,
        nextStake: this.getCurrentStake(),
        capitalPending: this.state.capitalPending + stake,
      });
    } else {
      console.log("[SOROS STATE]", {
        event: "LOSS_ENTRY2",
        previousLevel: currentLevel,
        currentLevel: this.state.currentLevel + 1,
        previousEntry: 2,
        currentEntry: 1,
        previousStake: stake,
        nextStake: this.getCurrentStake(),
        capitalPending: this.state.capitalPending,
      });
    }

    this.state.totalLosses++;
    this.state.consecutiveLosses++;
    this.state.consecutiveWins = 0;

    if (currentEntry === 1) {
      // ── ENTRY 1 LOSS → acumula prejuízo e sobe nível ──
      const cprAfter = parseFloat((this.state.capitalPending + stake).toFixed(2));
      this.state.dailyLoss = parseFloat((this.state.dailyLoss + stake).toFixed(2));
      this.state.sessionProfit = parseFloat((this.state.sessionProfit - stake).toFixed(2));
      this.state.capitalPending = cprAfter;
      this.state.currentLevel++;
      this.state.lastEntry1Profit = 0;
      this.state.entryNumber = 1;
      this.state.phase = "WAIT";

      if (this.calculator.isStopLossAtingido(this.state.dailyLoss)) {
        this.state.phase = "STOP";
        this.state.isStopAtingido = true;
        this.emit("risk.stop-loss");
      }

      const op = this.buildOperation(direction, "LOSS", stake, -stake, cprBefore, cprAfter, currentEntry, currentLevel);
      this.history.addOperation(op);
      this.operationCounter++;
      this.state.lastOperationTime = new Date();

      this.emit(
        "result.loss",
        op,
        undefined,
        `LOSS. Perda: -R$ ${stake.toFixed(2)}. CPR: R$ ${cprAfter.toFixed(2)}`,
      );
      return op;
    }

    // ── SOROS (ENTRY 2) LOSS → NÃO acumula prejuízo, só sobe nível ──
    this.state.lastEntry1Profit = 0;
    this.state.entryNumber = 1;
    this.state.currentLevel++;
    this.state.phase = "WAIT";

    if (this.calculator.isStopLossAtingido(this.state.dailyLoss)) {
      this.state.phase = "STOP";
      this.state.isStopAtingido = true;
      this.emit("risk.stop-loss");
    }

    const op = this.buildOperation(direction, "LOSS", stake, -stake, cprBefore, cprBefore, currentEntry, currentLevel);
    this.history.addOperation(op);
    this.operationCounter++;
    this.state.lastOperationTime = new Date();

    this.emit(
      "result.loss",
      op,
      undefined,
      `SOROS LOSS. Perda: -R$ ${stake.toFixed(2)}. CPR não acumulado.`,
    );
    return op;
  }

  registerDraw(direction: "call" | "put"): SorosGaleOperation {
    const entry = this.getEntry();
    const stake = entry.valor;
    console.log("[SOROS STATE]", {
      event: "DRAW",
      previousLevel: this.state.currentLevel,
      currentLevel: this.state.currentLevel,
      previousEntry: this.state.entryNumber,
      currentEntry: this.state.entryNumber,
      previousStake: stake,
      nextStake: stake,
      capitalPending: this.state.capitalPending,
    });
    this.state.totalDraws++;
    const cprBefore = this.state.capitalPending;
    const currentEntry = this.state.entryNumber;
    const currentLevel = this.state.currentLevel;
    const op = this.buildOperation(direction, "DRAW", stake, 0, cprBefore, cprBefore, currentEntry, currentLevel);
    this.history.addOperation(op);
    this.emit("result.draw", op, undefined, "Resultado indefinido (DRAW)");
    return op;
  }

  // ═══════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════

  getState(): SorosGaleState {
    return { ...this.state };
  }

  getConfig(): SorosGaleConfig {
    return { ...this.config };
  }

  getPhase(): SorosGalePhase {
    return this.state.phase;
  }

  getDashboard(): SorosGaleDashboard {
    const entry = this.getEntry();
    const currentRow = this.calculator.getLevelRow(this.state.currentLevel, this.state.levelTable);

    return {
      initialStake: this.config.initialStake,
      bankroll: this.config.bankroll,
      sessionProfit: parseFloat(this.state.sessionProfit.toFixed(2)),
      capitalPending: parseFloat(this.state.capitalPending.toFixed(2)),
      currentStake: entry.valor,
      nextStake: this.getNextStake(),
      payout: this.config.payout,
      dailyLoss: parseFloat(this.state.dailyLoss.toFixed(2)),
      dailyProfit: parseFloat(this.state.dailyProfit.toFixed(2)),
      stopLoss: this.config.stopLoss,
      stopWin: this.config.stopWin,
      stopLossRemaining: parseFloat(
        Math.max(0, this.config.stopLoss - this.state.dailyLoss).toFixed(2),
      ),
      stopWinRemaining: parseFloat(
        Math.max(0, this.config.stopWin - this.state.dailyProfit).toFixed(2),
      ),
      winRate: this.calculator.calculateWinRate(
        this.state.totalWins,
        this.state.totalWins + this.state.totalLosses,
      ),
      phase: this.state.phase,
      currentLevel: this.state.currentLevel,
      entryNumber: this.state.entryNumber,
      isSoros: this.state.entryNumber === 2,
      totalWins: this.state.totalWins,
      totalLosses: this.state.totalLosses,
      totalDraws: this.state.totalDraws,
      consecutiveWins: this.state.consecutiveWins,
      consecutiveLosses: this.state.consecutiveLosses,
      isStopAtingido: this.state.isStopAtingido,
      isMetaBatida: this.calculator.isStopWinAtingido(this.state.dailyProfit),
      levelTable: this.state.levelTable,
    };
  }

  getEntry(): SorosGaleEntry {
    if (!this.state.levelTable || this.state.levelTable.length === 0) {
      sreLogger.error("getEntry: levelTable VAZIA! Gerando tabela de emergência", {
        currentLevel: this.state.currentLevel,
        phase: this.state.phase,
      });
      this.state.levelTable = this.calculator.generateLevelTable(this.config);
    }

    const safeLevel = Math.max(
      0,
      Math.min(this.state.currentLevel, this.state.levelTable.length - 1),
    );
    const row = this.calculator.getLevelRow(safeLevel, this.state.levelTable);

    if (!row) {
      sreLogger.error("getEntry: row UNDEFINED! Usando fallback", {
        level: safeLevel,
        tableLen: this.state.levelTable.length,
      });
      return {
        valor: this.config.initialStake,
        level: 0,
        entry: 1,
        isSoros: false,
        capitalPending: this.state.capitalPending,
      };
    }

    if (this.state.entryNumber === 2) {
      sreLogger.info("getEntry → SOROS (Entry 2)", {
        valor: row.entry2,
        level: this.state.currentLevel,
        entry: 2,
        capitalPending: this.state.capitalPending,
        rowEntry1: row.entry1,
        rowEntry2: row.entry2,
      });
      return {
        valor: row.entry2,
        level: this.state.currentLevel,
        entry: 2,
        isSoros: true,
        capitalPending: this.state.capitalPending,
      };
    }

    sreLogger.info("getEntry → ENTRY_1", {
      valor: row.entry1,
      level: this.state.currentLevel,
      entry: 1,
      capitalPending: this.state.capitalPending,
    });
    return {
      valor: row.entry1,
      level: this.state.currentLevel,
      entry: 1,
      isSoros: false,
      capitalPending: this.state.capitalPending,
    };
  }

  getLevelTable(): LevelRow[] {
    return [...this.state.levelTable];
  }

  getAIDecisions(): AIFinancialDecision[] {
    return [];
  }

  // ═══════════════════════════════════════════════
  // AI FINANCIAL AGENT
  // ═══════════════════════════════════════════════

  evaluateAIDecision(history?: SmartRecoveryHistory): AIFinancialDecision {
    const decision: AIFinancialDecision = {
      action: "continue",
      reason: "",
      confidence: 0,
      timestamp: new Date(),
    };

    const h = history ?? this.history;
    const currentLevel = this.state.currentLevel;
    const currentRow = this.calculator.getLevelRow(currentLevel, this.state.levelTable);

    // 1. STOP LOSS
    if (this.state.isStopAtingido) {
      decision.action = "stop-session";
      decision.reason = `Stop loss atingido. Perda: R$ ${this.state.dailyLoss.toFixed(2)}`;
      decision.confidence = 100;
      return decision;
    }

    // 2. Consecutive losses >= 5
    if (this.state.consecutiveLosses >= 5) {
      decision.action = "pause";
      decision.reason = `${this.state.consecutiveLosses} losses consecutivos. Pausando.`;
      decision.confidence = 90;
      return decision;
    }

    // 3. Nível sem recuperação matemática (canRecover = false)
    if (currentRow && !currentRow.canRecover) {
      decision.action = "reduce-stake";
      decision.reason = `Nível ${currentLevel} não permite recuperação matemática (profit1+profit2 < accLoss).`;
      decision.confidence = 80;
      return decision;
    }

    // 4. Oscilação de nível (ex: L0→L1→L0→L1 repetidamente)
    if (h.isLevelOscillating(currentLevel, 3)) {
      decision.action = "pause";
      decision.reason = `Oscilação detectada no nível ${currentLevel} (${h.getLevelCycleCount().get(currentLevel) ?? 0} visitas). Mercado lateral?`;
      decision.confidence = 85;
      return decision;
    }

    // 5. Win rate baixo no nível atual
    const winRateAtLevel = h.getWinRateAtLevel(currentLevel);
    if (winRateAtLevel > 0 && winRateAtLevel < 30) {
      decision.action = "pause";
      decision.reason = `Win rate de ${winRateAtLevel}% no nível ${currentLevel} (${h.getOperationsAtLevel(currentLevel).length} ops). Nível problemático.`;
      decision.confidence = 80;
      return decision;
    }

    // 6. CPR alto (> 30% da banca)
    if (this.state.capitalPending > this.config.bankroll * 0.3) {
      decision.action = "reduce-stake";
      decision.reason = `CPR alto: R$ ${this.state.capitalPending.toFixed(2)} (${((this.state.capitalPending / this.config.bankroll) * 100).toFixed(1)}% da banca).`;
      decision.confidence = 75;
      return decision;
    }

    // 7. Padrão alternado (WIN→LOSS→WIN→LOSS) nos últimos 4 resultados no nível
    const last4 = h.getLastResultsAtLevel(currentLevel, 4);
    if (last4.length === 4) {
      const alternating =
        last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3];
      if (alternating) {
        decision.action = "adjust-recovery";
        decision.reason = `Padrão alternado nos últimos 4 resultados do nível ${currentLevel}. Mercado sem tendência clara.`;
        decision.confidence = 70;
        return decision;
      }
    }

    // 8. Multiple Soros failures
    const sorosOps = h.getOperations().filter((op) => op.entryNumber === 2 && op.result === "LOSS");
    if (sorosOps.length >= 3) {
      const recentSoros = sorosOps.slice(-3);
      if (recentSoros.every((op) => op.result === "LOSS")) {
        decision.action = "pause";
        decision.reason = `${sorosOps.length} Soros losses consecutivos. Estratégia de recuperação ineficaz.`;
        decision.confidence = 85;
        return decision;
      }
    }

    // 9. Tudo OK — operar normalmente
    decision.reason = "Operando normalmente.";
    decision.confidence = 60;
    return decision;
  }

  // ═══════════════════════════════════════════════
  // CONFIGURAÇÃO
  // ═══════════════════════════════════════════════

  /**
   * Define valores de entrada customizados para cada nível.
   * Ex: [2, 4, 8, 16] → nível 0 entry1=2, nível 1 entry1=4, etc.
   */
  updateLevels(niveis: number[]): void {
    this.config.customLevels = niveis;
    this.calculator.updateConfig(this.config);
    this.state.levelTable = this.calculator.generateLevelTable(this.config);
    this.emit("config.updated");
  }

  updateConfig(config: Partial<SorosGaleConfig>): void {
    this.config = { ...this.config, ...config };
    this.calculator.updateConfig(this.config);
    // Regenera tabela com nova config
    this.state.levelTable = this.calculator.generateLevelTable(this.config);
    this.emit("config.updated");
  }

  setRecoveryFactor(_factor: number): void {
    // Não usado no SorosGale, apenas para compatibilidade
  }

  // ═══════════════════════════════════════════════
  // CONTROLE DE SESSÃO
  // ═══════════════════════════════════════════════

  startSession(): void {
    this.state = this.createInitialState();
    this.state.phase = "WAIT";
    this.operationCounter = 0;
    this.emit("session.started");
  }

  pauseSession(): void {
    if (this.state.phase !== "STOP" && this.state.phase !== "FINALIZADO") {
      this.state.phase = "IDLE";
      this.emit("session.paused");
    }
  }

  resumeSession(): void {
    if (this.state.phase === "IDLE") {
      this.state.phase = "WAIT";
      this.emit("session.resumed");
    }
  }

  stopSession(): void {
    this.state.phase = "FINALIZADO";
    this.emit("session.stopped");
  }

  reset(): void {
    this.state = this.createInitialState();
    this.operationCounter = 0;
    this.emit("session.reset");
  }

  isStopped(): boolean {
    return this.state.phase === "STOP" || this.state.phase === "FINALIZADO";
  }

  // ═══════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════

  getHistory(): SmartRecoveryHistory {
    return this.history;
  }

  private buildOperation(
    direction: "call" | "put",
    result: OperationOutcome,
    stake: number,
    profit: number,
    cprBefore: number,
    cprAfter: number,
    currentEntry: 1 | 2,
    currentLevel: number,
  ): SorosGaleOperation {
    return {
      id: `op-${Date.now()}-${this.operationCounter}`,
      timestamp: new Date(),
      hour: new Date().toLocaleTimeString("pt-BR"),
      asset: "",
      direction,
      stake,
      payout: this.config.payout,
      cprBefore: parseFloat(cprBefore.toFixed(2)),
      cprAfter: parseFloat(cprAfter.toFixed(2)),
      result,
      profit: parseFloat(profit.toFixed(2)),
      sessionProfit: parseFloat(this.state.sessionProfit.toFixed(2)),
      entryNumber: currentEntry,
      level: currentLevel,
    };
  }

  private createInitialState(): SorosGaleState {
    return {
      phase: "IDLE",
      currentLevel: 0,
      entryNumber: 1,
      bankroll: this.config.bankroll,
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
      levelTable: this.calculator.generateLevelTable(this.config),
      sessionStartTime: new Date(),
      lastOperationTime: null,
    };
  }
}
