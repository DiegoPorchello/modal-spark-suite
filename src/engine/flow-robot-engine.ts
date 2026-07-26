import { SmartRecoveryEngine } from "../modules/smart-recovery/SmartRecoveryEngine";
import type { SmartRecoveryDashboard } from "../modules/smart-recovery/SmartRecoveryTypes";
import type { PumaBrokerAdapter } from "../broker/puma-broker-adapter";
import type { Candle } from "../market/types";
import { DecisionEngine, type DecisionResult } from "./decision/DecisionEngine";
import type { BlockedRule } from "./decision/DecisionEngine";
import {
  DEFAULT_HYBRID_PROBABILITY_CONFIG,
  type HybridProbabilityConfig,
} from "./decision/HybridProbabilityEngine";
import { DecisionTimeline } from "./decision-timeline";
import { ScoreEngine } from "./decision/ScoreEngine";
import { analystBus } from "../modules/analyst/EventBus";
import type { AnalystEventType, ScanLogEntry } from "../modules/analyst/AnalystTypes";
import { engineLogger } from "./logger";
import type { MarketSession, MarketSessionInfo } from "../market/market-session-manager";
import { ExecutionEngine } from "./execution/ExecutionEngine";
import type { NextTrade, EntryRecord } from "./execution/types";
import { getPrecisionColor, getPrecisionColorClass } from "./execution/types";
import { latencyTracker } from "./latency-tracker";
import { LatencyScanner } from "./latency-scanner";
import { buildDecisionContext } from "../modules/flow-continuity/services/decision-context-builder";
import type { DecisionContext } from "../modules/flow-continuity/types/decision-context.types";
import { buildOperationContext } from "../modules/flow-continuity/services/operation-context-builder";
import type { OperationContext } from "../modules/flow-continuity/types/operation-context.types";
import { buildReplayContext } from "../modules/flow-continuity/services/replay-engine";
import type { ReplayContext } from "../modules/flow-continuity/types/replay-context.types";
import {
  buildPerformanceContext,
  buildSnapshot,
} from "../modules/performance/services/performance-engine";
import type { PerformanceContext } from "../modules/performance/types/performance-context.types";
import { performanceHistory } from "../modules/performance/services/performance-history";
import { StrategyManager } from "../services/strategy-manager";

import { getProfileCandleConfig } from "../types/operational-profile-config";
import { signalLogger } from "./statistics/signal-log";
import { ENGINE_VERSION, DATABASE_VERSION, PATTERN_CATALOG_VERSION } from "./statistics/signal-log";

/**
 * Ativos sintéticos Puma — não existem na Binance.
 * Recebem candles via REST /history + WS2 tempo real.
 */
const HYBRID_PUMA_ASSETS = new Set([
  "BETHUSDT",
  "BTSOLUSDT",
  "MAPEUSDT",
  "XRDOGUSDT",
  "XRPSOLUSDT",
]);

/** Retorna o mínimo de candles necessários para operar com um ativo. */
function getMinCandles(profile: string): number {
  const config = getProfileCandleConfig(profile as any);
  return config.minCandles;
}

/** Retorna a quantidade de candles a buscar do broker. */
function getFetchSize(profile: string): number {
  const config = getProfileCandleConfig(profile as any);
  return config.fetchSize;
}

let _traceCounter = 0;
const makeTraceId = () => `scan-${Date.now()}-${++_traceCounter}`;

// ══════════════════════════════════════════════════════════════
// SCHEDULER METRICS — observabilidade sem alterar lógica
// ══════════════════════════════════════════════════════════════
export type ScheduleReason =
  | "STARTUP"
  | "NO_SIGNAL"
  | "COOLDOWN_ACTIVE"
  | "INVALID_ENTRY"
  | "OPERATION_FINISHED"
  | "SESSION_CHANGED"
  | "ERROR_RETRY"
  | "INSUFFICIENT_DATA"
  | "OUTSIDE_SESSION"
  | "POST_TRADE"
  | "RISK_STOP"
  | "VARIABLE_DELAY";

export type DecisionExitStatus =
  | "APPROVED"
  | "BLOCKED_NO_SIGNAL"
  | "BLOCKED_COOLDOWN"
  | "BLOCKED_INVALID_ENTRY"
  | "BLOCKED_STATUS"
  | "BLOCKED_PROCESSING"
  | "BLOCKED_ACTIVE_OP"
  | "BLOCKED_RISK"
  | "BLOCKED_DUPLICATE"
  | "BLOCKED_RACE_CONDITION"
  | "ERROR";

class SchedulerMetrics {
  decisionCount = 0;
  rescheduleCount = 0;
  approvedCount = 0;
  blockedCount = 0;
  cooldownCount = 0;
  errorCount = 0;
  noSignalCount = 0;
  blockedReasons: Record<string, number> = {};
  private _lastSummaryAt = 0;

  recordDecision(): void {
    this.decisionCount++;
    if (this.decisionCount % 100 === 0 && this.decisionCount !== this._lastSummaryAt) {
      this._lastSummaryAt = this.decisionCount;
      this._logSummary();
    }
  }

  recordReschedule(): void { this.rescheduleCount++; }
  recordApproved(): void { this.approvedCount++; }
  recordBlocked(): void { this.blockedCount++; }
  recordCooldown(): void { this.cooldownCount++; }
  recordError(): void { this.errorCount++; }
  recordNoSignal(): void { this.noSignalCount++; }

  recordBlockedReason(reason: string): void {
    this.blockedCount++;
    this.blockedReasons[reason] = (this.blockedReasons[reason] ?? 0) + 1;
  }

  private _logSummary(): void {
    const topReasons = Object.entries(this.blockedReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([r, c]) => `  ${r.padEnd(20)} ${c}`)
      .join("\n");

    engineLogger.info("SchedulerMetrics", `═══ SCHEDULER REPORT (últimas 100 decisões) ═══`, {
      totalDecisions: this.decisionCount,
      approved: this.approvedCount,
      blocked: this.blockedCount,
      noSignal: this.noSignalCount,
      cooldown: this.cooldownCount,
      errors: this.errorCount,
      reschedules: this.rescheduleCount,
      approvalRate: this.decisionCount > 0
        ? `${((this.approvedCount / this.decisionCount) * 100).toFixed(1)}%`
        : "N/A",
      blockedReasons: topReasons || "none",
    });
  }

  getSnapshot(): Record<string, number> {
    return {
      decisions: this.decisionCount,
      approved: this.approvedCount,
      blocked: this.blockedCount,
      noSignal: this.noSignalCount,
      cooldown: this.cooldownCount,
      errors: this.errorCount,
      reschedules: this.rescheduleCount,
    };
  }
}

const schedulerMetrics = new SchedulerMetrics();

const DEMO_DAILY_LIMIT = 50;

export type RobotStatus = "idle" | "running" | "paused" | "stopped" | "error" | "waiting-result";

export type OperationDirection = "call" | "put";
export type OperationResult = "win" | "loss" | "pending" | "draw" | "unknown";

export interface RobotOperation {
  id: string;
  asset: string;
  direction: OperationDirection;
  amount: number;
  recoveryStep: number;
  entryNumber: 1 | 2;
  orderId: string | null;
  status: "pending" | "active" | "completed";
  result: OperationResult;
  openedAt: Date;
  closedAt?: Date;
  payout: number;
  profit: number;
  entryPrice: number;
  timeframe: string;
  expirationSeconds: number;
}

export interface RobotConfig {
  asset: string;
  timeframes: string[];
  expirationSeconds: number;
  accountType: "real" | "demo";
  initialBankroll: number;
  targetProfit: number;
  stopLoss: number;
  direction: OperationDirection;
  autoDirection: boolean;
  reAnalysisIntervalSec: number;
  scanMode: "single" | "multi";
  assets: string[];
  assetCooldownMinutes: number;
  globalCooldownSec: number;
  initialStake: number;
  payout: number;
  maxLevel: number;
  customLevels: number[];
  /** Market mode: AUTO (detect), FOREX, or HYBRID */
  marketMode: "AUTO" | "FOREX" | "HYBRID";
  /** Operational profile selected by the user (independent of marketMode detection). */
  operationProfile?: "AUTO" | "FOREX" | "HYBRID_FLOW" | "HYBRID_PROBABILITY";
  /** Per-profile configuration for HYBRID_PROBABILITY decision motor. */
  hybridProbabilityConfig?: HybridProbabilityConfig;
  // Callback opcional para sobrescrever resultado do broker (WIN/LOSS/DRAW)
  // Recebe: tradeId, asset, direction, amount, brokerResult, entryPrice
  // Retorna: "WIN" | "LOSS" | "DRAW" | null (null = usa resultado do broker)
  onTradeResult?: (params: {
    tradeId: string;
    asset: string;
    direction: "call" | "put";
    amount: number;
    brokerResult: "WIN" | "LOSS" | "DRAW" | "UNKNOWN";
    entryPrice: number;
  }) => "WIN" | "LOSS" | "DRAW" | null;
}

const DEFAULT_TIMEFRAMES = ["M1", "M5", "M15"];

const TIMEFRAME_EXPIRATION_MAP: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
};

export interface RobotState {
  status: RobotStatus;
  config: RobotConfig;
  currentRecoveryStep: number;
  currentEntry: number;
  entryNumber: 1 | 2;
  currentBankroll: number;
  initialBankroll: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  sessionProfit: number;
  operations: RobotOperation[];
  activeOperation: RobotOperation | null;
  lastError: string | null;
  startedAt: Date | null;
  nextOperationIn: number;
  lastAnalysis: DecisionResult | null;
  lastScannedAsset: string | null;
  scanLog: ScanLogEntry[];
  currentSession: MarketSession;
  sessionInfo: MarketSessionInfo | null;
  nextTrade: NextTrade | null;
  selectedTimeframe: string | null;
  lastEntryPrecision: number;
  avgEntryPrecision: number;
  bestEntryPrecision: number;
  worstEntryPrecision: number;
  executionPhase: string;
  healthCheck: HealthCheckResult | null;
}

export interface HealthCheckItem {
  label: string;
  ok: boolean;
  value: string;
  detail?: string;
}

export interface HealthCheckResult {
  timestamp: number;
  items: HealthCheckItem[];
  summary: { total: number; passed: number; failed: number };
}

export type RobotEventType =
  | "status-changed"
  | "operation-opened"
  | "operation-closed"
  | "step-changed"
  | "balance-updated"
  | "state-changed"
  | "error"
  | "stopped-by-risk"
  | "draw";

export interface RobotEvent {
  type: RobotEventType;
  state: RobotState;
  operation?: RobotOperation;
  message?: string;
}

export type RobotListener = (event: RobotEvent) => void;

export const DEFAULT_ROBOT_CONFIG: RobotConfig = {
  asset: "BETHUSDT",
  timeframes: DEFAULT_TIMEFRAMES,
  expirationSeconds: 60,
  accountType: "demo",
  initialBankroll: 1000,
  targetProfit: 100,
  stopLoss: 200,
  direction: "call",
  autoDirection: true,
  reAnalysisIntervalSec: 30,
  scanMode: "multi",
  assetCooldownMinutes: 5,
  globalCooldownSec: 180,
  initialStake: 2,
  payout: 0.86,
  maxLevel: 15,
  customLevels: [],
  assets: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCAD",
    "NZDUSD",
    "BTCUSD",
    "ETHUSD",
    "BETHUSDT",
    "BTSOLUSDT",
    "MAPEUSDT",
    "XRDOGUSDT",
    "XRPSOLUSDT",
    "XAUUSD",
  ],
  marketMode: "AUTO",
  operationProfile: "AUTO",
  hybridProbabilityConfig: { ...DEFAULT_HYBRID_PROBABILITY_CONFIG },
};

const CONFIG_STORAGE_KEY = "nexor_config";
const OPERATIONS_STORAGE_KEY = "nexor_operations_v1";
const MAX_PERSISTED_OPS = 9999;

function loadPersistedConfig(): Partial<RobotConfig> | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<RobotConfig>;
  } catch {
    return null;
  }
}

function persistConfig(config: RobotConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

function loadPersistedOperations(): RobotOperation[] {
  try {
    const raw = localStorage.getItem(OPERATIONS_STORAGE_KEY);
    if (!raw) return [];
    const ops = JSON.parse(raw) as RobotOperation[];
    return ops.filter((o) => o.status === "completed");
  } catch {
    return [];
  }
}

function persistOperations(ops: RobotOperation[]): void {
  try {
    const completed = ops.filter((o) => o.status === "completed");
    localStorage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(completed));
  } catch {
    /* ignore */
  }
}

export class FlowRobotEngine {
  static _nextId = 1;
  readonly instanceId: number;
  readonly executionEngine: ExecutionEngine;
  private smartRecovery: SmartRecoveryEngine;
  private broker: PumaBrokerAdapter;
  private listeners: RobotListener[] = [];
  private _state: RobotState;
  private _loopTimer: ReturnType<typeof setTimeout> | null = null;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;
  private decisionEngine: DecisionEngine;
  private _candleCloseUnsub: (() => void) | null = null;
  private _sessionUnsub: (() => void) | null = null;
  private assetCooldowns: Map<string, number> = new Map();
  private _balanceRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private _balanceSource: "REAL" | "MOCK" = "MOCK";
  private _lastBalanceSync: number = 0;
  private _sessionStarted = false;
  private _decisionCounter = 0;
  // Idempotency guard: last processed candle timestamp per asset (STATIC = shared across all instances)
  private static _lastProcessedCandle: Map<string, number> = new Map();
  private static _isProcessing = false;
  private static _pendingCandleClose = false;
  private _globalCooldownUntil: number = 0;
  private _lastDecisionContext: DecisionContext | null = null;
  private _decisionHistory: DecisionContext[] = [];
  private static readonly MAX_DECISION_HISTORY = 20;
  private _lastOperationContext: OperationContext | null = null;
  private _operationHistory: OperationContext[] = [];
  private static readonly MAX_OPERATION_HISTORY = 100;
  private _lastReplayContext: ReplayContext | null = null;
  private _replayHistory: ReplayContext[] = [];
  private static readonly MAX_REPLAY_HISTORY = 100;
  private _lastPerformanceContext: PerformanceContext | null = null;
  private _lastSignalLogId: string | null = null;

  private _logState(event: string, detail?: Record<string, unknown>): void {
    engineLogger.info("FlowRobot", `[STATE] ${event}`, {
      status: this._state.status,
      isProcessing: FlowRobotEngine._isProcessing,
      hasNextTrade: !!this._state.nextTrade,
      hasActiveOp: !!this._state.activeOperation,
      asset: this._state.config.asset,
      ...detail,
    });
  }

  constructor(broker: PumaBrokerAdapter) {
    this.instanceId = FlowRobotEngine._nextId++;
    this.broker = broker;

    // Config e sessão devem ser resolvidas ANTES do SmartRecoveryEngine,
    // pois seu construtor invoca configGetter() → () => this._state.config
    const savedConfig = loadPersistedConfig();
    const initialConfig = savedConfig
      ? { ...DEFAULT_ROBOT_CONFIG, ...savedConfig }
      : DEFAULT_ROBOT_CONFIG;
    const ts = new Date().toLocaleTimeString("pt-BR");
    console.log(
      `[FlowRobotEngine] ${ts} 🔧 Constructor — savedConfig from localStorage:`,
      savedConfig
        ? {
            asset: savedConfig.asset,
            marketMode: savedConfig.marketMode,
          }
        : "null",
    );
    console.log(
      `[FlowRobotEngine] ${ts} 🔧 Constructor — initialConfig.asset: ${initialConfig.asset}, marketMode: ${initialConfig.marketMode}`,
    );
    const sessionInfo = this.broker.getSessionInfo();
    const currentSession = sessionInfo?.currentSession;

    // Estado mínimo apenas com config para que o configGetter do
    // SmartRecoveryEngine funcione durante sua construção
    this._state = { config: initialConfig } as RobotState;

    this.smartRecovery = new SmartRecoveryEngine(() => this._state.config);
    this.decisionEngine = new DecisionEngine();
    this.executionEngine = new ExecutionEngine(broker);

    // Substitui pelo estado completo
    this._state = this._buildInitialState(initialConfig, currentSession, sessionInfo);

    // Escuta mudanças de sessão
    const sessionManager = this.broker.getSessionManager();
    this._sessionUnsub = sessionManager.onSessionChange((from, to, info) => {
      this._onSessionChange(from, to, info);
    });

    // Configura callbacks do ExecutionEngine
    this.executionEngine.setCallbacks({
      onDecisionTime: () => this._onDecisionTime(),
      onCandleOpen: (time) => this._onExecutionCandleOpen(time),
      onEntry: (record) => this._onEntryExecuted(record),
      onPhaseChange: (phase) => {
        this._state.executionPhase = phase;
        this._emit("state-changed");
      },
      onDelayDetected: (reason) => {
        engineLogger.warn("FlowRobot", `⚠️ ${reason}`, {});
        this._emitDiagnostic("entry", "warning", reason);
      },
    });

    console.log(`[FlowRobotEngine] 🆕 NOVA INSTÂNCIA #${this.instanceId}`, {
      brokerId: broker.instanceId,
    });

    // Debug: expõe engine no console do navegador
    (window as any).__robotEngine = this;
    (window as any).__smartRecovery = this.smartRecovery;
  }

  getAuditReport() {
    return this.decisionEngine.getAuditReport();
  }

  clearAudit() {
    this.decisionEngine.clearAudit();
  }

  loadPersistedOps(): void {
    try {
      const persistedOps = loadPersistedOperations();
      if (persistedOps.length > 0) {
        this._state.operations = persistedOps;
        this._state.totalWins = persistedOps.filter((o) => o.result === "win").length;
        this._state.totalLosses = persistedOps.filter((o) => o.result === "loss").length;
        this._state.sessionProfit = persistedOps.reduce((s, o) => s + o.profit, 0);
        this._state.winRate =
          this._state.totalWins + this._state.totalLosses > 0
            ? (this._state.totalWins / (this._state.totalWins + this._state.totalLosses)) * 100
            : 0;
        this._emit("state-changed");
      }
    } catch {
      /* ignore during SSR */
    }
  }

  get state(): RobotState {
    return { ...this._state, operations: [...this._state.operations] };
  }

  start(config?: Partial<RobotConfig>): void {
    if (this._state.status === "running") return;
    if (!this.broker.connected) {
      this._setError("Broker não conectado. Faça login primeiro.");
      return;
    }

    // ── Limpa qualquer ordem pendente de sessão anterior ──
    if (this._state.activeOperation && this._state.activeOperation.status !== "completed") {
      engineLogger.warn("FlowRobot", "🧹 Cancelando ordem pendente de sessão anterior", {
        asset: this._state.activeOperation.asset,
        direction: this._state.activeOperation.direction,
        status: this._state.activeOperation.status,
      });
      this._state.activeOperation = null;
      this._state.status = "idle";
    }
    // Remove operações "active" ou "pending" do histórico (inconsistentes)
    this._state.operations = this._state.operations.filter(
      (op) => op.status !== "active" && op.status !== "pending",
    );
    // Limpa análise anterior para não usar dados obsoletos na primeira execução
    this._state.lastAnalysis = null;
    this._state.lastScannedAsset = null;
    this._state.scanLog = [];

    // ── Auto-teste: valida todos os sub-engines antes de iniciar ──
    const testResult = this.decisionEngine.runSelfTest();
    if (!testResult.passed) {
      const failures = testResult.results.filter((r) => !r.ok);
      const msg = `Auto-teste FALHOU: ${failures.map((f) => `${f.name} (${f.detail})`).join(", ")}`;
      engineLogger.error("FlowRobotEngine", msg);
      this._setError(msg);
      return;
    }
    engineLogger.info("FlowRobotEngine", "Auto-teste ✅ PASSOU — todos os engines OK", {
      results: testResult.results.map((r) => `${r.name}: OK`),
    });

    const mergedConfig: RobotConfig = { ...this._state.config, ...config };

    // Ensure timeframes has at least one entry
    if (!mergedConfig.timeframes || mergedConfig.timeframes.length === 0) {
      mergedConfig.timeframes = DEFAULT_TIMEFRAMES;
    }

    // Usa ativos da sessão atual via MarketSessionManager
    // Respeita a seleção do usuário, filtrando apenas pelos disponíveis na sessão
    const sessionInfo = this.broker.getSessionInfo();
    const userAssets = mergedConfig.assets?.length ? mergedConfig.assets : sessionInfo.activeAssets;
    mergedConfig.assets = userAssets.filter((a) => sessionInfo.activeAssets.includes(a));
    if (mergedConfig.assets.length === 0) {
      mergedConfig.assets = sessionInfo.activeAssets;
    }
    if (mergedConfig.scanMode === "single") {
      mergedConfig.asset = mergedConfig.assets.includes(mergedConfig.asset)
        ? mergedConfig.asset
        : (mergedConfig.assets[0] ?? mergedConfig.asset);
    }

    // ══ DIAGNÓSTICO INICIAL ══
    engineLogger.info("FlowRobotEngine", `═══ DIAGNÓSTICO INICIAL ═══`, {
      wsConnected: this.broker.connected,
      scanMode: mergedConfig.scanMode,
      assets: mergedConfig.assets.join(", "),
      timeframes: mergedConfig.timeframes.join(", "),
      autoDirection: mergedConfig.autoDirection,
      session: sessionInfo.sessionLabel,
      dataSource: sessionInfo.dataSource,
    });

    // ══ RELATÓRIO DE LATÊNCIA (scanner estático) ══
    LatencyScanner.printReport();
    engineLogger.info("FlowRobotEngine", "LatencyScanner report printed above");

    const bufferStatus = this.broker.getBufferStatus();
    engineLogger.info("FlowRobotEngine", `Buffer de candles no startup`, {
      bufferKeys: bufferStatus.length,
      details: bufferStatus.map((b) => `${b.key}: ${b.count} candles`),
    });

    if (bufferStatus.length === 0) {
      engineLogger.warn(
        "FlowRobotEngine",
        `⚠️ Buffer VAZIO no startup — aguardando WebSocket receber candles`,
        {
          reason: "getCandles retornará vazio até que o WebSocket receba bar_update",
        },
      );
    }

    if (this._state.config.customLevels.length > 0) {
      this._state.config = { ...this._state.config, customLevels: [...mergedConfig.customLevels] };
    }
    this.smartRecovery.regenerateLevelTable();
    this.smartRecovery.startSession();

    let direction = mergedConfig.direction;
    if (mergedConfig.autoDirection) {
      // Usa apenas operações de HOJE para autoDirection (ignora sessões anteriores)
      const todayStr = new Date().toDateString();
      const todayOps = this._state.operations.filter((op) => {
        try {
          return new Date(op.openedAt).toDateString() === todayStr;
        } catch {
          return false;
        }
      });
      const lastOperation = todayOps.length > 0 ? todayOps[todayOps.length - 1] : null;
      if (lastOperation && lastOperation.result === "win") {
        direction = "put";
      } else if (lastOperation && lastOperation.result === "loss") {
        direction = "call";
      } else {
        direction = mergedConfig.direction;
      }
    }

    this._state = {
      ...this._buildInitialState(mergedConfig),
      status: "running",
      startedAt: new Date(),
      currentBankroll: mergedConfig.initialBankroll,
      config: { ...mergedConfig, direction },
    };

    // DecisionEngine preserva histórico entre sessões
    this._emit("status-changed");
    this._emitAnalyst("robot.started");
    this._emitDiaryEntry(
      "Sessão NEXOR Smart Recovery™ iniciada. Banca real será obtida via Puma API...",
      "🚀",
      "info",
    );

    // Inscreve no evento de candle fechado para análise reativa
    if (this._candleCloseUnsub) this._candleCloseUnsub();
    this._candleCloseUnsub = this.broker.subscribeCandleClose((candle) =>
      this._onCandleClose(candle),
    );

    // Inicia ExecutionEngine (monitor de alta precisão 50ms)
    this.executionEngine.start();

    // Sincroniza clock com heartbeat do servidor
    if (this.broker.connected && (this.broker as any)._socketClient) {
      try {
        const socket = (this.broker as any)._socketClient;
        if (socket && typeof socket.on === "function") {
          socket.on("server_time", (data: any) => {
            if (data?.timestamp) {
              this.executionEngine.recordServerTime(
                typeof data.timestamp === "number" && data.timestamp < 1e12
                  ? data.timestamp * 1000
                  : data.timestamp,
              );
            }
          });
        }
      } catch {
        // Clock sync via heartbeat é opcional
      }
    }

    // Busca saldo real da Puma antes de iniciar operações
    this._refreshBalance()
      .then(() => {
        this._startBalanceRefresh(30000);
        engineLogger.info(
          "FlowRobot",
          "Saldo real carregado — ROBOT READY. Iniciando ciclo de operações.",
          {},
        );
        this._scheduleNextOperation(10, "STARTUP");
      })
      .catch((err) => {
        engineLogger.warn(
          "FlowRobot",
          "Falha ao carregar saldo real no startup — tentando novamente em 10s",
          {
            error: String(err),
          },
        );
        // Tenta novamente após delay; só inicia operações quando conseguir saldo real
        setTimeout(() => {
          this._refreshBalance()
            .then(() => {
              this._startBalanceRefresh(30000);
              engineLogger.info(
                "FlowRobot",
                "Saldo real carregado na retentativa — ROBOT READY.",
                {},
              );
              this._scheduleNextOperation(10, "STARTUP");
            })
            .catch(() => {
              // Falha persistente — agenda verificação periódica mas NÃO inicia operações
              setTimeout(() => {
                if (this._state.status === "running") {
                  this._retryInitialBalance();
                }
              }, 10000);
            });
        }, 10000);
      });
    // NOTA: _scheduleNextOperation NÃO é chamado aqui — operações só começam após saldo real obtido
  }

  private _retryInitialBalance(retryCount = 0): void {
    if (this._state.status !== "running") return;
    this._refreshBalance()
      .then(() => {
        this._startBalanceRefresh(30000);
        engineLogger.info("FlowRobot", "Saldo real finalmente carregado — ROBOT READY.", {});
        this._scheduleNextOperation(10, "STARTUP");
      })
      .catch(() => {
        if (retryCount < 10) {
          setTimeout(() => this._retryInitialBalance(retryCount + 1), 10000);
        } else {
          engineLogger.error(
            "FlowRobot",
            "Falha persistente ao obter saldo real após 10 tentativas. Robô não iniciará.",
            {},
          );
          this._setError("Não foi possível obter saldo real da Puma após múltiplas tentativas.");
        }
      });
  }

  stop(): void {
    const stack = new Error().stack?.split("\n").slice(2, 5).join(" | ") ?? "";
    console.log("[ROBOT STOP]", { reason: "manual stop() called", caller: stack });
    engineLogger.warn("FlowRobot", "[ROBOT STOP] manual stop()", { stack });
    this._clearTimers();
    this.executionEngine.stop();
    if (this._candleCloseUnsub) {
      this._candleCloseUnsub();
      this._candleCloseUnsub = null;
    }
    this._state.status = "stopped";
    this._state.activeOperation = null;
    this._state.nextTrade = null;
    this._logState("STOPPED");
    this.assetCooldowns.clear();
    this._globalCooldownUntil = 0;
    this.smartRecovery.stopSession();
    // DecisionEngine preserva histórico entre sessões
    this._emit("status-changed");
    this._emitAnalyst("robot.stopped");
  }

  pause(): void {
    if (this._state.status !== "running") return;
    const stack = new Error().stack?.split("\n").slice(2, 5).join(" | ") ?? "";
    console.log("[ROBOT PAUSE]", { caller: stack });
    this._clearTimers();
    this.executionEngine.stop();
    if (this._candleCloseUnsub) {
      this._candleCloseUnsub();
      this._candleCloseUnsub = null;
    }
    this._state.status = "paused";
    this._state.nextTrade = null;
    this._logState("PAUSED");
    this.smartRecovery.pauseSession();
    this._emit("status-changed");
    this._emitAnalyst("robot.paused");
  }

  resume(): void {
    if (this._state.status !== "paused") return;
    this._state.status = "running";
    this._logState("RESUMED");
    this.smartRecovery.resumeSession();
    this._emit("status-changed");
    this._emitAnalyst("robot.resumed");
    this.executionEngine.start();
    this._scheduleNextOperation(5, "STARTUP");
  }

  reset(): void {
    this._clearTimers();
    this.executionEngine.stop();
    if (this._candleCloseUnsub) {
      this._candleCloseUnsub();
      this._candleCloseUnsub = null;
    }
    const config = this._state.config;
    this.smartRecovery.reset();
    this.smartRecovery.regenerateLevelTable();
    this.assetCooldowns.clear();
    this._globalCooldownUntil = 0;
    this._sessionStarted = false;
    const sessionInfo = this.broker.getSessionInfo();
    this._state = this._buildInitialState(config, sessionInfo.currentSession, sessionInfo);
    try {
      localStorage.removeItem(OPERATIONS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // DecisionEngine preserva histórico entre sessões
    this._emit("status-changed");
  }

  updateConfig(config: Partial<RobotConfig>): void {
    this._state.config = { ...this._state.config, ...config };

    if (config.timeframes) {
      this._state.selectedTimeframe = null;
    }

    if (this._state.config.autoDirection && config.direction) {
      this._state.config.direction = config.direction;
    }

    persistConfig(this._state.config);
    this.smartRecovery.regenerateLevelTable();
    this._emit("state-changed");
  }

  updateCalculatorLevels(niveis: number[]): void {
    this.updateConfig({ customLevels: niveis });
  }

  updateCalculatorPayout(payout: number): void {
    this.updateConfig({ payout });
  }

  getCustomLevels(): number[] {
    return [...this._state.config.customLevels];
  }

  getCalculatorPayout(): number {
    return this._state.config.payout;
  }

  getSREState() {
    return this.smartRecovery.getState();
  }

  getSRESummary(): SmartRecoveryDashboard {
    return this.smartRecovery.getDashboard();
  }

  getTableRows() {
    return this.smartRecovery.getLevelTable();
  }

  getActiveLevels() {
    return this.smartRecovery.getLevelTable().filter((r) => r.accLossBefore > 0);
  }

  getSmartRecovery(): SmartRecoveryEngine {
    return this.smartRecovery;
  }

  /** Retorna informações da sessão de mercado atual */
  getSessionInfo(): MarketSessionInfo {
    return this.broker.getSessionInfo();
  }

  /** Retorna a sessão atual (open/closed) */
  getCurrentSession(): MarketSession {
    return this._state.currentSession;
  }

  /** Retorna ms restantes do cooldown global pós-trade (0 = sem cooldown) */
  getGlobalCooldownRemaining(): number {
    const remaining = this._globalCooldownUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /** Retorna o último DecisionContext construído */
  getLastDecisionContext(): DecisionContext | null {
    return this._lastDecisionContext;
  }

  /** Retorna histórico de DecisionContexts (máx. 20) */
  getDecisionHistory(): DecisionContext[] {
    return [...this._decisionHistory];
  }

  /** Retorna o último OperationContext construído */
  getLastOperationContext(): OperationContext | null {
    return this._lastOperationContext;
  }

  /** Retorna histórico de OperationContexts (máx. 100) */
  getOperationHistory(): OperationContext[] {
    return [...this._operationHistory];
  }

  /** Retorna o último ReplayContext construído */
  getLastReplayContext(): ReplayContext | null {
    return this._lastReplayContext;
  }

  /** Retorna histórico de ReplayContexts (máx. 100) */
  getReplayHistory(): ReplayContext[] {
    return [...this._replayHistory];
  }

  /** Retorna o último PerformanceContext construído */
  getLastPerformanceContext(): PerformanceContext | null {
    return this._lastPerformanceContext;
  }

  /** Retorna cooldowns ativos por ativo (asset → ms restantes) */
  getAssetCooldowns(): Record<string, number> {
    const now = Date.now();
    const result: Record<string, number> = {};
    for (const [asset, until] of this.assetCooldowns) {
      const remaining = until - now;
      if (remaining > 0) {
        result[asset] = remaining;
      }
    }
    return result;
  }

  on(listener: RobotListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ── Session Change Handler ──

  private _onSessionChange(from: MarketSession, to: MarketSession, info: MarketSessionInfo): void {
    const fromLabel = from === "open" ? "Mercado Aberto" : "Mercado Fechado";
    const toLabel = to === "open" ? "Mercado Aberto" : "Mercado Fechado";

    engineLogger.info("FlowRobot", `═══ SESSÃO ALTERADA: ${fromLabel} → ${toLabel} ═══`, {
      dataSource: info.dataSource,
      assetsCount: info.assetsCount,
      assets: info.activeAssets.join(", "),
    });

    // Atualiza state com a nova sessão
    this._state.currentSession = to;
    this._state.sessionInfo = info;

    // 1. Limpar scan log, sinais pendentes e cooldowns
    this._state.scanLog = [];
    this._state.lastScannedAsset = null;
    this._state.lastAnalysis = null;
    FlowRobotEngine._pendingCandleClose = false;
    this.assetCooldowns.clear();
    this._globalCooldownUntil = 0;

    engineLogger.info("FlowRobot", "Buffer de análise limpo", {
      scanLogCleared: true,
      pendingSignalsCancelled: true,
    });

    // 2. Reconstruir lista de ativos na config, respeitando seleção do usuário
    const currentAssets = this._state.config.assets?.length
      ? this._state.config.assets
      : info.activeAssets;
    this._state.config.assets = currentAssets.filter((a) => info.activeAssets.includes(a));
    if (this._state.config.assets.length === 0) {
      this._state.config.assets = info.activeAssets;
    }
    if (this._state.config.scanMode === "single") {
      this._state.config.asset = this._state.config.assets.includes(this._state.config.asset)
        ? this._state.config.asset
        : (this._state.config.assets[0] ?? this._state.config.asset);
    }

    engineLogger.info("FlowRobot", "Lista de ativos reconstruída", {
      scanMode: this._state.config.scanMode,
      assetCount: info.assetsCount,
      assets: info.activeAssets.join(", "),
    });

    // 3. Emitir eventos para UI
    this._emit("status-changed");
    this._emitDiaryEntry(
      `Sessão alterada: ${fromLabel} → ${toLabel}. ${info.assetsCount} ativos ativos. Fonte: ${info.dataSource}.`,
      to === "open" ? "🟢" : "🟠",
      "info",
    );

    // 4. Se o robô estava rodando, reiniciar scan com novos ativos
    if (this._state.status === "running") {
      this._clearTimers();
      engineLogger.info("FlowRobot", "Reiniciando scan com ativos da nova sessão", {});

      // Reinscreve no candle close com novos ativos
      if (this._candleCloseUnsub) {
        this._candleCloseUnsub();
      }
      this._candleCloseUnsub = this.broker.subscribeCandleClose((candle) =>
        this._onCandleClose(candle),
      );

      this._scheduleNextOperation(3, "SESSION_CHANGED");
    }
  }

  private _onCandleClose(candle: Candle): void {
    console.log(
      `[TIMING] CANDLE_CLOSE symbol=${candle.asset} time=${candle.time} open=${candle.open} close=${candle.close} tsDate=${Date.now()}`
    );
    latencyTracker.mark("candle_closed", "Candle Closed", {
      asset: candle.asset,
      time: candle.time,
    });

    // Filtra por ativos relevantes
    const isMulti = this._state.config.scanMode === "multi";
    const relevantAssets = isMulti ? this._state.config.assets : [this._state.config.asset];

    if (!relevantAssets.includes(candle.asset)) {
      engineLogger.debug("FlowRobot", `Candle filtrado (asset irrelevante): ${candle.asset}`);
      return;
    }

    // IDEMPOTÊNCIA: ignora candle já processado (mesmo timestamp + asset)
    const lastTime = FlowRobotEngine._lastProcessedCandle.get(candle.asset);
    const isDuplicate = lastTime !== undefined && lastTime >= candle.time;
    console.log("[DUPLICATE CHECK]", {
      asset: candle.asset,
      candleTime: candle.time,
      lastProcessed: lastTime,
      isDuplicate,
      assetActive: !!this._state.activeOperation,
      status: this._state.status,
      isProcessing: FlowRobotEngine._isProcessing,
      pendingCandleClose: FlowRobotEngine._pendingCandleClose,
    });
    if (isDuplicate) {
      engineLogger.debug(
        "FlowRobot",
        `⏭️ Candle duplicado ignorado (idempotência): ${candle.asset} @ ${new Date(candle.time).toLocaleTimeString("pt-BR")} (lastProcessed=${lastTime})`,
      );
      return;
    }
    FlowRobotEngine._lastProcessedCandle.set(candle.asset, candle.time);

    const bufferStatus = this.broker.getBufferStatus();
    engineLogger.info(
      "FlowRobot",
      `🔔 Candle fechado: ${candle.asset} @ ${new Date(candle.time).toLocaleTimeString("pt-BR")}`,
      {
        close: candle.close,
        bufferNow: bufferStatus.map((b) => `${b.key}=${b.count}`).join(", "),
        status: this._state.status,
        isProcessing: FlowRobotEngine._isProcessing,
      },
    );
    this._emitAnalyst("candle.closed", {
      asset: candle.asset,
      time: candle.time,
      close: candle.close,
    });

    // ── BUFFER VISUAL: emit real-time buffer progress on every candle ──
    {
      const bufStatus = this.broker.getBufferStatus();
      const bufEntry = bufStatus.find((b) => b.key === candle.asset);
      const profile = this._state.config.operationProfile ?? "AUTO";
      const capacity = profile === "HYBRID_PROBABILITY" ? 2000 : profile === "HYBRID_FLOW" ? 300 : 500;
      const minimum = getMinCandles(profile);
      if (bufEntry) {
        const current = bufEntry.count;
        const percent = Math.min(100, Math.round((current / capacity) * 100));
        this._emitMarketUpdate({
          bufferVisual: { current, capacity, minimum, percent },
        });

        // ── PER-ASSET BUFFER HEALTH ──
        const lastTimeMs = bufEntry.lastTime !== "N/A" ? new Date(bufEntry.lastTime).getTime() : 0;
        const now = Date.now();
        const secondsWithout = lastTimeMs > 0 ? Math.round((now - lastTimeMs) / 1000) : 999;
        const isReceiving = secondsWithout < 3;
        const bufferHealth: "live" | "waiting" | "stale" = secondsWithout < 3 ? "live" : secondsWithout < 10 ? "waiting" : "stale";
        const bufferStatus = isReceiving ? "Recebendo candles" : secondsWithout < 10 ? "Aguardando proximo candle" : `Buffer desatualizado (${secondsWithout}s)`;

        analystBus.emit("buffer.asset.update" as AnalystEventType, {
          asset: candle.asset,
          current,
          capacity,
          minimum,
          percent,
          lastCandleTime: lastTimeMs,
          secondsWithoutCandles: secondsWithout,
          isReceiving,
          bufferHealth,
          bufferStatus,
        });
      }
    }

    // _onCandleClose NÃO gera nextTrade — apenas sincroniza estado.
    // A decisão de trade é responsabilidade EXCLUSIVA de _onDecisionTime.
    // Isso elimina a race condition onde a análise pós-fechamento sobrescrevia
    // a decisão tomada na janela de decisão (~200ms antes do fechamento).
    if (this._state.status === "running" && !this._state.activeOperation) {
      // Se há um nextTrade pendente definido por _onDecisionTime, não faz nada
      if (this._state.nextTrade?.valid) {
        engineLogger.info(
          "FlowRobot",
          `Candle fechado — nextTrade #${this._state.nextTrade.decisionId} aguardando execução`,
          {},
        );
        return;
      }
      // Sem nextTrade — apenas log, sem análise.
      // _onDecisionTime cuidará da próxima janela.
      engineLogger.info(
        "FlowRobot",
        "Candle fechado — sem nextTrade. Aguardando próxima janela de decisão.",
        {},
      );
      FlowRobotEngine._pendingCandleClose = false;
    } else if (this._state.status === "running" && FlowRobotEngine._isProcessing) {
      engineLogger.info("FlowRobot", "Candle fechado durante processamento — ignorado.", {});
    }
  }

  // ── ExecutionEngine Handlers ──

  /**
   * Chamado pelo ExecutionEngine ~200ms antes do fechamento do candle.
   * Executa a análise FINAL (DecisionEngine + SmartRecovery) e armazena
   * o resultado como nextTrade para execução na abertura do candle.
   */
  private async _onDecisionTime(): Promise<void> {
    const decisionTraceId = this._state.nextTrade?.traceId ?? makeTraceId();
    const _asset = this._state.config.asset;
    const _tf = this._state.selectedTimeframe ?? this._state.config.timeframes?.[0] ?? "?";
    const _profile = this._state.config.operationProfile ?? "?";

    const tl = DecisionTimeline.start(decisionTraceId);
    tl.event("SCHEDULER", { asset: _asset, tf: _tf, profile: _profile, status: this._state.status });

    engineLogger.info("FlowRobot", `[DECISION] ENTRY — asset=${_asset} tf=${_tf} profile=${_profile}`, {
      traceId: decisionTraceId,
      hasActiveOp: !!this._state.activeOperation,
      hasNextTrade: !!this._state.nextTrade,
      status: this._state.status,
      isProcessing: FlowRobotEngine._isProcessing,
    });
    schedulerMetrics.recordDecision();

    const _exitLog = (status: DecisionExitStatus, extra?: Record<string, unknown>) => {
      tl.end(status, extra);
      tl.log();
      engineLogger.info("FlowRobot", `[DECISION] EXIT — status=${status} asset=${_asset} tf=${_tf}`, {
        status,
        traceId: decisionTraceId,
        ...extra,
      });
      if (status === "APPROVED") schedulerMetrics.recordApproved();
      else if (status.startsWith("BLOCKED")) {
        const reason = (extra?.reason as string) ?? status.replace("BLOCKED_", "");
        schedulerMetrics.recordBlockedReason(reason);
      }
      else if (status === "ERROR") schedulerMetrics.recordError();
    };

    try {
      const t0 = performance.now();
      const tsDate = Date.now();
      const tsClock = this.executionEngine.clock.now;
      console.log(`[AUDIT] [FLOW_START] local=${new Date().toISOString()} perf=${t0}`);
      console.log(
        `[TIMING] DECISION_TIME_START asset=${_asset} tf=${_tf} status=${this._state.status} tsDate=${tsDate} tsClock=${tsClock} tsPerf=${t0.toFixed(2)}`
      );
      
      const _ts = new Date().toLocaleTimeString("pt-BR");
      engineLogger.info("FlowRobot", "===== DECISION START =====");
      console.log("NEXT_TRADE =", this._state.nextTrade);
      console.log(
        `[FLOW DIAG] ${_ts} ═══ _onDecisionTime chamado ═══ asset=${_asset} tf=${_tf} profile=${_profile} status=${this._state.status} session=${this._state.currentSession}`,
      );

      if (this._state.status !== "running") {
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: status !== "running" ═══ status=${this._state.status} asset=${this._state.config.asset}`,
        );
        console.log(
          "[DUPLICATE CHECK] _onDecisionTime ignored — status not running:",
          this._state.status,
        );
        _exitLog("BLOCKED_STATUS", { status: this._state.status });
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU status");
      if (FlowRobotEngine._isProcessing) {
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: _isProcessing=true ═══ asset=${this._state.config.asset}`,
        );
        console.log("[DUPLICATE CHECK] _onDecisionTime ignored — _isProcessing=true");
        _exitLog("BLOCKED_PROCESSING");
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU _isProcessing");
      if (this._state.activeOperation) {
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: activeOperation pendente ═══ orderId=${this._state.activeOperation.orderId} asset=${this._state.config.asset}`,
        );
        engineLogger.info("FlowRobot", "Operação ativa pendente — pulando janela de decisão", {});
        _exitLog("BLOCKED_ACTIVE_OP", { orderId: this._state.activeOperation.orderId });
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU activeOperation");

      // TRAVA MUTEX: impede _runOperationCycle de rodar concorrentemente
      FlowRobotEngine._isProcessing = true;
      tl.event("MUTEX_ACQUIRED");

      engineLogger.info("FlowRobot", `═══ JANELA DE DECISÃO (~200ms antes do fechamento) ═══`, {});

      // Risk checks rápidos
      const profit = this._state.currentBankroll - this._state.initialBankroll;
      const crrBk = this._state.currentBankroll;
      const initBk = this._state.initialBankroll;
      const cfgSl = this._state.config.stopLoss;
      const cfgTp = this._state.config.targetProfit;
      const srStopped = this.smartRecovery.isStopped();

      if (profit >= cfgTp) {
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "Meta de lucro atingida!",
          currentLevel: this.smartRecovery.getState().currentLevel,
          dailyLoss: this.smartRecovery.getState().dailyLoss,
        });
        this._stopByRisk("Meta de lucro atingida!");
        _exitLog("BLOCKED_RISK", { reason: "PROFIT_TARGET" });
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU risk");
      if (-profit >= cfgSl) {
        const srState = this.smartRecovery.getState();
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "Stop loss atingido!",
          currentLevel: srState.currentLevel,
          dailyLoss: srState.dailyLoss,
          isStopAtingido: srState.isStopAtingido,
          phase: srState.phase,
        });
        this._stopByRisk("Stop loss atingido!");
        _exitLog("BLOCKED_RISK", { reason: "STOP_LOSS" });
        return;
      }
      if (srStopped) {
        const srState = this.smartRecovery.getState();
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "smartRecovery.isStopped()",
          sorosPhase: srState.phase,
          dailyLoss: srState.dailyLoss,
          consecutiveLosses: srState.consecutiveLosses,
          isStopAtingido: srState.isStopAtingido,
        });
        this._stopByRisk("Saldo insuficiente para continuar.");
        _exitLog("BLOCKED_RISK", { reason: "SMART_RECOVERY_STOPPED" });
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU smartRecovery");
      tl.event("RISK_CHECK", { profit: profit.toFixed(2), bankroll: crrBk });
      console.log("[STOP CHECK]", {
        initialBankroll: initBk,
        currentBankroll: crrBk,
        profit,
        stopLoss: cfgSl,
        targetProfit: cfgTp,
        shouldStop: false,
        srStopped,
        currentLevel: this.smartRecovery.getState().currentLevel,
        dailyLoss: this.smartRecovery.getState().dailyLoss,
      });

      // Demo daily limit
      const tradesToday = this._countTradesToday();
      if (tradesToday >= DEMO_DAILY_LIMIT) {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: cooldown");
        this._stopByRisk("Limite diário da conta demo atingido (50 trades).");
        _exitLog("BLOCKED_RISK", { reason: "DEMO_DAILY_LIMIT", tradesToday });
        return;
      }
      engineLogger.info("FlowRobot", "[FLOW DIAG] PASSOU entryValue");

      // Se já temos nextTrade válido (definido pelo ciclo anterior), não recalcula
      if (this._state.nextTrade?.valid) {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: payout");
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: nextTrade já válido ═══ direction=${this._state.nextTrade.direction} asset=${this._state.config.asset}`,
        );
        engineLogger.info("FlowRobot", "NextTrade já definido — mantendo decisão anterior", {});
        _exitLog("BLOCKED_DUPLICATE", { nextDirection: this._state.nextTrade.direction });
        return;
      }

      // Get entry params
      console.log("[FLOW] Antes do getEntry (decision window)");
      const entrada = this.smartRecovery.getEntry();
      console.log("[SOROSGALE]", {
        level: entrada.level,
        entry: entrada.entry,
        stake: entrada.valor,
        isSoros: entrada.isSoros,
      });
      if (entrada.valor <= 0) {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: activeOperation");
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: entrada.valor <= 0 ═══ valor=${entrada.valor} level=${entrada.level} asset=${this._state.config.asset}`,
        );
        this._scheduleNextOperation(this._getIntervalSeconds(), "INVALID_ENTRY");
        _exitLog("BLOCKED_INVALID_ENTRY", { valor: entrada.valor, level: entrada.level });
        return;
      }

      // Health check pré-scan
      await this._runHealthCheck();
      tl.event("HEALTH_CHECK");

      // Analyze market direction
      engineLogger.info("FlowRobot", "===== BEFORE ANALYZE =====");
      const tAnalyze0 = performance.now();
      console.log(
        `[TIMING] BEFORE_ANALYZE asset=${this._state.config.asset} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`
      );
      const marketDir = await this._analyzeMarketDirection();
      const msAnalyze = performance.now() - tAnalyze0;
      tl.event("ANALYZE", { direction: marketDir ?? "null" }, msAnalyze);
      engineLogger.info("FlowRobot", "===== AFTER ANALYZE =====", { direction: marketDir });
      console.log(
        `[TIMING] AFTER_ANALYZE asset=${this._state.config.asset} direction=${marketDir} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`
      );

      // ══ SIGNAL LOG: registra toda análise HYBRID_PROBABILITY ══
      if (
        this._state.config.operationProfile === "HYBRID_PROBABILITY" &&
        this._state.lastAnalysis?.hybridProbability
      ) {
        const hp = this._state.lastAnalysis.hybridProbability;
        const cfg: Partial<HybridProbabilityConfig> =
          this._state.config.hybridProbabilityConfig ?? {};
        const logAsset = this._state.config.asset;
        const logTimeframe = this._state.selectedTimeframe ?? this._state.config.timeframes[0];
        const signalEntry = signalLogger.log({
          engineVersion: ENGINE_VERSION,
          databaseVersion: DATABASE_VERSION,
          patternCatalogVersion: PATTERN_CATALOG_VERSION,
          asset: logAsset,
          timeframe: logTimeframe,
          status: hp.signalStatus,
          direction: hp.direction,
          blockedReasons: hp.blockedReasons,
          setup: hp.setup,
          indicators: hp.indicators,
          pattern: {
            id: "continuity-2c",
            name: "2 Candle Continuation",
            occurrences: hp.historicalPatterns,
            winRate: hp.historicalWinrate ?? 0,
            confidence: hp.probabilityScore.breakdown.confidence,
          },
          scores: {
            technicalScore: hp.technicalScore.total,
            probabilityScore: hp.probabilityScore.total,
            decisionScore: hp.decisionScore.total,
            probabilityWeight: cfg.probabilityWeight ?? 0.2,
          },
          filters: hp.signalFilters,
          config: {
            flowIndexWindow: cfg.flowIndexWindow ?? 20,
            historySize: cfg.historySize ?? 2000,
            probabilityWeight: cfg.probabilityWeight ?? 0.2,
            minScore: cfg.minScore ?? 75,
            adxMin: cfg.adxMin ?? 25,
            atrMin: cfg.atrMin ?? 1.0,
            ema200Enabled: cfg.ema200Enabled ?? true,
            flowIndexMin: cfg.flowIndexMin ?? 0.55,
          },
          candlesUsed: hp.candlesUsed ?? 0,
          processingTimeMs: hp.processingTimeMs,
          result: null,
          orderId: null,
          decisionId: null,
          decisionTree: hp.decisionTree,
        });
        this._lastSignalLogId = signalEntry.id;
        engineLogger.info(
          "FlowRobot",
          `📋 Signal logged: ${hp.signalStatus} — ${logAsset} ${logTimeframe}`,
          {
            signalId: signalEntry.id,
            decisionScore: hp.score,
            status: hp.signalStatus,
          },
        );
      }
      if (!marketDir) {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: analyzeMarketDirection");
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: _analyzeMarketDirection retornou null ═══ asset=${this._state.config.asset} profile=${this._state.config.operationProfile} session=${this._state.currentSession}`,
        );
        engineLogger.info("FlowRobot", "Sem sinal na janela de decisão — reagendando próximo ciclo", {});
        this._scheduleNextOperation(this._getIntervalSeconds(), "NO_SIGNAL");
        _exitLog("BLOCKED_NO_SIGNAL", {});
        return;
      }

      console.log(
        `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ SINAL ENCONTRADO ═══ direction=${marketDir} asset=${this._state.config.asset} profile=${this._state.config.operationProfile}`,
      );

      // ══ COOLDOWN GLOBAL na janela de decisão ══
      const cooldownRemaining = this._globalCooldownUntil - Date.now();
      if (cooldownRemaining > 0) {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: cooldown");
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: cooldown global ativo ═══ remaining=${Math.ceil(cooldownRemaining / 1000)}s asset=${this._state.config.asset}`,
        );
        engineLogger.info(
          "FlowRobot",
          `⏳ Cooldown global ativo na janela de decisão — ${Math.ceil(cooldownRemaining / 1000)}s restantes — reagendando`,
          {},
        );
        this._scheduleNextOperation(Math.ceil(cooldownRemaining / 1000) + 1, "COOLDOWN_ACTIVE");
        _exitLog("BLOCKED_COOLDOWN", { cooldownRemaining: Math.ceil(cooldownRemaining / 1000) });
        return;
      }

      const selectedTimeframe = this._state.selectedTimeframe ?? this._state.config.timeframes[0];
      const asset = this._state.config.asset;

      // Log stage timings from DecisionResult to timeline
      if (this._state.lastAnalysis?.stageTimings) {
        const st = this._state.lastAnalysis.stageTimings;
        tl.stageTiming("STAGE_TIMING", {
          Trend: st.trend,
          Structure: st.structure,
          PriceAction: st.priceAction,
          SmartMoney: st.smartMoney,
          Momentum: st.momentum,
          Score: st.score,
        }, st.total);
      }
      const expiration =
        TIMEFRAME_EXPIRATION_MAP[selectedTimeframe] ?? this._state.config.expirationSeconds;
      const entryPrice = (() => {
        const analysis = this._state.lastAnalysis;
        const candles = analysis?.candles;
        if (candles && candles.length > 0) {
          return candles[candles.length - 1].close;
        }
        return 0;
      })();
      const payout = await this.broker.getPayout(asset).catch(() => 0.85);
      const score = this._state.lastAnalysis?.probability?.total ?? 0;
      tl.event("SIGNAL", { direction: marketDir, score, asset, tf: selectedTimeframe });

      // Re-verificação PÓS-AWAIT: descarta sinal se ordem já foi executada durante a análise
      if (this._state.activeOperation || this._state.status !== "running") {
        engineLogger.warn("FlowRobot", "[FLOW DIAG] BLOQUEADO: cooldown");
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: pós-análise race condition ═══ hasActiveOp=${!!this._state.activeOperation} status=${this._state.status} asset=${this._state.config.asset}`,
        );
        engineLogger.info("FlowRobot", "Ordem executada durante análise — sinal descartado", {
          hasActiveOp: !!this._state.activeOperation,
          status: this._state.status,
        });
        _exitLog("BLOCKED_RACE_CONDITION", { hasActiveOp: !!this._state.activeOperation, status: this._state.status });
        return;
      }

      // Armazena decisão como nextTrade (NÃO envia ordem ainda)
      const did = this._nextDecisionId();
      const traceId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const signalCandle = (() => {
        const analysisCandles = this._state.lastAnalysis?.candles;
        return analysisCandles && analysisCandles.length > 0 ? analysisCandles[analysisCandles.length - 1] : null;
      })();
      const signalCandleTime = signalCandle?.time ?? 0;
      const signalCandleOpen = signalCandle?.open ?? 0;
      const signalCandleClose = signalCandle?.close ?? 0;
      const candleId = `${asset}_${selectedTimeframe}_${signalCandleTime}`;
      const nowTs = Date.now();
      const clockNow = this.executionEngine.clock.now;
      const perfNow = performance.now();

      console.log(
        `[TIMING] DECISION_START traceId=${traceId} asset=${asset} tf=${selectedTimeframe} dir=${marketDir} signalCandleTime=${signalCandleTime} signalCandleClose=${signalCandleClose} tsDate=${nowTs} tsClock=${clockNow} tsPerf=${perfNow.toFixed(2)}`
      );

      const nextTrade: NextTrade = {
        traceId,
        decisionId: did,
        symbol: asset,
        direction: marketDir,
        score,
        amount: entrada.valor,
        expiration,
        entryPrice,
        payout,
        timeframe: selectedTimeframe,
        valid: true,
        decidedAt: nowTs,
        signalCandleTime,
        signalCandleOpen,
        signalCandleClose,
        candleId,
      };
      latencyTracker.mark("order_created", "Order Created (decision window)", {
        traceId,
        asset,
        direction: marketDir,
        score,
        decisionId: did,
        signalCandleTime,
        candleId,
      });
      latencyTracker.beginTrade(`trade-${did}`);

      console.log("[FLOW SEND]", {
        traceId,
        decisionId: did,
        amount: entrada.valor,
        level: entrada.level,
        entry: entrada.entry,
        direction: marketDir,
        score,
        signalCandleTime,
        candleId,
      });
      console.log("1 Melhor Trade", nextTrade);
      console.log("2 Antes do setNextTrade");
      const t1 = performance.now();
      console.log(`[AUDIT] [FLOW_END] asset=${asset} decisionId=${did} perf=${t1}`);
      console.log(
        `[TIMING] BEFORE_SET_NEXT_TRADE traceId=${traceId} asset=${asset} dir=${marketDir} signalCandle=${signalCandleTime} tsDate=${Date.now()} tsPerf=${t1.toFixed(2)}`
      );
      this.executionEngine.setNextTrade(nextTrade);
      tl.event("NEXT_TRADE_SET", { decisionId: did, direction: marketDir, stake: entrada.valor });
      console.log(
        `[TIMING] AFTER_SET_NEXT_TRADE traceId=${traceId} asset=${asset} tsDate=${Date.now()} tsPerf=${performance.now().toFixed(2)}`
      );
      console.log("3 Depois do setNextTrade");
      console.log("4 executionEngine.nextTrade", this.executionEngine.nextTrade);
      latencyTracker.mark("order_queued", "Order Queued");
      this._state.nextTrade = nextTrade;
      this._state.currentEntry = entrada.valor;
      this._state.entryNumber = entrada.entry;
      this._logState("NEXT_TRADE_SET", { direction: marketDir, score, stake: entrada.valor });
      this._emit("state-changed");

      // ══ DECISION CONTEXT ══
      if (this._state.lastAnalysis) {
        const selectedTf = this._state.selectedTimeframe ?? this._state.config.timeframes[0];
        this._lastDecisionContext = buildDecisionContext(this._state.lastAnalysis, {
          timeframe: selectedTf,
          marketType: DecisionEngine.isCryptoAsset(asset) ? "CRYPTO" : "FOREX",
        });
        this._decisionHistory.push(this._lastDecisionContext);
        if (this._decisionHistory.length > FlowRobotEngine.MAX_DECISION_HISTORY) {
          this._decisionHistory = this._decisionHistory.slice(
            -FlowRobotEngine.MAX_DECISION_HISTORY,
          );
        }
        this._emitDecisionContext(this._lastDecisionContext);
      }

      engineLogger.info("FlowRobot", `═══ DECISÃO #${did} ARMAZENADA para próximo candle ═══`, {
        decisionId: did,
        symbol: asset,
        direction: marketDir,
        score,
        amount: entrada.valor,
        candleOpenIn: `${this.executionEngine.clock.msToNextCandle}ms`,
      });
      const decisionAnalysis = this._state.lastAnalysis;
      const decidedTime = nextTrade.decidedAt;
      const decisionCandle = Math.floor(decidedTime / 60000) * 60000;
      const executionCandle = decisionCandle + 60000;
      const candleLabel = new Date(decisionCandle).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      console.log("[DECISION TRACE]", {
        decisionId: did,
        asset,
        direction: marketDir,
        stake: entrada.valor,
        decisionCandle: new Date(decisionCandle).toISOString(),
        executionCandle: new Date(executionCandle).toISOString(),
        createdFrom: `Candle(${candleLabel})`,
        EMA: decisionAnalysis?.trend?.emaAlignment ?? "N/A",
        RSI: decisionAnalysis?.momentum?.rsiZone ?? "N/A",
        FVG: decisionAnalysis?.smartMoney?.fvg !== null,
        Liquidity: decisionAnalysis?.smartMoney?.liquiditySweep !== null,
        Score: decisionAnalysis?.scoreBreakdown?.total,
        filters:
          decisionAnalysis?.scoreBreakdown?.filters
            ?.map((f) => `${f.name}=${f.points}/${f.maxPoints}`)
            .join(", ") ?? "N/A",
      });
      _exitLog("APPROVED", {
        decisionId: did,
        direction: marketDir,
        score,
        stake: entrada.valor,
        traceId,
      });
    } catch (err) {
      engineLogger.error("FlowRobot", "Erro na janela de decisão", {
        error: String(err),
      });
      _exitLog("ERROR", { error: String(err) });
    } finally {
      FlowRobotEngine._isProcessing = false;
    }
  }

  /**
   * Chamado pelo ExecutionEngine na abertura EXATA do candle (via clock).
   * Apenas atualiza estado — a ordem já foi enviada pelo ExecutionEngine.
   */
  private _onExecutionCandleOpen(time: number): void {
    engineLogger.info("FlowRobot", `═══ CANDLE ABRIU: ${new Date(time).toISOString()} ═══`, {
      hasNextTrade: !!this._state.nextTrade?.valid,
      precision: this._state.lastEntryPrecision,
    });

    // NÃO recalcular nada aqui — apenas registrar
    this._emitAnalyst("candle.new", { symbol: this._state.config.asset, time });
  }

  /**
   * Chamado pelo ExecutionEngine após a ordem ser executada.
   * Atualiza estado do robô com o resultado da execução.
   */
  private async _onEntryExecuted(record: EntryRecord): Promise<void> {
    engineLogger.info("FlowRobot", `═══ ORDEM EXECUTADA PELO EXECUTION ENGINE ═══`, {
      tradeId: record.tradeId,
      symbol: record.symbol,
      totalLatency: `${record.totalLatency}ms`,
    });

    // Atualiza estatísticas de precisão
    this._state.lastEntryPrecision = record.totalLatency;
    this._state.avgEntryPrecision = this.executionEngine.averageEntryPrecision;
    this._state.bestEntryPrecision = this.executionEngine.bestEntryPrecision;
    this._state.worstEntryPrecision = this.executionEngine.worstEntryPrecision;

    // Registra operação
    const operation: RobotOperation = {
      id: `op-${Date.now()}`,
      asset: record.symbol,
      direction: this._state.nextTrade?.direction ?? "call",
      amount: this._state.nextTrade?.amount ?? 0,
      recoveryStep: this._state.currentRecoveryStep,
      entryNumber: 1,
      orderId: record.tradeId,
      status: "active",
      result: "pending",
      openedAt: new Date(record.sendTime),
      payout: this._state.nextTrade?.payout ?? 0.85,
      profit: 0,
      entryPrice: this._state.nextTrade?.entryPrice ?? 0,
      timeframe: this._state.nextTrade?.timeframe ?? record.timeframe ?? "M1",
      expirationSeconds:
        this._state.nextTrade?.expiration ??
        TIMEFRAME_EXPIRATION_MAP[record.timeframe] ??
        this._state.config.expirationSeconds ??
        60,
    };

    this._state.activeOperation = operation;
    this._state.status = "waiting-result";
    this._logState("WAITING_RESULT", { orderId: operation.orderId });
    this._emit("operation-opened", operation);

    const tradeExpiration =
      this._state.nextTrade?.expiration ??
      TIMEFRAME_EXPIRATION_MAP[record.timeframe] ??
      this._state.config.expirationSeconds;

    this._state.nextTrade = null;
    this.executionEngine.clearNextTrade();

    // Aguarda resultado
    try {
      const result = await this.broker.waitForTradeResult(
        record.tradeId,
        (tradeExpiration + 15) * 1000,
      );
      let finalStatus = result.status;
      let brokerProfit = result.profit;
      console.log("[TRADE STATUS]", {
        tradeId: record.tradeId,
        oldStatus: "PENDING",
        newStatus: finalStatus,
        profit: brokerProfit,
      });
      console.log(
        `[DEBUG-TRADE] 🤖 flow-robot-engine: finalStatus=${finalStatus}, profit=${brokerProfit} for tradeId=${record.tradeId}`,
      );
      latencyTracker.mark("trade_result", "Trade Result", {
        tradeId: record.tradeId,
        status: finalStatus,
      });

      // Se retornou ACTIVE, o resultado não foi resolvido ainda — faz retry com polling direto
      if (finalStatus === "ACTIVE") {
        engineLogger.warn(
          "FlowRobot",
          `⚠️ waitForTradeResult retornou ACTIVE — fazendo retry manual para ${record.tradeId}`,
          {},
        );
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const polled = await this.broker.getResult(record.tradeId);
            if (polled.status !== "ACTIVE") {
              finalStatus = polled.status;
              brokerProfit = polled.profit;
              engineLogger.info("FlowRobot", `✅ Retry manual resolveu: ${finalStatus}`, {
                tradeId: record.tradeId,
                attempt,
              });
              break;
            }
          } catch {
            // continua tentando
          }
        }
        if (finalStatus === "ACTIVE") {
          engineLogger.error(
            "FlowRobot",
            `❌ Retry manual esgotou — trade ${record.tradeId} ainda ACTIVE. Tratando como DRAW temporário.`,
            {},
          );
        }
      }

      // Hook: permite sobrescrever resultado do broker via config.onTradeResult
      let effectiveStatus = finalStatus;
      if (this._state.config.onTradeResult) {
        const customResult = this._state.config.onTradeResult({
          tradeId: record.tradeId,
          asset: record.symbol,
          direction: operation.direction,
          amount: operation.amount,
          brokerResult: finalStatus as "WIN" | "LOSS" | "DRAW" | "UNKNOWN",
          entryPrice: operation.entryPrice ?? 0,
        });
        if (customResult) {
          engineLogger.info("FlowRobot", "Resultado sobrescrito por onTradeResult", {
            tradeId: record.tradeId,
            brokerResult: finalStatus as "WIN" | "LOSS" | "DRAW" | "UNKNOWN",
            customResult,
          });
          effectiveStatus = customResult;
        }
      }

      // DRAW detection: se broker retorna LOSS com profit=0, é empate
      if (effectiveStatus === "LOSS" && brokerProfit === 0) {
        engineLogger.info("FlowRobot", `🔄 DRAW detectado: status=LOSS mas profit=0. Tratando como DRAW.`, {
          tradeId: record.tradeId,
          finalStatus,
          brokerProfit,
        });
        effectiveStatus = "DRAW";
      }

      // UNKNOWN: trade não encontrada (404 do daemon) — não altera SorosGale
      if (effectiveStatus === "UNKNOWN") {
        engineLogger.warn(
          "FlowRobot",
          `⚠️ Resultado UNKNOWN para ${record.tradeId} — trade não localizada. Limpando fila sem alterar SorosGale.`,
          {},
        );
        operation.result = "unknown";
        operation.profit = 0;
        operation.status = "completed";
        operation.closedAt = new Date();
        this._state.operations.unshift(operation);
        this._state.activeOperation = null;
        this._state.status = "running";
        persistOperations(this._state.operations);
        this._emit("operation-closed", operation);
        this._globalCooldownUntil =
          Date.now() + (this._state.config.globalCooldownSec ?? 180) * 1000;
        engineLogger.info(
          "FlowRobot",
          `⏳ Cooldown global ativado por ${this._state.config.globalCooldownSec ?? 180}s após UNKNOWN`,
          {},
        );
        console.log("[EXECUTION QUEUE]", {
          decisionId: record.decisionId,
          tradeId: record.tradeId,
          removed: true,
          reason: "UNKNOWN",
          pendingTrades: 0,
        });
        return;
      }

      // Previne duplicatas: se operação com o mesmo orderId já existe, não adiciona novamente
      const existingOperationIndex = this._state.operations.findIndex(
        (op) => op.orderId === record.tradeId,
      );
      if (existingOperationIndex !== -1) {
        engineLogger.warn(
          "FlowRobot",
          `⚠️ Operação duplicada detectada para o mesmo orderId: ${record.tradeId}`,
          {},
        );
        operation.result = "unknown";
        operation.profit = operation.profit; // Mantém o profit original ao invés de zerar
        operation.status = "completed";
        operation.closedAt = new Date();
        this._state.operations[existingOperationIndex] = operation;
        this._state.activeOperation = null;
        this._state.status = "running";
        persistOperations(this._state.operations);
        this._emit("operation-closed", operation);
        this._globalCooldownUntil =
          Date.now() + (this._state.config.globalCooldownSec ?? 180) * 1000;
        engineLogger.info(
          "FlowRobot",
          `⏳ Cooldown global ativado por ${this._state.config.globalCooldownSec ?? 180}s após DUPLICATA`,
          {},
        );
        console.log("[EXECUTION QUEUE]", {
          decisionId: record.decisionId,
          tradeId: record.tradeId,
          removed: true,
          reason: "DUPLICATA",
          pendingTrades: 0,
        });
        return;
      }

      console.log("[RESULT ROUTER]", {
        tradeId: record.tradeId,
        symbol: record.symbol,
        brokerStatus: finalStatus,
        effectiveStatus,
        isWin: effectiveStatus === "WIN",
        isLoss: effectiveStatus === "LOSS",
        isDraw: effectiveStatus !== "WIN" && effectiveStatus !== "LOSS",
      });

      const isWin = effectiveStatus === "WIN";
      const isLoss = effectiveStatus === "LOSS";

      if (isWin) {
        operation.result = "win";
        operation.profit = +(operation.amount * operation.payout).toFixed(2);
        const winLevelAntes = this.smartRecovery.getState().currentLevel;
        this.smartRecovery.registerWin(operation.direction, operation.payout);
        const winLevelDepois = this.smartRecovery.getState().currentLevel;
        const winStake = this.smartRecovery.getCurrentStake();
        console.log("[SOROSGALE STATE]", {
          decisionId: record.decisionId,
          result: "WIN",
          previousLevel: winLevelAntes,
          currentLevel: winLevelDepois,
          nextStake: winStake,
        });
        this._state.totalWins++;

        this._state.sessionProfit += operation.profit;
        this._refreshBalance().catch((err) =>
          engineLogger.error("FlowRobot", "Falha ao atualizar saldo após WIN", {
            error: String(err),
          }),
        );
        this._state.currentEntry = winStake;
        this._state.entryNumber = this.smartRecovery.getState().entryNumber;
        this._state.currentRecoveryStep = winLevelDepois;
        this._emitAnalyst("trade.win", { profit: operation.profit });
      } else if (isLoss) {
        operation.result = "loss";
        operation.profit = -operation.amount;
        const levelAntes = this.smartRecovery.getState().currentLevel;
        this.smartRecovery.registerLoss(operation.direction);
        const levelDepois = this.smartRecovery.getState().currentLevel;
        console.log("[SOROSGALE STATE]", {
          decisionId: record.decisionId,
          result: "LOSS",
          previousLevel: levelAntes,
          currentLevel: levelDepois,
          nextStake: this.smartRecovery.getCurrentStake(),
        });
        engineLogger.info(
          "FlowRobot",
          `📉 LOSS registrado: nível ${levelAntes} → ${levelDepois}, stake=${operation.amount}`,
          {
            levelAntes,
            levelDepois,
            amount: operation.amount,
            entryAntes: operation.entryNumber,
            entryDepois: this.smartRecovery.getState().entryNumber,
          },
        );
        this._state.totalLosses++;
        const cooldownMs = (this._state.config.assetCooldownMinutes ?? 5) * 60 * 1000;
        this.assetCooldowns.set(operation.asset, Date.now() + cooldownMs);
        engineLogger.info(
          "FlowRobot",
          `Cooldown ativado para ${operation.asset} — ${this._state.config.assetCooldownMinutes ?? 5}min após loss`,
          {},
        );
        this._state.sessionProfit -= operation.amount;
        this._refreshBalance().catch((err) =>
          engineLogger.error("FlowRobot", "Falha ao atualizar saldo após LOSS", {
            error: String(err),
          }),
        );
        this._state.currentEntry = this.smartRecovery.getCurrentStake();
        this._state.entryNumber = this.smartRecovery.getState().entryNumber;
        this._state.currentRecoveryStep = this.smartRecovery.getState().currentLevel;
        this._emitAnalyst("trade.loss", { loss: operation.amount });
      } else {
        console.log(
          `[DEBUG-TRADE] 🤖 flow-robot-engine: DRAW branch taken! finalStatus was="${finalStatus}", isWin=${isWin}, isLoss=${isLoss}`,
        );
        operation.result = "draw";
        operation.profit = 0;
        const drawLevelAntes = this.smartRecovery.getState().currentLevel;
        this.smartRecovery.registerDraw(operation.direction);
        const drawLevelDepois = this.smartRecovery.getState().currentLevel;
        console.log("[SOROSGALE STATE]", {
          decisionId: record.decisionId,
          result: "DRAW",
          previousLevel: drawLevelAntes,
          currentLevel: drawLevelDepois,
          nextStake: this.smartRecovery.getCurrentStake(),
        });
        this._state.totalDraws++;
        this._state.currentEntry = this.smartRecovery.getCurrentStake();
        this._state.entryNumber = this.smartRecovery.getState().entryNumber;
        this._state.currentRecoveryStep = this.smartRecovery.getState().currentLevel;
        this._emitAnalyst("trade.draw", {});
      }

      // Feedback loop: recalibrar pesos do ScoreEngine a cada trade
      if (this._state.lastAnalysis?.scoreBreakdown?.filters) {
        ScoreEngine.recordResult(this._state.lastAnalysis.scoreBreakdown.filters, isWin);
      }
      ScoreEngine.recalibrateWeights();

      // ══ COOLDOWN GLOBAL ══
      // Definido ANTES de limpar activeOperation/status para evitar race condition
      // com _runOperationCycle (que verifica cooldown antes de entrar)
      this._globalCooldownUntil = Date.now() + (this._state.config.globalCooldownSec ?? 180) * 1000;
      engineLogger.info(
        "FlowRobot",
        `⏳ Cooldown global ativado por ${this._state.config.globalCooldownSec ?? 180}s após trade`,
        {},
      );

      operation.status = "completed";
      operation.closedAt = new Date();
      this._state.operations.unshift(operation);
      this._state.activeOperation = null;
      this._state.status = "running";

      // ══ OPERATION CONTEXT ══
      if (this._lastDecisionContext) {
        const strategyManager = StrategyManager.getInstance();
        const strategy = strategyManager.getActiveProfile();
        const operationStatus = isWin ? "WIN" : isLoss ? "LOSS" : "DRAW";
        const lastAnalysis = this._state.lastAnalysis;
        const opCtx = buildOperationContext({
          decisionContext: this._lastDecisionContext,
          entryRecord: record,
          brokerTradeId: record.tradeId,
          direction: operation.direction.toUpperCase() as "CALL" | "PUT",
          status: operationStatus,
          entryPrice: operation.entryPrice,
          exitPrice: 0,
          profit: operation.profit,
          amount: operation.amount,
          payout: operation.payout,
          expiration: operation.expirationSeconds,
          broker: "Puma",
          executionSource: "AUTO",
          score: lastAnalysis?.scoreBreakdown?.total ?? 0,
          recoveryLevel: this._state.currentRecoveryStep,
          isRecovery: this._state.currentRecoveryStep > 0,
        });
        this._lastOperationContext = opCtx;
        this._operationHistory.unshift(opCtx);
        if (this._operationHistory.length > FlowRobotEngine.MAX_OPERATION_HISTORY) {
          this._operationHistory = this._operationHistory.slice(
            -FlowRobotEngine.MAX_OPERATION_HISTORY,
          );
        }
        this._emitOperationContext(opCtx);

        // Build and emit ReplayContext (pure reconstruction, no recalculation)
        if (this._lastDecisionContext) {
          const replayCtx = buildReplayContext(opCtx, this._lastDecisionContext);
          this._lastReplayContext = replayCtx;
          this._replayHistory.unshift(replayCtx);
          if (this._replayHistory.length > FlowRobotEngine.MAX_REPLAY_HISTORY) {
            this._replayHistory = this._replayHistory.slice(-FlowRobotEngine.MAX_REPLAY_HISTORY);
          }
          this._emitReplayContext(replayCtx);

          // Build and emit PerformanceContext (pure computation from histories)
          this._emitPerformanceContext();
        }
      }

      // Log de liberação da fila de execução
      const releaseReason = isWin ? "WIN" : isLoss ? "LOSS" : "DRAW";
      console.log("[EXECUTION QUEUE]", {
        decisionId: record.decisionId,
        tradeId: record.tradeId,
        removed: true,
        reason: releaseReason,
        pendingTrades: 0,
      });

      if (this._state.totalWins + this._state.totalLosses > 0) {
        this._state.winRate =
          (this._state.totalWins / (this._state.totalWins + this._state.totalLosses)) * 100;
      }

      persistOperations(this._state.operations);
      this._emit("operation-closed", operation);

      // ══ AI FINANCIAL DECISION ══
      try {
        const aiDecision = this.smartRecovery.evaluateAIDecision();
        if (aiDecision.action !== "continue") {
          this._emitAnalyst("ai.decision", {
            action: aiDecision.action,
            reason: aiDecision.reason,
            confidence: aiDecision.confidence,
          });
          this._emitDiaryEntry(
            `IA: ${aiDecision.action} — ${aiDecision.reason}`,
            aiDecision.action === "pause" || aiDecision.action === "stop-session" ? "⚠️" : "ℹ️",
            aiDecision.action === "stop-session" ? "error" : "warning",
          );
          if (aiDecision.action === "stop-session") {
            const srState = this.smartRecovery.getState();
            console.log("[STOP CHECK]", {
              initialBankroll: this._state.initialBankroll,
              currentBankroll: this._state.currentBankroll,
              profit: this._state.currentBankroll - this._state.initialBankroll,
              stopLoss: this._state.config.stopLoss,
              targetProfit: this._state.config.targetProfit,
              shouldStop: true,
              reason: `IA: ${aiDecision.reason}`,
              aiAction: aiDecision.action,
              aiConfidence: aiDecision.confidence,
              currentLevel: srState.currentLevel,
              dailyLoss: srState.dailyLoss,
              consecutiveLosses: srState.consecutiveLosses,
              phase: srState.phase,
              isStopAtingido: srState.isStopAtingido,
            });
            engineLogger.warn(
              "FlowRobot",
              `[AI STOP-SESSION] Robot stopped by AI financial decision`,
              {
                reason: aiDecision.reason,
                dailyLoss: srState.dailyLoss,
                stopLoss: this._state.config.stopLoss,
                consecutiveLosses: srState.consecutiveLosses,
                phase: srState.phase,
                isStopAtingido: srState.isStopAtingido,
              },
            );
            this._stopByRisk(`IA: ${aiDecision.reason}`);
            return;
          }
        }
      } catch (err) {
        engineLogger.error("FlowRobot", "Erro no evaluateAIDecision", { error: String(err) });
      }

      // Atualiza registro com resultado
      record.result = isWin ? "WIN" : isLoss ? "LOSS" : "DRAW";

      // ══ SIGNAL LOG: atualiza resultado do trade ══
      if (this._lastSignalLogId && this._state.config.operationProfile === "HYBRID_PROBABILITY") {
        signalLogger.updateResult(
          this._lastSignalLogId,
          isWin ? "WIN" : isLoss ? "LOSS" : "DRAW",
          record.tradeId,
        );
        engineLogger.info("FlowRobot", `📋 Signal result updated: ${record.result}`, {
          signalId: this._lastSignalLogId,
          tradeId: record.tradeId,
          result: record.result,
        });
        this._lastSignalLogId = null;
      }

      console.log("[DECISION RESULT]", {
        decisionId: record.decisionId,
        tradeId: record.tradeId,
        result: record.result,
        profit: operation.profit,
        asset: record.symbol,
        direction: operation.direction,
        amount: operation.amount,
      });

      // ── Relatório de latência ──
      latencyTracker.printReport();
      console.log("");
      console.log("═══════════════════════════════════════════════════════════════════════════");
      console.log("  Cada etapa acima é medida com performance.now() (alta precisão).");
      console.log("  Consulte o Latency Scanner no startup para todos os timers do sistema.");
      console.log("═══════════════════════════════════════════════════════════════════════════");
      console.log("");
      latencyTracker.endTrade();

      // Agenda re-análise rápida durante o cooldown
      this._scheduleNextOperation(5, "COOLDOWN_ACTIVE");
    } catch (err) {
      this._state.activeOperation = null;
      this._state.status = "running";
      this._state.nextTrade = null;
      this._logState("TRADE_ERROR", { error: String(err), tradeId: record.tradeId });
      this._state.currentEntry = this.smartRecovery.getCurrentStake();
      this._state.entryNumber = this.smartRecovery.getState().entryNumber;
      this._state.currentRecoveryStep = this.smartRecovery.getState().currentLevel;
      engineLogger.error("FlowRobot", "Falha ao aguardar resultado do trade", {
        error: String(err),
        tradeId: record.tradeId,
      });
      this._globalCooldownUntil = Date.now() + (this._state.config.globalCooldownSec ?? 180) * 1000;
      this._scheduleNextOperation(5, "COOLDOWN_ACTIVE");
    } finally {
      if (this._state.status === "waiting-result") {
        this._state.status = "running";
        this._state.activeOperation = null;
        engineLogger.warn(
          "FlowRobot",
          "[FINALLY] Status was 'waiting-result' after _onEntryExecuted — reset to 'running'",
          { tradeId: record.tradeId },
        );
      }
    }
  }

  private _countTradesToday(): number {
    const today = new Date();
    const todayStr = today.toDateString();
    return this._state.operations.filter((op) => {
      try {
        return new Date(op.openedAt).toDateString() === todayStr;
      } catch {
        return false;
      }
    }).length;
  }

  private _scheduleNextOperation(delaySecs: number, reason: ScheduleReason = "VARIABLE_DELAY"): void {
    this._clearTimers();
    if (this._state.status !== "running") {
      engineLogger.info("FlowRobot", `[SCHEDULER] BLOQUEADO — status=${this._state.status} (não agendando)`, { reason });
      return;
    }

    const now = new Date();
    const nextRun = new Date(now.getTime() + delaySecs * 1000);
    const tf = this._state.selectedTimeframe ?? this._state.config.timeframes?.[0] ?? "?";
    const traceId = this._state.nextTrade?.traceId ?? "none";

    engineLogger.info("FlowRobot", `[SCHEDULER] reason=${reason} asset=${this._state.config.asset} tf=${tf} profile=${this._state.config.operationProfile ?? "?"}`, {
      reason,
      now: now.toLocaleTimeString("pt-BR"),
      nextRun: nextRun.toLocaleTimeString("pt-BR"),
      delaySecs,
      asset: this._state.config.asset,
      timeframe: tf,
      profile: this._state.config.operationProfile ?? "?",
      traceId,
    });
    schedulerMetrics.recordReschedule();

    // Se há candle fechado pendente, processa imediatamente
    if (FlowRobotEngine._pendingCandleClose) {
      FlowRobotEngine._pendingCandleClose = false;
      engineLogger.info("FlowRobot", `[SCHEDULER] Candle pendente — executando imediatamente`, { reason });
      this._runOperationCycle().catch((err) =>
        engineLogger.error("FlowRobot", "Erro no ciclo por candle pendente", {
          error: String(err),
        }),
      );
      return;
    }

    this._state.nextOperationIn = delaySecs;
    this._countdownTimer = setInterval(() => {
      if (this._state.nextOperationIn > 0) {
        this._state.nextOperationIn--;
      }
    }, 1000);

    this._loopTimer = setTimeout(() => {
      this._clearCountdown();
      this._runOperationCycle().catch((err) =>
        engineLogger.error("FlowRobot", "Erro no ciclo agendado", { error: String(err) }),
      );
    }, delaySecs * 1000);
  }

  private async _runOperationCycle(): Promise<void> {
    const cycleStatus = this._state.status;
    const cycleIsProcessing = FlowRobotEngine._isProcessing;
    if (cycleStatus !== "running" || cycleIsProcessing) {
      console.log("[DUPLICATE CHECK] _runOperationCycle ignored", {
        status: cycleStatus,
        isProcessing: cycleIsProcessing,
        activeOp: !!this._state.activeOperation,
        nextTradeValid: !!this._state.nextTrade?.valid,
      });
      if (cycleIsProcessing) {
        engineLogger.warn(
          "FlowRobot",
          "⏭️ _runOperationCycle ignorado — já processando (guarda estática)",
          {
            isProcessing: cycleIsProcessing,
          },
        );
      }
      return;
    }

    // ══ TRAVA MUTEX: adquire lock ANTES de verificar guards ══
    FlowRobotEngine._isProcessing = true;

    // ══ SEMPRE consultar a calculadora antes de qualquer bloqueio ══
    console.log("[FLOW] Antes do getEntry");
    const entrada = this.smartRecovery.getEntry();
    console.log("[SOROSGALE]", {
      level: entrada.level,
      entry: entrada.entry,
      stake: entrada.valor,
      isSoros: entrada.isSoros,
    });

    // ══ TRAVA: trade pendente ou análise em andamento? ══
    if (this._state.activeOperation) {
      const pendente = this._state.activeOperation;
      engineLogger.warn("FlowRobot", "⏳ Entrada bloqueada — operação anterior ainda pendente", {
        operationId: pendente.id,
        asset: pendente.asset,
        direction: pendente.direction,
        status: pendente.status,
        calculatorStake: entrada.valor,
      });
      FlowRobotEngine._isProcessing = false;
      this._scheduleNextOperation(5, "OPERATION_FINISHED");
      return;
    }
    if (this._state.nextTrade) {
      engineLogger.warn("FlowRobot", "⏳ Entrada bloqueada — trade já na fila do ExecutionEngine", {
        symbol: this._state.nextTrade.symbol,
        direction: this._state.nextTrade.direction,
        nextTradeAmount: this._state.nextTrade.amount,
        calculatorStake: entrada.valor,
        calculatorLevel: entrada.level,
        calculatorEntry: entrada.entry,
      });
      FlowRobotEngine._isProcessing = false;
      this._scheduleNextOperation(5, "OPERATION_FINISHED");
      return;
    }

    // ══ DIAGNÓSTICO DO CICLO ══
    const bufferStatus = this.broker.getBufferStatus();
    engineLogger.info("FlowRobot", `═══ CICLO DE OPERAÇÃO ═══`, {
      status: this._state.status,
      isProcessing: FlowRobotEngine._isProcessing,
      bufferKeys: bufferStatus.length,
      bufferSummary: bufferStatus.map((b) => `${b.key}=${b.count}`).join(", "),
      wsConnected: this.broker.connected,
      scanMode: this._state.config.scanMode,
      assets: this._state.config.assets.length,
    });

    // ══ VERIFICAÇÃO: Temos dados no buffer? ══
    const currentProfile = this._state.config.operationProfile ?? "AUTO";
    const currentMinCandles = getMinCandles(currentProfile);
    // For HYBRID_PROBABILITY, only check hybrid Puma asset buffers
    const relevantBuffers = currentProfile === "HYBRID_PROBABILITY"
      ? bufferStatus.filter((b) => {
          const assetKey = b.key.split(":")[0] ?? b.key;
          return HYBRID_PUMA_ASSETS.has(assetKey.toUpperCase());
        })
      : bufferStatus;
    const hasData = relevantBuffers.length > 0 && relevantBuffers.some((b) => b.count >= currentMinCandles);
    if (!hasData) {
      engineLogger.warn("FlowRobot", `⏳ Buffer SEM dados suficientes — aguardando candles`, {
        bufferKeys: bufferStatus.length,
        relevantBuffers: relevantBuffers.length,
        details: relevantBuffers.map((b) => `${b.key}=${b.count}`).join(", "),
        profile: currentProfile,
        reason: currentProfile === "HYBRID_PROBABILITY"
          ? `Hybrid Puma assets precisam de ${currentMinCandles} candles cada`
          : "WebSocket pode não estar enviando dados ou buffer ainda carregando",
      });
      // ── BUFFER VISUAL: emitir progresso mesmo durante espera ──
      const capacity = currentProfile === "HYBRID_PROBABILITY" ? 2000 : currentProfile === "HYBRID_FLOW" ? 300 : 500;
      const maxCount = relevantBuffers.length > 0 ? Math.max(...relevantBuffers.map((b) => b.count)) : 0;
      this._emitMarketUpdate({
        bufferVisual: { current: maxCount, capacity, minimum: currentMinCandles, percent: Math.min(100, Math.round((maxCount / capacity) * 100)) },
      });
      // ── PER-ASSET BUFFER HEALTH for all relevant assets ──
      {
        const now = Date.now();
        for (const buf of relevantBuffers) {
          const lastTimeMs = buf.lastTime !== "N/A" ? new Date(buf.lastTime).getTime() : 0;
          const secondsWithout = lastTimeMs > 0 ? Math.round((now - lastTimeMs) / 1000) : 999;
          const isReceiving = secondsWithout < 3;
          const bufferHealth: "live" | "waiting" | "stale" = secondsWithout < 3 ? "live" : secondsWithout < 10 ? "waiting" : "stale";
          const bufferStatusText = isReceiving ? "Recebendo candles" : secondsWithout < 10 ? "Aguardando proximo candle" : `Buffer desatualizado (${secondsWithout}s)`;
          analystBus.emit("buffer.asset.update" as AnalystEventType, {
            asset: buf.key,
            current: buf.count,
            capacity,
            minimum: currentMinCandles,
            percent: Math.min(100, Math.round((buf.count / capacity) * 100)),
            lastCandleTime: lastTimeMs,
            secondsWithoutCandles: secondsWithout,
            isReceiving,
            bufferHealth,
            bufferStatus: bufferStatusText,
          });
        }
      }
      FlowRobotEngine._isProcessing = false;
      this._scheduleNextOperation(5, "INSUFFICIENT_DATA");
      return;
    }

    // ══ FILTRO DE SESSÃO (horário de mercado) ══
    if (!this._isSessionAllowed()) {
      engineLogger.info("FlowRobot", "⏰ Fora do horário de sessão — pulando ciclo", {
        session: this._state.currentSession,
        reason: "Operações permitidas apenas em sessão aberta",
      });
      FlowRobotEngine._isProcessing = false;
      this._scheduleNextOperation(60, "OUTSIDE_SESSION");
      return;
    }

    // ══ LOG DE DIAGNÓSTICO: candles no buffer ══
    const asset = this._state.config.asset;
    const candles = await this.broker.getCandles(asset, "M1", 5);
    engineLogger.debug("FlowRobot", `Candles disponíveis: ${candles.length}`, {
      brokerId: this.broker.instanceId,
      ultimoVerify: candles.at(-1)?.verify,
    });

    try {
      const profit = this._state.currentBankroll - this._state.initialBankroll;
      const crrBk = this._state.currentBankroll;
      const initBk = this._state.initialBankroll;
      const cfgSl = this._state.config.stopLoss;
      const cfgTp = this._state.config.targetProfit;
      const srStopped = this.smartRecovery.isStopped();

      if (profit >= cfgTp) {
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "Meta de lucro atingida!",
          currentLevel: this.smartRecovery.getState().currentLevel,
          dailyLoss: this.smartRecovery.getState().dailyLoss,
        });
        this._emitAnalyst("risk.profit-target");
        this._stopByRisk("Meta de lucro atingida!");
        return;
      }
      if (-profit >= cfgSl) {
        const srState = this.smartRecovery.getState();
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "Stop loss atingido!",
          currentLevel: srState.currentLevel,
          dailyLoss: srState.dailyLoss,
          isStopAtingido: srState.isStopAtingido,
          phase: srState.phase,
        });
        this._emitAnalyst("risk.stop-loss");
        this._stopByRisk("Stop loss atingido!");
        return;
      }

      if (srStopped) {
        const srState = this.smartRecovery.getState();
        console.log("[STOP CHECK]", {
          initialBankroll: initBk,
          currentBankroll: crrBk,
          profit,
          stopLoss: cfgSl,
          targetProfit: cfgTp,
          shouldStop: true,
          reason: "smartRecovery.isStopped()",
          sorosPhase: srState.phase,
          dailyLoss: srState.dailyLoss,
          consecutiveLosses: srState.consecutiveLosses,
          isStopAtingido: srState.isStopAtingido,
        });
        this._emitAnalyst("risk.insufficient-balance");
        this._stopByRisk("Saldo insuficiente para continuar.");
        return;
      }
      console.log("[STOP CHECK]", {
        initialBankroll: initBk,
        currentBankroll: crrBk,
        profit,
        stopLoss: cfgSl,
        targetProfit: cfgTp,
        shouldStop: false,
        srStopped,
        currentLevel: this.smartRecovery.getState().currentLevel,
        dailyLoss: this.smartRecovery.getState().dailyLoss,
      });

      // ── LIMITE DIÁRIO CONTA DEMO (50 trades/dia) ──
      const tradesToday = this._countTradesToday();
      const remaining = DEMO_DAILY_LIMIT - tradesToday;
      if (remaining <= 0) {
        engineLogger.warn("FlowRobot", "Limite diário da conta demo atingido", { tradesToday });
        this._emitDiagnostic("demo", "error", "Limite diário da conta demo atingido (50/50)");
        this._emitAnalyst("risk.demo-limit", { tradesToday, limit: DEMO_DAILY_LIMIT });
        this._stopByRisk("Limite diário da conta demo atingido (50 trades). Aguarde até amanhã.");
        return;
      }
      if (remaining <= 10) {
        engineLogger.warn("FlowRobot", "Limite diário da conta demo próximo do fim", {
          tradesToday,
          remaining,
        });
        this._emitDiagnostic(
          "demo",
          "warning",
          `Restam ${remaining} trades do limite diário da conta demo (${tradesToday}/${DEMO_DAILY_LIMIT})`,
        );
        this._emitAnalyst("risk.demo-limit-warning", {
          tradesToday,
          remaining,
          limit: DEMO_DAILY_LIMIT,
        });
      }

      // Atualiza info de mercado
      const lastAnalysis = this._state.lastAnalysis;
      this._emitMarketUpdate({
        asset: this._state.config.asset,
        timeframe: this._state.selectedTimeframe ?? this._state.config.timeframes[0],
        trend:
          lastAnalysis?.direction === "CALL"
            ? "alta"
            : lastAnalysis?.direction === "PUT"
              ? "baixa"
              : "lateral",
        strength: lastAnalysis?.trend?.score ?? 0,
        score: lastAnalysis?.probability?.total ?? 0,
        confidence: this._state.lastAnalysis?.probability?.total ?? 0,
        direction: lastAnalysis?.direction === "CALL" ? "call" : lastAnalysis?.direction === "PUT" ? "put" : null,
        engineStatus: "analyzing",
        profile: this._state.config.operationProfile ?? "AUTO",
      });

      engineLogger.info(
        "FlowRobot",
        `📊 CICLO: nível=${entrada.level} entry=${entrada.entry} valor=R$${entrada.valor.toFixed(2)} isSoros=${entrada.isSoros}`,
        {
          level: entrada.level,
          entry: entrada.entry,
          valor: entrada.valor,
          isSoros: entrada.isSoros,
        },
      );

      // ── VALIDAÇÃO: entrada inválida ou stop loss excedido ──
      if (entrada.valor <= 0) {
        engineLogger.warn("FlowRobot", "Entrada inválida (<=0) — parando robô", {
          valor: entrada.valor,
          level: entrada.level,
          capitalPending: entrada.capitalPending,
        });
        this._stopByRisk("Stake inválido: " + entrada.valor);
        return;
      }

      // ══ AI FINANCIAL DECISION — verifica antes de cada ciclo de entrada ══
      try {
        const aiDecision = this.smartRecovery.evaluateAIDecision();
        if (aiDecision.action === "pause" || aiDecision.action === "stop-session") {
          engineLogger.warn(
            "FlowRobot",
            `IA bloqueou entrada: ${aiDecision.action} — ${aiDecision.reason}`,
            {},
          );
          this._emitAnalyst("ai.blocked-entry", {
            action: aiDecision.action,
            reason: aiDecision.reason,
            confidence: aiDecision.confidence,
          });
          this._emitAnalystReasoning([
            { text: `IA bloqueou: ${aiDecision.action}`, checked: true },
            { text: aiDecision.reason, checked: true },
            { text: `Confiança: ${aiDecision.confidence}%`, checked: true },
          ]);
          if (aiDecision.action === "stop-session") {
            const srState = this.smartRecovery.getState();
            console.log("[STOP CHECK]", {
              initialBankroll: this._state.initialBankroll,
              currentBankroll: this._state.currentBankroll,
              profit: this._state.currentBankroll - this._state.initialBankroll,
              stopLoss: this._state.config.stopLoss,
              targetProfit: this._state.config.targetProfit,
              shouldStop: true,
              reason: `IA: ${aiDecision.reason}`,
              aiAction: aiDecision.action,
              aiConfidence: aiDecision.confidence,
              currentLevel: srState.currentLevel,
              dailyLoss: srState.dailyLoss,
              isStopAtingido: srState.isStopAtingido,
              phase: srState.phase,
            });
            this._stopByRisk(`IA: ${aiDecision.reason}`);
            return;
          }
          this._emitDiaryEntry(`IA bloqueou entrada: ${aiDecision.reason}`, "⏸️", "warning");
          this._scheduleNextOperation(30, "VARIABLE_DELAY");
          return;
        }
      } catch (err) {
        engineLogger.error("FlowRobot", "Erro no evaluateAIDecision (ciclo)", {
          error: String(err),
        });
      }

      let direction: OperationDirection;

      const isRecovery =
        this._state.operations.some((o) => o.result === "loss" && o.status === "completed") &&
        entrada.level > 0;

      // Recovery + Normal: SEMPRE analisar mercado antes de entrar
      if (isRecovery) {
        this._emitAnalyst("recovery.step", { step: entrada.level, amount: entrada.valor });
        this._emitAnalystState("recovery");
        this._emitAnalystReasoning([
          { text: `LOSS anterior detectado. Nível ${entrada.level}`, checked: true },
          { text: `Entrada calculada: R$ ${entrada.valor.toFixed(2)}`, checked: true },
          { text: "Escaneando mercado para padrão...", checked: false },
        ]);
        this._emitAnalystNextAction(
          `Recovery Nível ${entrada.level}`,
          "Aguardando 2 candles da mesma cor",
          `Stake: R$ ${entrada.valor.toFixed(2)}`,
        );
      } else {
        this._emitAnalyst("analysis.started", {
          asset,
          timeframe: this._state.selectedTimeframe ?? this._state.config.timeframes[0],
          profile: this._state.config.operationProfile ?? "AUTO",
          traceId: makeTraceId(),
        });
        this._emitAnalystState("analyzing");
        this._emitAnalystReasoning([
          { text: "Escaneando mercado...", checked: true },
          { text: "Analisando estrutura dos candles", checked: false },
          { text: "Lendo força compradora/vendedora", checked: false },
          { text: "Calculando continuidade", checked: false },
          { text: "Verificando suporte e resistência", checked: false },
        ]);
      }

      await this._runHealthCheck();

      const marketDir = await this._analyzeMarketDirection();

      // ══ COOLDOWN GLOBAL: bloqueia entrada mas mantém análise ══
      const cooldownRemaining = this._globalCooldownUntil - Date.now();
      if (cooldownRemaining > 0) {
        if (marketDir) {
          this._emitAnalystReasoning([
            { text: "Sinal encontrado, aguardando cooldown", checked: true },
            {
              text: `Re-análise em 5s (cooldown: ${Math.ceil(cooldownRemaining / 1000)}s)`,
              checked: true,
            },
          ]);
          this._emitAnalystNextAction(
            "Cooldown global ativo",
            `Sinal ${marketDir.toUpperCase()} disponível, aguardando ${Math.ceil(cooldownRemaining / 1000)}s`,
            `Score: ${this._state.lastAnalysis?.probability?.total || 0}/100`,
          );
        }
        engineLogger.info(
          "FlowRobot",
          `⏳ Cooldown global: ${Math.ceil(cooldownRemaining / 1000)}s — análise ok, entrada bloqueada`,
          {},
        );
        this._scheduleNextOperation(5, "COOLDOWN_ACTIVE");
        return;
      }

      if (marketDir) {
        direction = marketDir;
        this._emitAnalystState("continuity");
        this._emitAnalystReasoning([
          { text: "Mercado escaneado", checked: true },
          { text: "Padrão identificado", checked: true },
          { text: "Filtros verificados", checked: true },
          { text: "Continuidade confirmada", checked: true },
          { text: "Pronto para entrada", checked: false },
        ]);
        this._emitAnalystNextAction(
          `Entrada ${direction.toUpperCase()} preparada`,
          "Aguardando confirmação",
          `Score: ${this._state.lastAnalysis?.probability?.total || 0}/100`,
        );
      } else {
        if (this._state.config.autoDirection) {
          this._emitAnalyst("analysis.no-signal");
          this._emitAnalystState("waiting");

          const scanCount = this._state.config.assets.length;
          const scannedCount = this._state.scanLog.length;
          const isMulti = this._state.config.scanMode === "multi";

          this._emitAnalystReasoning([
            { text: `Escaneando ${isMulti ? `${scanCount} ativos` : "mercado"}`, checked: true },
            { text: `${scannedCount} ativos verificados`, checked: true },
            { text: "Nenhum sinal confirmado", checked: true },
            { text: "Aguardando próxima vela", checked: false },
          ]);

          if (isMulti && this._state.scanLog.length > 0) {
            const topScans = this._state.scanLog.sort((a, b) => b.score - a.score).slice(0, 3);
            const scanSummary = topScans
              .map((s) => `${s.asset}: ${s.score} (${s.blocked ? "✗" : "✓"})`)
              .join(" | ");
            this._emitAnalystNextAction(
              "Scan multi-ativo concluído",
              `${scannedCount}/${scanCount} ativos verificados`,
              scanSummary,
            );
            this._emitDiagnostic(
              "entry",
              "blocked",
              `Nenhum sinal — Top: ${topScans[0]?.asset ?? "-"} (${topScans[0]?.score ?? 0})`,
            );
          } else {
            this._emitAnalystNextAction(
              "Aguardar fechamento da vela",
              "Se verde → CALL",
              "Se vermelha → Continuar analisando",
            );
          }

          engineLogger.info("FlowRobot", "Sem sinal", {
            isRecovery,
            scanMode: this._state.config.scanMode,
          });
          this._scheduleNextOperation(this._state.config.reAnalysisIntervalSec, "NO_SIGNAL");
          return;
        }
        direction = this._state.config.direction;
      }

      // _runOperationCycle NÃO define nextTrade — apenas _onDecisionTime.
      // O fluxo de análise para UI/statistics continua rodando, mas sem
      // sobrescrever a decisão da janela de decisão.
      const nt = this._state.nextTrade as import("./execution/types").NextTrade | null;
      engineLogger.info(
        "FlowRobot",
        "Ciclo de análise concluído (nextTrade NÃO foi definido — aguardando _onDecisionTime)",
        {
          hasNextTrade: !!nt?.valid,
          decisionId: nt?.decisionId,
        },
      );

      this._scheduleNextOperation(this._getIntervalSeconds(), "OPERATION_FINISHED");
    } finally {
      FlowRobotEngine._isProcessing = false;
    }
  }

  private _nextDecisionId(): number {
    return ++this._decisionCounter;
  }

  private _getIntervalSeconds(): number {
    const timeframes = this._state.config.timeframes;
    if (timeframes.includes("M1")) {
      return DecisionEngine.isCryptoAsset(this._state.config.asset) ? 10 : 5;
    }
    if (timeframes.includes("M5")) {
      return 30;
    }
    return 60;
  }

  private static readonly CORRELATION_GROUPS: Record<string, string[]> = {
    forex_major: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"],
    crypto: ["BTCUSD", "ETHUSD", "BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"],
    gold_silver: ["XAUUSD"],
  };

  private static getCorrelationGroup(asset: string): string | null {
    for (const [group, members] of Object.entries(FlowRobotEngine.CORRELATION_GROUPS)) {
      if (members.includes(asset.toUpperCase())) return group;
    }
    return null;
  }

  private async _scanAllAssets(): Promise<{
    asset: string;
    direction: "call" | "put";
    decision: DecisionResult;
    timeframe: string;
  } | null> {
    latencyTracker.mark("scan_started", "Scan Started", {
      assets: this._state.config.assets.length,
    });
    const assets = this._state.config.assets;
    const timeframes = this._state.config.timeframes;

    engineLogger.info(
      "FlowRobot",
      `Scan multi-ativo: ${assets.length} ativos x ${timeframes.length} timeframes`,
      { assets, timeframes },
    );
    this._emitDiagnostic(
      "receiving",
      "loading",
      `Escaneando ${assets.length} ativos em ${timeframes.length} timeframes...`,
    );

    const scanLog: ScanLogEntry[] = [];
    let bestCandidate: {
      asset: string;
      direction: "call" | "put";
      decision: DecisionResult;
      timeframe: string;
    } | null = null;

    const profile = this.state.config.operationProfile ?? "AUTO";

    // Filter assets by profile: HYBRID_PROBABILITY only scans Puma hybrid assets
    const scanAssets = profile === "HYBRID_PROBABILITY"
      ? assets.filter((a) => HYBRID_PUMA_ASSETS.has(a.toUpperCase()))
      : assets;

    const totalCatalogTargets = scanAssets.length * timeframes.length;
    let scannedCount = 0;

    for (const asset of scanAssets) {
      if (this._state.status !== "running") break;

      const assetIndex = scanAssets.indexOf(asset);
      const scanProgress = Math.round(((assetIndex) / scanAssets.length) * 100);
      this._emitMarketUpdate({ asset, scanProgress, catalogProgress: { scanned: scannedCount, total: totalCatalogTargets }, engineStatus: "analyzing", profile });

      const isForex = /^[A-Z]{6}$/.test(asset.toUpperCase()) && !["BTCUSD", "ETHUSD", "XAUUSD"].includes(asset.toUpperCase());
      const isHybrid = ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"].includes(asset.toUpperCase());

      engineLogger.info("FlowRobot", `═══ SCAN ${asset} INÍCIO ═══ tipo=${isForex ? "FOREX" : isHybrid ? "HYBRID" : "OUTRO"}`, {
        asset,
        tipo: isForex ? "FOREX" : isHybrid ? "HYBRID" : "OUTRO",
        profile: profile,
        session: this._state.currentSession,
      });

      // Skip assets em cooldown (após loss)
      const cooldownUntil = this.assetCooldowns.get(asset);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        const remaining = Math.round((cooldownUntil - Date.now()) / 1000);
        engineLogger.warn("FlowRobot", `SCAN ${asset}: ✗ BLOQUEADO — COOLDOWN pós-loss (${remaining}s restantes)`, {});
        for (const tf of timeframes) {
          scanLog.push({
            traceId: makeTraceId(),
            asset,
            score: 0,
            blocked: true,
            reason: `Cooldown pós-loss (${remaining}s)`,
            timestamp: Date.now(),
            timeframe: tf,
          });
        }
        continue;
      }

      // Check payout once per asset
      const payout = await this.broker.getPayout(asset).catch(() => null);
      if (!payout || payout < 0.7) {
        engineLogger.warn("FlowRobot", `SCAN ${asset}: ✗ BLOQUEADO — PAYOUT insuficiente (payout=${payout ?? "null"}, mínimo=0.7)`, {
          payout: payout ?? "null",
          motivo: `Payout ${payout ?? "null"} < 0.7`,
        });
        for (const tf of timeframes) {
          const entry: ScanLogEntry = {
            traceId: makeTraceId(),
            asset,
            score: 0,
            blocked: true,
            reason: `Payout ${payout ?? "null"}`,
            timestamp: Date.now(),
            timeframe: tf,
          };
          scanLog.push(entry);
        }
        continue;
      }

      // Timeframes em paralelo — cada um busca seus próprios candles na resolução correta
      const minCandles = getMinCandles(profile);
      const fetchSize = getFetchSize(profile);
      const tfResults = await Promise.all(
        timeframes.map(async (tf) => {
          try {
            engineLogger.debug("FlowRobot", `SCAN ${asset} ${tf}: started`, {});
            const candles = await this.broker.getCandles(asset, tf, fetchSize);
            engineLogger.debug("FlowRobot", `SCAN ${asset} ${tf}: getCandles`, {
              count: candles.length,
              required: minCandles,
              fetchSize,
              isHybrid: HYBRID_PUMA_ASSETS.has(asset.toUpperCase()),
            });

            if (!candles || candles.length < minCandles) {
              engineLogger.warn("FlowRobot", `SCAN ${asset} ${tf}: ✗ BLOQUEADO — DADOS INSUFICIENTES (${candles?.length ?? 0}/${minCandles} candles, profile=${profile})`, {
                count: candles?.length ?? 0,
                required: minCandles,
                profile,
                motivo: `Candles ${candles?.length ?? 0} < mínimo ${minCandles} para profile ${profile}`,
              });
              return {
                tf,
                entry: {
                  traceId: makeTraceId(),
                  asset,
                  score: 0,
                  blocked: true as const,
                  reason: `Poucos dados ${tf} (${candles?.length ?? 0}/${minCandles})`,
                  timestamp: Date.now(),
                  timeframe: tf,
                } as ScanLogEntry,
                candidate: null as {
                  asset: string;
                  direction: "call" | "put";
                  decision: DecisionResult;
                  timeframe: string;
                } | null,
              };
            }

            const decision = this.decisionEngine.analyze(candles, asset, {
              operationProfile: this.state.config.operationProfile,
              hybridProbabilityConfig: this.state.config.hybridProbabilityConfig,
              timeframe: tf,
            });
            latencyTracker.mark("score_calculated", "Score Calculated", {
              asset,
              tf,
              score: decision.scoreBreakdown.total,
            });

            this._emitAnalyst("score.updated", {
              asset,
              timeframe: tf,
              score: decision.scoreBreakdown.total,
              direction: decision.direction?.toLowerCase() ?? null,
              blockedReasons: decision.blockedReason ? [decision.blockedReason] : [],
              traceId: makeTraceId(),
              band: decision.scoreBreakdown.bandLabel,
              strategy: decision.scoreBreakdown.strategy,
            });

            if (decision.blockedReason) {
              engineLogger.warn("FlowRobot", `SCAN ${asset} ${tf}: ✗ BLOQUEADO — ${decision.blockedRule ?? "REgra desconhecida"}`, {
                score: `${decision.scoreBreakdown.total}/100`,
                band: decision.scoreBreakdown.bandLabel,
                rule: decision.blockedRule,
                reason: decision.blockedReason,
                profile,
                motivo: `DecisionEngine bloqueou: ${decision.blockedReason}`,
              });
              return {
                tf,
                entry: {
                  traceId: makeTraceId(),
                  asset,
                  score: decision.scoreBreakdown.total,
                  blocked: true as const,
                  reason: `${tf}: ${decision.blockedReason}`,
                  timestamp: Date.now(),
                  trend: decision.trend.direction ?? undefined,
                  pattern: decision.priceAction.pattern ?? undefined,
                  timeframe: tf,
                  stageTimings: decision.stageTimings,
                } as ScanLogEntry,
                candidate: null,
              };
            }

            if (decision.direction) {
              const direction = decision.direction.toLowerCase() as "call" | "put";
              const score = decision.scoreBreakdown.total;
              latencyTracker.mark("decision_taken", "Decision Taken", {
                asset,
                tf,
                direction,
                score,
              });
              engineLogger.trade(
                "FlowRobot",
                `SCAN ${asset} ${tf}: ✅ ${direction.toUpperCase()} ENCONTRADO (Score: ${score})`,
                { score, trend: decision.trend.direction, pattern: decision.priceAction.pattern },
              );
              return {
                tf,
                entry: {
                  traceId: makeTraceId(),
                  asset,
                  score,
                  blocked: false as const,
                  reason: `✅ ${direction.toUpperCase()} ${tf} — Score: ${score}/100`,
                  timestamp: Date.now(),
                  trend: decision.trend.direction ?? undefined,
                  pattern: decision.priceAction.pattern ?? undefined,
                  direction,
                  timeframe: tf,
                  stageTimings: decision.stageTimings,
                } as ScanLogEntry,
                candidate: { asset, direction, decision, timeframe: tf },
              };
            }

            return {
              tf,
              entry: {
                traceId: makeTraceId(),
                asset,
                score: decision.scoreBreakdown.total,
                blocked: true as const,
                reason: `${tf}: Sem direção (CALL: -, PUT: -)`,
                timestamp: Date.now(),
                trend: decision.trend.direction ?? undefined,
                pattern: decision.priceAction.pattern ?? undefined,
                timeframe: tf,
                stageTimings: decision.stageTimings,
              } as ScanLogEntry,
              candidate: null,
            };
          } catch (err) {
            const errStr = String(err);
            const errStack = err instanceof Error ? err.stack : undefined;
            const isCalcADError = errStr.includes("calcADX") || errStr.includes("calcATR") || errStr.includes("atrBaseline");
            const isReferenceError = err instanceof ReferenceError;
            engineLogger.error("FlowRobot", `SCAN ${asset} ${tf}: ✗ ERRO — ${isCalcADError ? "calcADX/calcATR" : "exceção"}`, {
              error: errStr,
              stack: errStack?.split("\n").slice(0, 5).join(" | "),
              asset,
              timeframe: tf,
              profile,
              isImportError: isReferenceError && isCalcADError,
              motivo: isReferenceError && isCalcADError
                ? `ReferenceError: calcADX/calcATR/atrBaseline não importado — verifique operationProfile (${profile})`
                : isCalcADError
                  ? `Erro dentro de calcADX/calcATR — verifique dados OHLC`
                  : `Exceção durante análise: ${errStr}`,
            });
            return {
              tf,
              entry: {
                traceId: makeTraceId(),
                asset,
                score: 0,
                blocked: true as const,
                reason: `${tf}: Erro: ${err}`,
                timestamp: Date.now(),
                timeframe: tf,
              } as ScanLogEntry,
              candidate: null,
            };
          }
        }),
      );

      for (const r of tfResults) {
        scanLog.push(r.entry);
        if (
          r.candidate &&
          (!bestCandidate ||
            r.candidate.decision.scoreBreakdown.total > bestCandidate.decision.scoreBreakdown.total)
        ) {
          bestCandidate = r.candidate;
          engineLogger.info(
            "FlowRobot",
            `SCAN: ${asset} ${r.tf} é o novo melhor (score: ${r.candidate.decision.scoreBreakdown.total})`,
            {},
          );
        }
      }

      scannedCount += timeframes.length;
      this._emitMarketUpdate({ asset, catalogProgress: { scanned: scannedCount, total: totalCatalogTargets }, engineStatus: "analyzing", profile });
    }

    this._emitMarketUpdate({ catalogProgress: { scanned: totalCatalogTargets, total: totalCatalogTargets }, engineStatus: "waiting", profile });

    this._state.scanLog = scanLog;

    // ══ FILTRO DE CORRELAÇÃO: evitar múltiplos ativos do mesmo grupo ══
    const passedSignals = scanLog.filter((s) => !s.blocked && s.direction);
    if (passedSignals.length > 1) {
      const groupBest = new Map<string, ScanLogEntry>();
      for (const signal of passedSignals) {
        const group = FlowRobotEngine.getCorrelationGroup(signal.asset);
        const key = group ?? signal.asset;
        const existing = groupBest.get(key);
        if (!existing || signal.score > existing.score) {
          groupBest.set(key, signal);
        }
      }
      // Se encontrou mais de um candidato, bloqueia os de menor score no mesmo grupo
      for (const signal of passedSignals) {
        const group = FlowRobotEngine.getCorrelationGroup(signal.asset);
        const key = group ?? signal.asset;
        const bestInGroup = groupBest.get(key);
        if (bestInGroup && signal.asset !== bestInGroup.asset) {
          engineLogger.info(
            "FlowRobot",
            `Correlação: ${signal.asset} bloqueado (${group ?? "único"}) — ${bestInGroup.asset} tem score maior (${bestInGroup.score} > ${signal.score})`,
          );
          signal.blocked = true;
          signal.reason = `Correlação: ${group ?? "grupo"} — ${bestInGroup.asset} tem score superior`;
        }
      }
    }

    // ══ RELATÓRIO FINAL DO SCAN ══
    const blockedAssets = scanLog.filter((s) => s.blocked);
    const passedAssets = scanLog.filter((s) => !s.blocked);

    // Relatório detalhado por tipo de ativo
    const forexAssets = assets.filter((a) => /^[A-Z]{6}$/.test(a.toUpperCase()) && !["BTCUSD", "ETHUSD", "XAUUSD"].includes(a.toUpperCase()));
    const hybridAssets = assets.filter((a) => ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"].includes(a.toUpperCase()));

    const forexLog = scanLog.filter((s) => /^[A-Z]{6}$/.test(s.asset.toUpperCase()) && !["BTCUSD", "ETHUSD", "XAUUSD"].includes(s.asset.toUpperCase()));
    const forexBlocked = forexLog.filter((s) => s.blocked);
    const forexPassed = forexLog.filter((s) => !s.blocked);

    engineLogger.info("FlowRobot", `═══ RELATÓRIO SCAN COMPLETO ═══`, {
      totalAssets: assets.length,
      totalPassed: passedAssets.length,
      totalBlocked: blockedAssets.length,
      forexTotal: forexAssets.length,
      forexPassed: forexPassed.length,
      forexBlocked: forexBlocked.length,
      hybridTotal: hybridAssets.length,
      profile,
      session: this._state.currentSession,
    });

    // Log detalhado para CADA ativo Forex
    for (const fx of forexAssets) {
      const entries = forexLog.filter((s) => s.asset === fx);
      if (entries.length === 0) {
        engineLogger.warn("FlowRobot", `FOREX ${fx}: ⚠ NÃO ESCANEADO — nenhum registro no scanLog`);
      } else {
        for (const entry of entries) {
          if (entry.blocked) {
            engineLogger.warn("FlowRobot", `FOREX ${fx} ${entry.timeframe}: ✗ BLOQUEADO — ${entry.reason}`);
          } else {
            engineLogger.info("FlowRobot", `FOREX ${fx} ${entry.timeframe}: ✓ PASSOU — score=${entry.score}, trend=${entry.trend ?? "?"}, pattern=${entry.pattern ?? "?"}`);
          }
        }
      }
    }

    // Breakdown de bloqueios por motivo
    const blockReasons = new Map<string, string[]>();
    for (const s of blockedAssets) {
      const reasonPrefix = s.reason.substring(0, 30);
      if (!blockReasons.has(reasonPrefix)) blockReasons.set(reasonPrefix, []);
      blockReasons.get(reasonPrefix)!.push(s.asset);
    }
    engineLogger.info("FlowRobot", `═══ MOTIVOS DE BLOQUEIO ═══`, {
      motivos: Array.from(blockReasons.entries()).map(([motivo, items]) => `${motivo}: ${items.join(", ")}`),
    });

    // Emit scan log ONCE at the end of the full scan cycle
    this._emitScanLog(scanLog);

    if (bestCandidate) {
      this._state.lastScannedAsset = bestCandidate.asset;

      this._emitScoreBreakdown({
        total: bestCandidate.decision.scoreBreakdown.total,
        band: bestCandidate.decision.scoreBreakdown.band,
        bandLabel: bestCandidate.decision.scoreBreakdown.bandLabel,
        filters: bestCandidate.decision.scoreBreakdown.filters.map((f) => ({
          name: f.name,
          points: f.points,
          maxPoints: f.maxPoints,
          detail: f.detail,
        })),
        entryReason: bestCandidate.decision.scoreBreakdown.entryReason,
        refusalReason: bestCandidate.decision.scoreBreakdown.refusalReason,
        strategy: bestCandidate.decision.scoreBreakdown.strategy,
      });

      engineLogger.info(
        "FlowRobot",
        `Scan concluído: melhor ativo = ${bestCandidate.asset} (score: ${bestCandidate.decision.scoreBreakdown.total})`,
      );
      return bestCandidate;
    }

    engineLogger.info(
      "FlowRobot",
      `Scan concluído: nenhum sinal encontrado em ${assets.length} ativos`,
    );
    return null;
  }

  private _isSessionAllowed(): boolean {
    const profile = this._state.config.operationProfile ?? "AUTO";

    // HYBRID_PROBABILITY operates 24/7 — skip session check entirely
    if (profile === "HYBRID_PROBABILITY") {
      return true;
    }

    if (this._state.currentSession === "closed") {
      console.log(
        `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: sessão fechada ═══ currentSession=${this._state.currentSession} asset=${this._state.config.asset}`,
      );
      engineLogger.warn("FlowRobot", `═══ BLOQUEADO: SESSÃO FECHADA ═══ session=${this._state.currentSession} — Nenhum ativo Forex será analisado (horário: 18:00-22:00 BRT, sábado, ou domingo antes das 22:00)`);
      this._emitDiagnostic("session", "blocked", "Mercado fechado — aguardando abertura");
      return false;
    }
    console.log(
      `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ Sessão OK ═══ currentSession=${this._state.currentSession}`,
    );
    return true;
  }

  private async _analyzeMarketDirection(): Promise<"call" | "put" | null> {
    console.log(
      `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ _analyzeMarketDirection INÍCIO ═══ scanMode=${this._state.config.scanMode} asset=${this._state.config.asset} profile=${this._state.config.operationProfile} session=${this._state.currentSession}`,
    );
    // ══ FILTRO DE SESSÃO ══
    if (!this._isSessionAllowed()) return null;

    // ── MODO MULTI: escanear todos os ativos ──
    if (this._state.config.scanMode === "multi") {
      const result = await this._scanAllAssets();
      if (result) {
        // Atualiza config para o ativo encontrado
        this._state.config.asset = result.asset;
        this._state.lastAnalysis = result.decision;
        this._state.selectedTimeframe = result.timeframe;
        this._emit("state-changed");
        this._emitMarketUpdate({
          asset: result.asset,
          timeframe: result.timeframe,
          trend:
            result.decision.direction === "CALL"
              ? "alta"
              : result.decision.direction === "PUT"
                ? "baixa"
                : "lateral",
          strength: result.decision.trend?.score ?? 0,
          score: result.decision.scoreBreakdown?.total ?? 0,
          confidence: result.decision.scoreBreakdown?.total ?? 0,
          direction: result.direction.toLowerCase() as "call" | "put",
          engineStatus: "operating",
          profile: this._state.config.operationProfile ?? "AUTO",
        });

        this._emitDiagnostic(
          "entry",
          "authorized",
          `✅ ${result.direction.toUpperCase()} em ${result.asset} (${result.timeframe}) — Score: ${result.decision.scoreBreakdown.total}/100 (${result.decision.scoreBreakdown.bandLabel})`,
        );
        this._emitAnalyst("analysis.completed", {
          asset: result.asset,
          direction: result.direction,
          score: result.decision.scoreBreakdown.total,
          timeframe: result.timeframe,
          traceId: makeTraceId(),
        });
        this._emitAnalyst("scanner.completed");

        this._emitDiaryEntry(
          `Scan multi-ativo: ${result.asset} (${result.timeframe}) escolhido. ${result.direction.toUpperCase()} — Score ${result.decision.scoreBreakdown.total}/100 (${result.decision.scoreBreakdown.bandLabel}). Estratégia: ${result.decision.scoreBreakdown.strategy}.`,
          result.direction === "call" ? "📈" : "📉",
          "success",
        );

        return result.direction;
      }

      // Nenhum sinal encontrado
      this._emitDiagnostic(
        "entry",
        "blocked",
        `Nenhum sinal em ${this._state.config.assets.length} ativos`,
      );
      this._emitAnalyst("analysis.no-signal");
      this._emitAnalyst("scanner.completed");
      return null;
    }

    // ── MODO SINGLE: análise do ativo configurado ──
    try {
      const asset = this._state.config.asset;
      const timeframes = this._state.config.timeframes;

      // ── ETAPA 1: Recebendo dados ──
      this._emitAnalyst("scanner.started");
      this._emitDiagnostic("receiving", "loading", "Conectando ao WebSocket...");

      const payout = await this.broker.getPayout(asset).catch((err) => {
        engineLogger.warn("FlowRobot", "Falha ao buscar payout", { asset, error: String(err) });
        return null;
      });
      engineLogger.info("FlowRobot", "Payout consultado", { asset, payout });
      if (!payout || payout < 0.7) {
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: payout insuficiente ═══ payout=${payout} asset=${asset}`,
        );
        this._emitDiagnostic("receiving", "error", `Payout insuficiente: ${payout ?? "null"}`);
        this._emitAnalyst("scanner.completed");
        engineLogger.warn("FlowRobot", `BLOQUEADO: payout insuficiente (${payout})`, { asset });
        return null;
      }
      this._emitDiagnostic("receiving", "ok", `Payout: ${payout}`);

      // Busca candles para cada timeframe diretamente na resolução correta
      const profile = this.state.config.operationProfile ?? "AUTO";
      const minCandles = getMinCandles(profile);
      const fetchSize = getFetchSize(profile);
      let bestDecision: DecisionResult | null = null;
      let bestTimeframe: string | null = null;
      let bestDirection: "CALL" | "PUT" | null = null;
      let bestCandles: Candle[] | null = null;
      let bestScore = 0;

      for (const tf of timeframes) {
        try {
          const candles = await this.broker.getCandles(asset, tf, fetchSize);
          engineLogger.info("FlowRobot", `Candles ${tf} recebidos`, {
            asset,
            count: candles.length,
            fetchSize,
          });
          if (tf === "M1") {
            this._emitAnalyst("candle.new", { symbol: asset, count: candles.length });
          }
          if (!candles || candles.length < minCandles) {
            console.log(
              `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: poucos candles ═══ tf=${tf} got=${candles?.length ?? 0} need=${minCandles} asset=${asset} profile=${profile}`,
            );
            engineLogger.warn(
              "FlowRobot",
              `${tf}: poucos dados (${candles?.length ?? 0}/${minCandles})`,
              { asset },
            );
            continue;
          }
          console.log(
            `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ Chamando DecisionEngine.analyze() ═══ tf=${tf} candles=${candles.length} asset=${asset} profile=${this.state.config.operationProfile}`,
          );
          const decision = this.decisionEngine.analyze(candles, asset, {
            operationProfile: this.state.config.operationProfile,
            hybridProbabilityConfig: this.state.config.hybridProbabilityConfig,
            timeframe: tf,
          });
          if (decision.direction && !decision.blockedReason) {
            const score = decision.scoreBreakdown.total;
            if (score > bestScore) {
              bestScore = score;
              bestDecision = decision;
              bestTimeframe = tf;
              bestDirection = decision.direction;
              bestCandles = candles;
            }
          }
        } catch (e) {
          engineLogger.error("FlowRobot", `Erro ao buscar candles ${tf}: ${asset}`, {
            error: String(e),
          });
        }
      }

      if (!bestDecision || !bestTimeframe || !bestDirection || !bestCandles) {
        console.log(
          `[FLOW DIAG] ${new Date().toLocaleTimeString("pt-BR")} ═══ BLOQUEADO: nenhum sinal em nenhum timeframe ═══ asset=${asset} timeframes=${timeframes.join(",")} profile=${this.state.config.operationProfile}`,
        );
        this._emitDiagnostic("analyzing", "error", "Nenhum sinal encontrado em nenhum timeframe");
        this._emitAnalyst("scanner.completed");
        this._emitAnalyst("analysis.no-signal");
        return null;
      }

      const decision = bestDecision;
      const timeframe = bestTimeframe;
      const candles = bestCandles;
      this._state.selectedTimeframe = timeframe;
      this._state.lastAnalysis = decision;

      // ── ETAPA 2: Analisando mercado ──
      this._emitDiagnostic("analyzing", "loading", "Executando Decision Engine...");
      engineLogger.info("FlowRobot", "Executando Decision Engine", {
        asset,
        candleCount: candles.length,
        timeframe,
      });

      // Emit candle reading
      const lastCandle = candles[candles.length - 2];
      if (lastCandle) {
        const isGreen = lastCandle.close > lastCandle.open;
        const range = lastCandle.high - lastCandle.low || 1;
        const body = Math.abs(lastCandle.close - lastCandle.open);
        const wickTop = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
        const wickBottom = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
        this._emitCandleReading({
          isGreen,
          bodyPercent: (body / range) * 100,
          wickTopPercent: (wickTop / range) * 100,
          wickBottomPercent: (wickBottom / range) * 100,
          dominance: isGreen ? "compradora" : "vendedora",
          pressure: body / range > 0.7 ? "alta" : body / range > 0.4 ? "media" : "baixa",
          volumeAboveAverage: lastCandle.volume > 0,
          colorLabel: isGreen ? "🟢 Verde" : "🔴 Vermelha",
          icon: isGreen ? "🟢" : "🔴",
          progress: 100,
          phase: "Vela confirmada",
        });
      }

      // ── ETAPA 3: Score Engine calculado ──
      this._emitDiagnostic(
        "score",
        "ok",
        `${decision.scoreBreakdown.total}/100 (${decision.scoreBreakdown.bandLabel})`,
      );
      this._emitAnalyst("catalog.search");
      this._emitScore(decision.scoreBreakdown.total);

      // Emit score breakdown data for the AI panel
      this._emitScoreBreakdown({
        total: decision.scoreBreakdown.total,
        band: decision.scoreBreakdown.band,
        bandLabel: decision.scoreBreakdown.bandLabel,
        filters: decision.scoreBreakdown.filters.map((f) => ({
          name: f.name,
          points: f.points,
          maxPoints: f.maxPoints,
          detail: f.detail,
        })),
        entryReason: decision.scoreBreakdown.entryReason,
        refusalReason: decision.scoreBreakdown.refusalReason,
        strategy: decision.scoreBreakdown.strategy,
      });

      // Emit debug data with real indicator values
      if (decision.debugData) {
        const dd = decision.debugData;
        this._emitAnalystReasoning([
          {
            text: `Tendência: ${dd.trendDirection} (${dd.trendScore}/20) EMA9=${dd.ema9.toFixed(4)} EMA21=${dd.ema21.toFixed(4)} EMA50=${dd.ema50.toFixed(4)}`,
            checked: dd.trendScore >= 10,
          },
          {
            text: `Estrutura: BOS=${dd.bos ?? "none"} CHoCH=${dd.choch ?? "none"} Pullback=${dd.pullbackZone}`,
            checked: dd.bos !== null || dd.choch !== null,
          },
          {
            text: `Price Action: ${dd.paPattern ?? "nenhum"} (${dd.paDirection})`,
            checked: dd.paPattern !== null,
          },
          {
            text: `Smart Money: OB=${dd.obCount} FVG=${dd.fvgType ?? "none"} Sweep=${dd.sweepType ?? "none"}`,
            checked: dd.obCount > 0 || dd.fvgType !== null,
          },
          {
            text: `Momentum: RSI=${dd.rsi.toFixed(1)} (${dd.rsiZone}) MACD=${dd.macdTrend} ADX=${dd.adx.toFixed(1)} ATR=${dd.atr.toFixed(4)}`,
            checked: dd.adx > 15,
          },
          {
            text: `Volume: ${dd.volumeAboveAvg ? "acima da média" : "abaixo da média"}`,
            checked: dd.volumeAboveAvg,
          },
          {
            text: `Score Total: ${dd.totalScore}/100 — ${dd.canOperate ? "✅ PODE OPERAR" : "❌ BLOQUEADO"}`,
            checked: dd.canOperate,
          },
        ]);
      } else if (decision.trend.details.length > 0) {
        this._emitAnalystReasoning(
          decision.trend.details.slice(0, 5).map((d) => ({ text: d, checked: true })),
        );
      }

      // ── ETAPA 4: Entrada autorizada ou bloqueada ──
      if (decision.blockedReason) {
        const ruleLabel = this._getBlockRuleLabel(decision.blockedRule);
        this._emitDiagnostic(
          "entry",
          "blocked",
          `Bloqueado: ${ruleLabel} — ${decision.blockedReason}`,
        );
        this._emitAnalyst("analysis.no-signal");
        this._emitAnalyst("scanner.completed");
        engineLogger.warn(
          "FlowRobot",
          `BLOQUEADO [${decision.blockedRule}]: ${decision.blockedReason}`,
          {
            score: decision.scoreBreakdown.total,
            band: decision.scoreBreakdown.bandLabel,
            trend: decision.trend.direction,
          },
        );
        return null;
      }

      const direction = decision.direction?.toLowerCase() as "call" | "put" | null;

      if (direction) {
        this._emitDiagnostic(
          "entry",
          "authorized",
          `✅ ${direction.toUpperCase()} autorizado — Score: ${decision.scoreBreakdown.total}/100 (${decision.scoreBreakdown.bandLabel})`,
        );

        if (direction === "call") this._emitAnalyst("candle.green");
        else this._emitAnalyst("candle.red");

        this._emitAnalystNextAction(
          `Entrada ${direction.toUpperCase()} autorizada`,
          `Score: ${decision.scoreBreakdown.total}/100 (${decision.scoreBreakdown.bandLabel})`,
          `Estratégia: ${decision.scoreBreakdown.strategy} | Trend: ${decision.trend.direction} | PA: ${decision.priceAction.pattern ?? "none"}`,
        );

        this._emitDiaryEntry(
          `Score Engine: ${direction.toUpperCase()} autorizado. Score ${decision.scoreBreakdown.total}/100 (${decision.scoreBreakdown.bandLabel}). Estratégia: ${decision.scoreBreakdown.strategy}. Trend: ${decision.trend.direction}. PA: ${decision.priceAction.pattern ?? "none"}.`,
          direction === "call" ? "📈" : "📉",
          "success",
        );

        engineLogger.trade("FlowRobot", `✅ ${direction.toUpperCase()} AUTORIZADO`, {
          score: decision.scoreBreakdown.total,
          band: decision.scoreBreakdown.bandLabel,
          strategy: decision.scoreBreakdown.strategy,
          trend: decision.trend.direction,
          pattern: decision.priceAction.pattern,
          blockedRule: decision.blockedRule,
        });
      }

      this._emitAnalyst("analysis.completed", {
        asset,
        direction,
        score: decision.scoreBreakdown.total,
        timeframe: this._state.selectedTimeframe ?? this._state.config.timeframes[0],
        traceId: makeTraceId(),
      });
      this._emitAnalyst("scanner.completed");

      return direction;
    } catch (e) {
      this._emitDiagnostic("analyzing", "error", `Erro: ${e}`);
      this._emitAnalyst("scanner.completed");
      engineLogger.error("FlowRobot", "Decision Engine error", { error: String(e) });
      return null;
    }
  }

  private _getBlockRuleLabel(rule: BlockedRule): string {
    switch (rule) {
      case "INSUFFICIENT_DATA":
        return "Dados insuficientes";
      case "LOW_SCORE":
        return "Score abaixo do mínimo";
      case "NO_CLEAR_DIRECTION":
        return "Sem direção clara";
      case "NO_TREND":
        return "Sem tendência definida";
      case "SIDEWAYS_MARKET":
        return "Mercado lateral";
      case "PAYOUT_LOW":
        return "Payout insuficiente";
      case "BROKER_ERROR":
        return "Erro de conexão";
      case "ANALYSIS_ERROR":
        return "Erro na análise";
      case "MICRO_REVERSAL":
        return "Micro Reversal Filter";
      default:
        return "Motivo desconhecido";
    }
  }

  private _stopByRisk(message: string): void {
    const stack = new Error().stack?.split("\n").slice(2, 6).join(" | ") ?? "no stack";
    console.log("[ROBOT STOP]", { reason: message, caller: stack });
    engineLogger.warn("FlowRobot", `[ROBOT STOP] ${message}`, { stack });
    this._clearTimers();
    this._state.status = "stopped";
    this._state.activeOperation = null;
    this._state.lastError = message;
    this._emit("stopped-by-risk", undefined, message);
  }

  private _setError(msg: string): void {
    const stack = new Error().stack?.split("\n").slice(2, 5).join(" | ") ?? "";
    console.log("[ROBOT ERROR]", { reason: msg, caller: stack });
    engineLogger.error("FlowRobot", `[ROBOT ERROR] ${msg}`, { stack });
    this._state.status = "error";
    this._state.lastError = msg;
    this._emit("error", undefined, msg);
  }

  private _emit(type: RobotEventType, operation?: RobotOperation, message?: string): void {
    const event: RobotEvent = { type, state: this.state, operation, message };
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        engineLogger.error("FlowRobot", `Listener falhou no evento ${type}`, {
          error: String(err),
        });
      }
    });
  }

  private _emitAnalyst(type: AnalystEventType, meta?: Record<string, unknown>): void {
    try {
      analystBus.emit(type, meta);
    } catch (err) {
      engineLogger.error("FlowRobot", `analystBus.emit falhou em ${type}`, {
        error: String(err),
        meta,
      });
    }
  }

  private _emitAnalystState(state: import("../modules/analyst/AnalystTypes").AnalystAIState): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, { aiState: state });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar state", {
        error: String(err),
        state,
      });
    }
  }

  private _emitAnalystReasoning(items: { text: string; checked: boolean }[]): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, { reasoning: items });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar reasoning", {
        error: String(err),
      });
    }
  }

  private _emitAnalystConfidence(value: number): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, { confidence: value });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar confidence", {
        error: String(err),
        value,
      });
    }
  }

  private _emitAnalystNextAction(text: string, condition?: string, result?: string): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, {
        nextAction: { text, condition, result },
      });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar nextAction", {
        error: String(err),
        text,
      });
    }
  }

  private _emitAnalystStats(
    stats: Partial<import("../modules/analyst/AnalystTypes").AnalystStats>,
  ): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, { stats });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar stats", {
        error: String(err),
      });
    }
  }

  private _emitMarketUpdate(data: {
    asset?: string;
    timeframe?: string;
    trend?: "alta" | "baixa" | "lateral" | null;
    volatility?: "baixa" | "media" | "alta";
    strength?: number;
    score?: number;
    confidence?: number;
    direction?: "call" | "put" | null;
    analysisPhase?: "idle" | "scoring" | "trending" | "structure" | "momentum" | "done";
    engineStatus?: "idle" | "analyzing" | "waiting" | "operating" | "error";
    scanProgress?: number;
    catalogProgress?: { scanned: number; total: number } | null;
    profile?: string;
    bufferVisual?: { current: number; capacity: number; minimum: number; percent: number } | null;
  }): void {
    try {
      analystBus.emit("market.update" as AnalystEventType, data);
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar market", {
        error: String(err),
      });
    }
  }

  private _emitCandleReading(data: {
    isGreen?: boolean | null;
    bodyPercent?: number;
    wickTopPercent?: number;
    wickBottomPercent?: number;
    dominance?: "compradora" | "vendedora" | "neutra";
    pressure?: "alta" | "media" | "baixa";
    volumeAboveAverage?: boolean;
    colorLabel?: string;
    icon?: string;
    progress?: number;
    phase?: string;
  }): void {
    try {
      analystBus.emit("candle.reading" as AnalystEventType, data);
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar candle reading", {
        error: String(err),
      });
    }
  }

  private _emitDiaryEntry(
    text: string,
    icon: string,
    level: "success" | "info" | "warning" | "error" = "info",
  ): void {
    try {
      analystBus.emit("diary.entry" as AnalystEventType, { text, icon, level });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao adicionar diary entry", {
        error: String(err),
        text,
      });
    }
  }

  private _emitScore(value: number): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, { score: value });
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao atualizar score", {
        error: String(err),
        value,
      });
    }
  }

  private _emitScoreBreakdown(data: {
    total: number;
    band: string;
    bandLabel: string;
    filters: { name: string; points: number; maxPoints: number; detail: string }[];
    entryReason: string | null;
    refusalReason: string | null;
    strategy: string;
  }): void {
    try {
      analystBus.emit("score.breakdown" as AnalystEventType, data as Record<string, unknown>);
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao enviar score breakdown", {
        error: String(err),
      });
    }
  }

  private _emitDecisionContext(ctx: DecisionContext): void {
    try {
      analystBus.emit(
        "decision.context" as AnalystEventType,
        ctx as unknown as Record<string, unknown>,
      );
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao enviar decision context", {
        error: String(err),
      });
    }
  }

  private _emitOperationContext(ctx: OperationContext): void {
    try {
      analystBus.emit(
        "operation.context" as AnalystEventType,
        ctx as unknown as Record<string, unknown>,
      );
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao enviar operation context", {
        error: String(err),
      });
    }
  }

  private _emitReplayContext(ctx: ReplayContext): void {
    try {
      analystBus.emit(
        "replay.context" as AnalystEventType,
        ctx as unknown as Record<string, unknown>,
      );
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao enviar replay context", {
        error: String(err),
      });
    }
  }

  private _emitPerformanceContext(): void {
    try {
      const perfCtx = buildPerformanceContext(
        this._decisionHistory,
        this._operationHistory,
        this._replayHistory,
      );
      this._lastPerformanceContext = perfCtx;
      analystBus.emit(
        "performance.context" as AnalystEventType,
        perfCtx as unknown as Record<string, unknown>,
      );
      // Record snapshot in history (FIFO 365 days)
      performanceHistory.record(perfCtx);
    } catch (err) {
      engineLogger.error("FlowRobot", "analystBus.emit falhou ao enviar performance context", {
        error: String(err),
      });
    }
  }

  private _emitDiagnostic(
    step:
      | "receiving"
      | "analyzing"
      | "score"
      | "entry"
      | "order"
      | "confirmed"
      | "demo"
      | "session",
    status: "loading" | "ok" | "error" | "blocked" | "authorized" | "warning",
    message: string,
  ): void {
    try {
      analystBus.emit("system.info" as AnalystEventType, {
        diagnostic: { step, status, message, timestamp: Date.now() },
      });
    } catch (err) {
      engineLogger.error("FlowRobot", "Falha ao emitir diagnóstico", {
        error: String(err),
        step,
        status,
      });
    }
  }

  private _emitScanLog(entries: ScanLogEntry[]): void {
    try {
      analystBus.emit("scanLog.update" as AnalystEventType, { scanLog: entries });
    } catch (err) {
      engineLogger.error("FlowRobot", "Falha ao emitir scan log", { error: String(err) });
    }
  }

  private _clearTimers(): void {
    if (this._loopTimer) {
      clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }
    this._clearCountdown();
    this._stopBalanceRefresh();
  }

  private async _refreshBalance(): Promise<void> {
    try {
      const bal = await this.broker.getBalance();
      const demo = bal.demoBalance ?? 0;
      const real = bal.balance ?? 0;
      const newBalance = this._state.config.accountType === "demo" ? demo : real;
      const oldBalance = this._state.currentBankroll;

      this._state.currentBankroll = newBalance;
      this._balanceSource = "REAL";
      this._lastBalanceSync = Date.now();

      // Apenas na primeira carga da sessão: define initialBankroll com o saldo real
      if (!this._sessionStarted) {
        this._state.initialBankroll = newBalance;
        this._sessionStarted = true;
        engineLogger.info(
          "FlowRobot",
          `Sessão iniciada — initialBankroll=${newBalance} (saldo real Puma)`,
          {},
        );
      }

      // Atualiza config compartilhada com saldo real
      this._state.config.initialBankroll = newBalance;
      this.smartRecovery.regenerateLevelTable();

      console.log("[BALANCE SYNC]", {
        initialBankroll: this._state.initialBankroll,
        currentBankroll: newBalance,
        sessionProfit: +this._state.sessionProfit.toFixed(2),
        delta: +(newBalance - oldBalance).toFixed(2),
        source: "Puma Demo API",
      });
      engineLogger.info("FlowRobot", "[BALANCE SYNC] Saldo sincronizado via Puma API", {
        initialBankroll: this._state.initialBankroll,
        currentBankroll: newBalance,
        sessionProfit: this._state.sessionProfit,
        accountType: this._state.config.accountType,
      });
    } catch (err) {
      // Falha temporária: mantém último saldo REAL conhecido, não volta para MOCK
      const failReason = err instanceof Error ? err.message : String(err);
      const lastSync =
        this._lastBalanceSync > 0
          ? new Date(this._lastBalanceSync).toLocaleTimeString("pt-BR")
          : "never";
      console.log("[BALANCE SYNC]", {
        mode: "REAL_STALE",
        currentBankroll: this._state.currentBankroll,
        sessionProfit: +this._state.sessionProfit.toFixed(2),
        lastSync,
        reason: failReason,
        retryIn: "30s",
      });
      engineLogger.warn(
        "FlowRobot",
        "[BALANCE SYNC] Falha ao sincronizar — mantendo último saldo REAL",
        {
          error: failReason,
          currentBankroll: this._state.currentBankroll,
          lastSync,
        },
      );
      // NÃO altera _balanceSource — mantém "REAL" para não alternar entre modos
    }
  }

  private _startBalanceRefresh(intervalMs = 30000): void {
    this._stopBalanceRefresh();
    this._balanceRefreshTimer = setInterval(() => {
      this._refreshBalance().catch((err) =>
        engineLogger.error("FlowRobot", "Erro no refresh periódico de saldo", {
          error: String(err),
        }),
      );
    }, intervalMs);
  }

  private _stopBalanceRefresh(): void {
    if (this._balanceRefreshTimer) {
      clearInterval(this._balanceRefreshTimer);
      this._balanceRefreshTimer = null;
    }
  }

  private _clearCountdown(): void {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  private _wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private _buildInitialState(
    config: RobotConfig,
    session?: MarketSession,
    sessionInfo?: MarketSessionInfo | null,
  ): RobotState {
    return {
      status: "idle",
      config,
      currentRecoveryStep: 0,
      currentEntry: this.smartRecovery.getCurrentStake(),
      entryNumber: 1,
      currentBankroll: config.initialBankroll,
      initialBankroll: config.initialBankroll,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      winRate: 0,
      sessionProfit: 0,
      operations: [],
      activeOperation: null,
      lastError: null,
      startedAt: null,
      nextOperationIn: 0,
      lastAnalysis: null,
      lastScannedAsset: null,
      scanLog: [],
      currentSession: session ?? "open",
      sessionInfo: sessionInfo ?? null,
      nextTrade: null,
      selectedTimeframe: null,
      lastEntryPrecision: 0,
      avgEntryPrecision: 0,
      bestEntryPrecision: 0,
      worstEntryPrecision: 0,
      executionPhase: "idle",
      healthCheck: null,
    };
  }

  /**
   * Executa health check pré-scan: valida buffer M1, REST M5/M15, latência.
   */
  async _runHealthCheck(): Promise<HealthCheckResult> {
    const items: HealthCheckItem[] = [];
    const assets = this._state.config.assets;
    const timeframes = this._state.config.timeframes ?? ["M1"];
    const healthProfile = this._state.config.operationProfile ?? "AUTO";
    const healthMinCandles = getMinCandles(healthProfile);

    // 1. Buffer M1 (tempo real)
    const bufferStatus = this.broker.getBufferStatus();
    for (const asset of assets) {
      const buf = bufferStatus.find((b) => b.key === asset);
      const count = buf?.count ?? 0;
      const ok = count >= healthMinCandles;
      items.push({
        label: `${asset} M1`,
        ok,
        value: `${count} candles`,
        detail: ok ? undefined : `mínimo: ${healthMinCandles}`,
      });
    }

    // 2. REST M5/M15 — faz uma chamada rápida de teste
    for (const asset of assets) {
      for (const tf of timeframes) {
        if (tf === "M1") continue;
        try {
          const candles = await this.broker.getCandles(asset, tf, 200);
          const ok = candles.length >= healthMinCandles;
          items.push({
            label: `${asset} ${tf}`,
            ok,
            value: `${candles.length} candles`,
            detail: ok ? undefined : `mínimo: ${getMinCandles(asset)}`,
          });
        } catch {
          items.push({
            label: `${asset} ${tf}`,
            ok: false,
            value: "erro",
            detail: "falha na requisição REST",
          });
        }
      }
    }

    const passed = items.filter((i) => i.ok).length;
    const total = items.length;
    const result: HealthCheckResult = {
      timestamp: Date.now(),
      items,
      summary: { total, passed, failed: total - passed },
    };
    this._state.healthCheck = result;
    engineLogger.info("FlowRobot", `═══ HEALTH CHECK ═══ ${passed}/${total} ok`, {
      failed: total - passed,
      details: items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail ?? i.value}`),
    });
    return result;
  }

  // ══ DIAGNÓSTICO COMPLETO ══
  generateDiagnosticReport(): string {
    const lines: string[] = [];
    const ts = new Date().toLocaleTimeString("pt-BR");

    lines.push(`═══════════════════════════════════════════════`);
    lines.push(`  RELATÓRIO DE DIAGNÓSTICO — ${ts}`);
    lines.push(`═══════════════════════════════════════════════`);
    lines.push("");

    // 1. Socket.IO
    const socketIOOk = this.broker.connected;
    lines.push(`1. Socket.IO: ${socketIOOk ? "✅ CONECTADO" : "❌ DESCONECTADO"}`);

    // 2. Buffer de candles
    const bufferStatus = this.broker.getBufferStatus();
    lines.push(`2. Buffer de Candles: ${bufferStatus.length > 0 ? "✅ POPULADO" : "❌ VAZIO"}`);
    for (const b of bufferStatus) {
      lines.push(`   ${b.key}: ${b.count} candles, último: ${b.lastClose} @ ${b.lastTime}`);
    }

    // 3. Configuração
    lines.push(`3. Configuração:`);
    lines.push(`   Modo: ${this._state.config.scanMode}`);
    lines.push(`   Ativos: ${this._state.config.assets.join(", ")}`);
    lines.push(`   Timeframes: ${this._state.config.timeframes.join(", ")}`);
    lines.push(`   Selected: ${this._state.selectedTimeframe ?? "none"}`);
    lines.push(`   Status: ${this._state.status}`);

    // 4. Último scan
    if (this._state.scanLog.length > 0) {
      lines.push(`4. Último Scan (${this._state.scanLog.length} ativos):`);
      for (const s of this._state.scanLog) {
        const icon = s.blocked ? "❌" : "✅";
        lines.push(`   ${icon} ${s.asset}: Score ${s.score} — ${s.reason}`);
      }
    } else {
      lines.push(`4. Nenhum scan realizado ainda`);
    }

    // 5. Última análise
    const last = this._state.lastAnalysis;
    if (last) {
      lines.push(`5. Última Análise:`);
      lines.push(`   Ativo: ${last.asset}`);
      lines.push(`   Score: ${last.scoreBreakdown.total}/100 (${last.scoreBreakdown.bandLabel})`);
      lines.push(`   Estratégia: ${last.scoreBreakdown.strategy}`);
      lines.push(`   Trend: ${last.trend.direction} (${last.trend.score}/20)`);
      lines.push(`   Structure: BOS=${last.structure.bos ?? "none"} (${last.structure.score}/15)`);
      lines.push(`   PA: ${last.priceAction.pattern ?? "none"} (${last.priceAction.score}/15)`);
      lines.push(`   SM: OB=${last.smartMoney.orderBlocks.length} (${last.smartMoney.score}/10)`);
      lines.push(
        `   Mom: RSI=${last.momentum.rsi.toFixed(1)} MACD=${last.momentum.macdTrend} (${last.momentum.score}/15)`,
      );
      lines.push(`   Direção: ${last.direction ?? "BLOQUEADO"}`);
      if (last.blockedReason) {
        lines.push(`   Motivo: ${last.blockedReason}`);
      }
      // Score breakdown filters
      lines.push(`   Filtros:`);
      for (const f of last.scoreBreakdown.filters) {
        lines.push(`     ${f.name}: ${f.points}/${f.maxPoints}`);
      }
    } else {
      lines.push(`5. Nenhuma análise realizada`);
    }

    // 6. Score zero check
    if (last && last.scoreBreakdown.total === 0) {
      lines.push("");
      lines.push(`⚠️  SCORE ZERO DETECTADO — Motivos possíveis:`);
      if (last.trend.score === 0)
        lines.push(`   - TrendEngine retornou 0: ${last.trend.details.join(", ")}`);
      if (last.structure.score === 0)
        lines.push(`   - StructureEngine retornou 0: ${last.structure.details.join(", ")}`);
      if (last.priceAction.score === 0)
        lines.push(`   - PriceActionEngine retornou 0: ${last.priceAction.details.join(", ")}`);
      if (last.smartMoney.score === 0)
        lines.push(`   - SmartMoneyEngine retornou 0: ${last.smartMoney.details.join(", ")}`);
      if (last.momentum.score === 0)
        lines.push(`   - MomentumEngine retornou 0: ${last.momentum.details.join(", ")}`);
    }

    lines.push(`═══════════════════════════════════════════════`);

    const report = lines.join("\n");
    engineLogger.info("FlowRobot", report);
    return report;
  }
}
