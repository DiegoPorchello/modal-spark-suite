/**
 * forward-testing-engine.ts
 * Motor de Forward Testing — orquestra o ciclo completo:
 *   1. Cria sessão no Supabase
 *   2. Conecta à Puma Broker (via bridge Python)
 *   3. Escuta candles → executa score → envia ordem → registra resultado
 *   4. Atualiza pattern_stats (aprendizado)
 *   5. Gera relatório diário
 *
 * Este engine se comunica com o Python (pumabroker) através de uma API HTTP
 * que será implementada como um micro-serviço ou serverless function.
 */

import { SessionService } from "../services/session.service";
import { OperationService } from "../services/operation.service";
import { PatternStatsService } from "../services/pattern-stats.service";
import { DashboardService } from "../services/dashboard.service";
import type { CreateSessionInput, TestSession, Operation, SessionStatus } from "../types";

export type EngineStatus = "idle" | "connecting" | "running" | "paused" | "stopped" | "error";

export interface EngineState {
  session: TestSession | null;
  status: EngineStatus;
  currentOperation: Operation | null;
  consecutiveWins: number;
  consecutiveLosses: number;
  error: string | null;
  startedAt: string | null;
}

export interface EngineCallbacks {
  onOperationCreated?: (op: Operation) => void;
  onOperationResult?: (op: Operation) => void;
  onStatusChange?: (status: EngineStatus) => void;
  onError?: (error: string) => void;
  onDailyReport?: (report: string) => void;
}

export class ForwardTestingEngine {
  private state: EngineState = {
    session: null,
    status: "idle",
    currentOperation: null,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    error: null,
    startedAt: null,
  };

  private callbacks: EngineCallbacks = {};
  private intervalId: ReturnType<typeof setInterval> | null = null;

  getState(): EngineState {
    return { ...this.state };
  }

  onCallbacks(cbs: EngineCallbacks): void {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  async startSession(input: CreateSessionInput): Promise<TestSession> {
    if (this.state.status === "running") {
      throw new Error("Já existe uma sessão em execução. Pare-a primeiro.");
    }

    this.setState({ status: "connecting", error: null });

    try {
      const session = await SessionService.create(input);
      this.setState({
        session,
        status: "running",
        startedAt: new Date().toISOString(),
        consecutiveWins: 0,
        consecutiveLosses: 0,
      });

      return session;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ status: "error", error: message });
      throw err;
    }
  }

  async stopSession(): Promise<void> {
    if (!this.state.session) return;

    try {
      await SessionService.updateStatus(this.state.session.id, "stopped");
      await SessionService.updateFinalBalance(
        this.state.session.id,
        this.state.session.initial_balance + this.getAccumulatedProfit(),
      );

      this.clearAnalysisLoop();
      this.setState({ status: "stopped" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ error: message });
    }
  }

  async pauseSession(): Promise<void> {
    if (this.state.session && this.state.status === "running") {
      await SessionService.updateStatus(this.state.session.id, "paused");
      this.clearAnalysisLoop();
      this.setState({ status: "paused" });
    }
  }

  async resumeSession(): Promise<void> {
    if (this.state.session && this.state.status === "paused") {
      await SessionService.updateStatus(this.state.session.id, "running");
      this.setState({ status: "running" });
      this.startAnalysisLoop();
    }
  }

  // ── Ciclo de análise ──────────────────────────────────────────────────────

  private startAnalysisLoop(): void {
    if (this.intervalId) return;

    // A cada 5 segundos, simula um ciclo de análise
    // (em produção, será substituído pelo evento on_bar do WebSocket)
    this.intervalId = setInterval(() => this.analysisCycle(), 5000);
  }

  private clearAnalysisLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async analysisCycle(): Promise<void> {
    if (this.state.status !== "running" || !this.state.session) return;

    try {
      // Verifica se há operação pendente aguardando resultado
      if (this.state.currentOperation?.result === "pending") {
        await this.checkOperationResult();
        return;
      }

      // Se não há operação ativa, executa análise completa
      await this.executeAnalysis();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ error: message });
      this.callbacks.onError?.(message);
    }
  }

  // ── Execução de análise ───────────────────────────────────────────────────

  private async executeAnalysis(): Promise<void> {
    // 1. Consulta pattern_stats para ajustar score com aprendizado
    const hour = new Date().getHours();
    const adjustments = await PatternStatsService.calculateScoreAdjustments(
      "EURUSD",
      "M1",
      hour,
      "premium",
    );

    // 2. Verifica se o score ajustado atende aos critérios
    if (adjustments.finalScore < 85) return; // mínimo para operar

    // 3. Abre operação (em produção: envia ordem para o broker via Python bridge)
    const op = await OperationService.create({
      session_id: this.state.session!.id,
      asset: "EURUSD",
      direction: adjustments.finalScore > 90 ? "CALL" : "PUT",
      amount: this.state.session!.base_entry,
      score_at_moment: adjustments.finalScore,
      timeframe: "M1",
    });

    this.setState({ currentOperation: op });
    this.callbacks.onOperationCreated?.(op);
  }

  // ── Verificação de resultado ──────────────────────────────────────────────

  private async checkOperationResult(): Promise<void> {
    if (!this.state.currentOperation) return;

    // Simula resultado (em produção: evento tradeUpdate do broker)
    const result = Math.random() > 0.3 ? "win" : "loss";
    const profit =
      result === "win"
        ? this.state.currentOperation.amount * 0.87
        : -this.state.currentOperation.amount;

    const updatedOp = {
      id: this.state.currentOperation.id,
      result: result as "win" | "loss",
      profit,
      exit_price: this.state.currentOperation.entry_price ?? null,
      closed_at: new Date().toISOString(),
    };

    await OperationService.updateResult(updatedOp);

    const completedOp = {
      ...this.state.currentOperation,
      ...updatedOp,
    };

    this.setState({
      currentOperation: null,
      consecutiveWins: result === "win" ? this.state.consecutiveWins + 1 : 0,
      consecutiveLosses: result === "loss" ? this.state.consecutiveLosses + 1 : 0,
    });

    this.callbacks.onOperationResult?.(completedOp);
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  private getAccumulatedProfit(): number {
    // Em produção: consulta o Supabase
    return 0;
  }

  private setState(partial: Partial<EngineState>): void {
    this.state = { ...this.state, ...partial };
    this.callbacks.onStatusChange?.(this.state.status);
  }

  destroy(): void {
    this.clearAnalysisLoop();
    this.state = {
      session: null,
      status: "idle",
      currentOperation: null,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      error: null,
      startedAt: null,
    };
  }
}

export const forwardTestingEngine = new ForwardTestingEngine();
