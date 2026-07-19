export type AnalystEventType =
  | "scanner.started"
  | "scanner.completed"
  | "candle.new"
  | "candle.closed"
  | "candle.green"
  | "candle.red"
  | "candle.reading"
  | "candle.reading.progress"
  | "pattern.detected"
  | "pattern.2greens"
  | "pattern.2reds"
  | "pattern.doji"
  | "pattern.insidebar"
  | "pattern.broken"
  | "catalog.search"
  | "catalog.result"
  | "score.calculated"
  | "score.breakdown"
  | "trade.call"
  | "trade.put"
  | "trade.executed"
  | "trade.win"
  | "trade.loss"
  | "trade.draw"
  | "recovery.started"
  | "recovery.step"
  | "recovery.finished"
  | "recovery.reset"
  | "risk.profit-target"
  | "risk.stop-loss"
  | "risk.insufficient-balance"
  | "risk.ai-pause"
  | "risk.demo-limit"
  | "risk.demo-limit-warning"
  | "analysis.started"
  | "analysis.completed"
  | "analysis.no-signal"
  | "analysis.reasoning"
  | "analysis.decision"
  | "trend.detected"
  | "support.detected"
  | "resistance.detected"
  | "lateralization.detected"
  | "continuity.detected"
  | "dominance.detected"
  | "filter.passed"
  | "filter.failed"
  | "order.sent"
  | "order.confirmed"
  | "order.error"
  | "robot.started"
  | "robot.paused"
  | "robot.resumed"
  | "robot.stopped"
  | "robot.error"
  | "diary.entry"
  | "market.update"
  | "scanLog.update"
  | "ai.decision"
  | "ai.blocked-entry"
  | "decision.context"
  | "operation.context"
  | "replay.context"
  | "performance.context"
  | "advisor.context"
  | "system.info";

export type AnalystMessageLevel = "success" | "info" | "warning" | "error";

export type AnalystMode = "compact" | "explanatory" | "developer";

export type AnalystAIState =
  | "idle"
  | "observing"
  | "analyzing"
  | "validating"
  | "confirming-entry"
  | "waiting"
  | "continuity"
  | "preparing"
  | "operating"
  | "win"
  | "loss"
  | "recovery"
  | "recovery-finished";

export type CandleDominance = "compradora" | "vendedora" | "neutra";
export type CandlePressure = "alta" | "media" | "baixa";
export type MarketTrend = "alta" | "baixa" | "lateral";
export type MarketVolatility = "baixa" | "media" | "alta";

export interface AnalystMessage {
  id: string;
  type: AnalystEventType;
  level: AnalystMessageLevel;
  text: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

export interface AnalystReasoningItem {
  id: string;
  text: string;
  checked: boolean;
  timestamp: Date;
}

export interface AnalystNextAction {
  text: string;
  condition?: string;
  result?: string;
}

export interface AnalystStats {
  patternsAnalyzed: number;
  entries: number;
  wins: number;
  losses: number;
  winRate: number;
  bestPattern: string;
  worstPattern: string;
}

export interface MarketInfo {
  asset: string;
  timeframe: string;
  trend: MarketTrend | null;
  volatility: MarketVolatility;
  strength: number;
  score: number;
  confidence: number;
}

export interface CandleReading {
  isGreen: boolean | null;
  bodyPercent: number;
  wickTopPercent: number;
  wickBottomPercent: number;
  dominance: CandleDominance;
  pressure: CandlePressure;
  volumeAboveAverage: boolean;
  colorLabel: string;
  icon: string;
  progress: number;
  phase: string;
}

export interface DiaryEntry {
  id: string;
  timestamp: Date;
  text: string;
  icon: string;
  level: AnalystMessageLevel;
}

export type DiagnosticStep = "receiving" | "analyzing" | "score" | "entry" | "order" | "confirmed";
export type DiagnosticStatus = "loading" | "ok" | "error" | "blocked" | "authorized";

export interface DiagnosticState {
  receiving: { status: DiagnosticStatus; message: string; timestamp: number };
  analyzing: { status: DiagnosticStatus; message: string; timestamp: number };
  score: { status: DiagnosticStatus; message: string; timestamp: number };
  entry: { status: DiagnosticStatus; message: string; timestamp: number };
  order: { status: DiagnosticStatus; message: string; timestamp: number };
  confirmed: { status: DiagnosticStatus; message: string; timestamp: number };
}

export const DEFAULT_DIAGNOSTIC: DiagnosticState = {
  receiving: { status: "loading", message: "Aguardando dados...", timestamp: 0 },
  analyzing: { status: "loading", message: "Aguardando análise...", timestamp: 0 },
  score: { status: "loading", message: "Aguardando score...", timestamp: 0 },
  entry: { status: "loading", message: "Aguardando decisão...", timestamp: 0 },
  order: { status: "loading", message: "Aguardando ordem...", timestamp: 0 },
  confirmed: { status: "loading", message: "Aguardando confirmação...", timestamp: 0 },
};

// ══ Score Engine types ══
export type ScoreBand =
  | "NAO_OPERAR"
  | "FRACO"
  | "OBSERVACAO"
  | "ENTRADA_PERMITIDA"
  | "ENTRADA_FORTE";

export interface ScoreFilterDisplay {
  name: string;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface ScoreBreakdownDisplay {
  total: number;
  band: ScoreBand;
  bandLabel: string;
  filters: ScoreFilterDisplay[];
  entryReason: string | null;
  refusalReason: string | null;
  strategy: string;
}

export interface ScoreEvolutionEntry {
  timestamp: Date;
  score: number;
  band: ScoreBand;
}

export interface ScanLogEntry {
  asset: string;
  score: number;
  blocked: boolean;
  reason: string;
  timestamp: number;
  trend?: string;
  pattern?: string;
  direction?: string;
  timeframe?: string;
}

export const SCORE_BAND_CONFIG: Record<
  ScoreBand,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  NAO_OPERAR: {
    label: "Não Operar",
    color: "text-danger",
    bgColor: "bg-danger/10",
    borderColor: "border-danger/20",
  },
  FRACO: {
    label: "Mercado Fraco",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  OBSERVACAO: {
    label: "Mercado Observação",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
  ENTRADA_PERMITIDA: {
    label: "Entrada Permitida",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  ENTRADA_FORTE: {
    label: "Entrada Forte",
    color: "text-success",
    bgColor: "bg-success/15",
    borderColor: "border-success/30",
  },
};

export interface AnalystState {
  messages: AnalystMessage[];
  currentStatus: AnalystAIState;
  mode: AnalystMode;
  maxMessages: number;
}

export const ANALYST_AI_STATE_CONFIG: Record<
  AnalystAIState,
  { label: string; avatar: string; color: string; bgColor: string; borderColor: string }
> = {
  idle: {
    label: "Inativo",
    avatar: "🤖",
    color: "text-muted-foreground",
    bgColor: "bg-secondary",
    borderColor: "border-border",
  },
  observing: {
    label: "Observando",
    avatar: "🟢",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  analyzing: {
    label: "Analisando",
    avatar: "🧠",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  validating: {
    label: "Validando padrão",
    avatar: "🟡",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
  "confirming-entry": {
    label: "Confirmando entrada",
    avatar: "🟠",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  waiting: {
    label: "Aguardando",
    avatar: "👀",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
  continuity: {
    label: "Continuidade",
    avatar: "👀",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  preparing: {
    label: "Entrada preparada",
    avatar: "🔵",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  operating: {
    label: "Operando",
    avatar: "🚀",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  win: {
    label: "WIN confirmado",
    avatar: "🏆",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
  },
  loss: {
    label: "LOSS registrado",
    avatar: "🔴",
    color: "text-danger",
    bgColor: "bg-danger/10",
    borderColor: "border-danger/30",
  },
  recovery: {
    label: "Recovery iniciado",
    avatar: "🟣",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  "recovery-finished": {
    label: "Recovery finalizado",
    avatar: "🟢",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
};

export const ANALYST_MODE_CONFIG: Record<AnalystMode, { label: string; description: string }> = {
  compact: { label: "Compacto", description: "Apenas eventos principais" },
  explanatory: { label: "Explicativo", description: "Explica cada decisão" },
  developer: { label: "Desenvolvedor", description: "Todos os eventos internos" },
};
