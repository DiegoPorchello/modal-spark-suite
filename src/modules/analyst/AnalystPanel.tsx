import {
  Bot,
  X,
  Trash2,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Brain,
  Eye,
  Zap,
  Rocket,
  Trophy,
  XCircle,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  CandlestickChart,
  Activity,
  Volume2,
  VolumeX,
  BarChart3,
  TrendingUpIcon,
  Star,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import type {
  AnalystMode,
  AnalystAIState,
  ScoreBreakdownDisplay,
  ScoreFilterDisplay,
  ScoreBand,
  ScanLogEntry,
} from "./AnalystTypes";
import { ANALYST_AI_STATE_CONFIG, ANALYST_MODE_CONFIG, SCORE_BAND_CONFIG } from "./AnalystTypes";
import type { AnalystStore } from "./AnalystStore";
import type { PerformanceContext } from "../performance/types/performance-context.types";
import { AnalystTimeline } from "./AnalystTimeline";
import { DiagnosticPanel } from "./DiagnosticPanel";
import type { RobotState } from "../../engine/flow-robot-engine";
import { getVoiceEngine, type VoiceEngine } from "./VoiceEngine";

const STATE_ICONS: Record<AnalystAIState, React.ReactNode> = {
  idle: <Bot className="size-4" />,
  observing: <Eye className="size-4" />,
  analyzing: <Brain className="size-4" />,
  validating: <CheckCircle2 className="size-4" />,
  "confirming-entry": <Zap className="size-4" />,
  waiting: <Eye className="size-4" />,
  continuity: <Eye className="size-4" />,
  preparing: <Target className="size-4" />,
  operating: <Rocket className="size-4" />,
  win: <Trophy className="size-4" />,
  loss: <XCircle className="size-4" />,
  recovery: <RefreshCw className="size-4" />,
  "recovery-finished": <CheckCircle2 className="size-4" />,
};

function getScoreBandInfo(score: number): {
  label: string;
  color: string;
  barColor: string;
  band: ScoreBand;
} {
  if (score >= 85)
    return {
      label: "Entrada Forte",
      color: "text-success",
      barColor: "bg-success",
      band: "ENTRADA_FORTE",
    };
  if (score >= 70)
    return {
      label: "Entrada Permitida",
      color: "text-success",
      barColor: "bg-success",
      band: "ENTRADA_PERMITIDA",
    };
  if (score >= 60)
    return {
      label: "Mercado Observação",
      color: "text-warning",
      barColor: "bg-warning",
      band: "OBSERVACAO",
    };
  if (score >= 40)
    return {
      label: "Mercado Fraco",
      color: "text-warning",
      barColor: "bg-warning",
      band: "FRACO",
    };
  return { label: "Não Operar", color: "text-danger", barColor: "bg-danger", band: "NAO_OPERAR" };
}

export function AnalystPanel({
  store,
  robotState,
}: {
  store: AnalystStore;
  robotState?: RobotState;
}) {
  const [modeOpen, setModeOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceRef = useRef<VoiceEngine | null>(null);
  const prevDiaryLenRef = useRef(0);

  useEffect(() => {
    voiceRef.current = getVoiceEngine();
  }, []);

  useEffect(() => {
    if (voiceRef.current) {
      voiceRef.current.enabled = voiceEnabled;
    }
  }, [voiceEnabled]);

  useEffect(() => {
    const diary = store.diary;
    if (!diary) {
      return;
    }
    if (voiceEnabled && voiceRef.current && diary.length > (prevDiaryLenRef.current || 0)) {
      const newEntry = diary[0];
      if (
        newEntry &&
        typeof newEntry === "object" &&
        "text" in newEntry &&
        "timestamp" in newEntry
      ) {
        voiceRef.current.speakDiary(newEntry);
      }
    }
    prevDiaryLenRef.current = diary.length;
  }, [store.diary, voiceEnabled]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next && voiceRef.current) {
        voiceRef.current.stop();
      }
      return next;
    });
  }, []);

  const stateConfig = ANALYST_AI_STATE_CONFIG[store.currentStatus];
  const filtered = store.getFilteredMessages();
  const analysis = robotState?.lastAnalysis;
  const score =
    store.score || (analysis?.scoreBreakdown?.total ?? analysis?.probability?.total ?? 0);
  const bandInfo = getScoreBandInfo(score);
  const scoreBreakdown = store.scoreBreakdown || analysis?.scoreBreakdown || null;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={store.toggleOpen}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-1.5 pl-2.5 pr-3 py-3 rounded-l-xl transition-all duration-300 shadow-lg border border-r-0 ${
          store.isOpen
            ? "translate-x-full opacity-0 pointer-events-none"
            : "translate-x-0 opacity-100"
        } bg-card border-border hover:bg-secondary`}
        title="Abrir NEXOR AI Analyst"
      >
        <span className="text-lg">{stateConfig.avatar}</span>
        <ChevronRight className="size-3 text-muted-foreground" />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full w-[340px] bg-card border-l border-border z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          store.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`size-9 rounded-xl ${stateConfig.bgColor} border ${stateConfig.borderColor} flex items-center justify-center transition-all duration-300`}
              >
                <span className="text-lg">{stateConfig.avatar}</span>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wide">NEXOR AI</h3>
                <div
                  className={`text-[10px] font-semibold ${stateConfig.color} transition-colors duration-300 flex items-center gap-1`}
                >
                  {STATE_ICONS[store.currentStatus]}
                  {stateConfig.label}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleVoice}
                className={`p-1.5 rounded-lg transition-colors ${
                  voiceEnabled
                    ? "bg-success/15 text-success"
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                title={voiceEnabled ? "Desativar voz" : "Ativar voz do copiloto"}
              >
                {voiceEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              </button>
              <button
                onClick={store.clear}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Limpar"
              >
                <Trash2 className="size-3.5" />
              </button>
              <button
                onClick={() => setModeOpen(!modeOpen)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Modo"
              >
                <Settings className="size-3.5" />
              </button>
              <button
                onClick={store.toggleOpen}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Fechar"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Mode Selector */}
          {modeOpen && (
            <div className="mt-3 p-2 rounded-lg bg-secondary/50 border border-border">
              <div className="text-[9px] tracking-widest text-muted-foreground mb-2">MODO</div>
              <div className="flex gap-1">
                {(["compact", "explanatory", "developer"] as AnalystMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      store.setMode(m);
                      setModeOpen(false);
                    }}
                    className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${
                      store.mode === m
                        ? "bg-success/15 text-success"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {ANALYST_MODE_CONFIG[m].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. MERCADO */}
          <MarketPanel
            market={store.market}
            analysis={analysis ?? null}
            robotState={robotState}
            confidence={store.confidence}
          />

          {/* 2. SCAN LOG (Multi-Asset) */}
          {store.scanLog.length > 0 && <ScanLogPanel scanLog={store.scanLog} />}

          {/* Score Engine Bar */}
          <ScoreEngineBar score={score} bandInfo={bandInfo} scoreBreakdown={scoreBreakdown} />

          {/* 2. LEITURA DA VELA */}
          <CandleReadingPanel reading={store.candleReading} />

          {/* 5. FLUXO DO ROBÔ (Diagnóstico) */}
          <div className="px-4 py-3 border-b border-border">
            <DiagnosticPanel diagnostic={store.diagnostic} />
          </div>

          {/* 6. SCORE BREAKDOWN (filtros) */}
          {scoreBreakdown && <ScoreBreakdownPanel scoreBreakdown={scoreBreakdown} />}

          {/* 6b. DECISION CONTEXT */}
          {store.decisionContext && <DecisionContextPanelInline context={store.decisionContext} />}

          {/* 6c. OPERATION CONTEXT */}
          {store.operationContext && <OperationContextPanelInline context={store.operationContext} />}

          {/* 6d. REPLAY TIMELINE */}
          {store.replayContext && <ReplayTimelinePanelInline context={store.replayContext} />}

          {/* 6e. PERFORMANCE INSIGHTS */}
          {store.performanceContext && <PerformanceInsightsInline context={store.performanceContext} />}

          {/* 3. PENSAMENTO DA IA */}
          <AIThinkingPanel
            reasoning={store.reasoning}
            status={store.currentStatus}
            nextAction={store.nextAction}
          />

          {/* 4. DIÁRIO DO TRADER */}
          <DiaryPanel diary={store.diary} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border shrink-0">
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{store.diary.length} registros</span>
            <span>
              {store.mode === "compact"
                ? "Compacto"
                : store.mode === "explanatory"
                  ? "Explicativo"
                  : "Dev"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. MERCADO
 * ═══════════════════════════════════════════════════════════════════════════ */
function MarketPanel({
  market,
  analysis,
  robotState,
  confidence,
}: {
  market: {
    asset: string;
    timeframe: string;
    trend: "alta" | "baixa" | "lateral" | null;
    volatility: string;
    strength: number;
    score: number;
    confidence: number;
  };
  analysis: RobotState["lastAnalysis"] | null;
  robotState?: RobotState;
  confidence: number;
}) {
  const trendIcon =
    market.trend === "alta" ? (
      <TrendingUp className="size-3 text-success" />
    ) : market.trend === "baixa" ? (
      <TrendingDown className="size-3 text-danger" />
    ) : (
      <Minus className="size-3 text-muted-foreground" />
    );

  const trendLabel =
    market.trend === "alta" ? "Alta" : market.trend === "baixa" ? "Baixa" : "Lateral";

  const volColor =
    market.volatility === "alta"
      ? "text-danger"
      : market.volatility === "baixa"
        ? "text-success"
        : "text-warning";

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2.5">
        <CandlestickChart className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">MERCADO</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InfoBox label="Ativo" value={market.asset} />
        <InfoBox
          label="Timeframes"
          value={robotState?.config.timeframes?.join(", ") || market.timeframe || "M1"}
        />
        <div className="p-2 rounded-lg bg-secondary/30">
          <div className="text-[9px] text-muted-foreground">Tendência</div>
          <div className="flex items-center gap-1 mt-0.5">
            {trendIcon}
            <span className="text-[11px] font-bold">{trendLabel}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary/30">
          <div className="text-[9px] text-muted-foreground">Volatilidade</div>
          <div className={`text-[11px] font-bold mt-0.5 capitalize ${volColor}`}>
            {market.volatility}
          </div>
        </div>
        <InfoBox label="Força" value={`${market.strength}%`} />
        <InfoBox label="Score" value={String(market.score)} />
        <InfoBox label="Expiração" value={`${robotState?.config.expirationSeconds || 60}s`} />
        <InfoBox label="Confiança" value={`${confidence}%`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SCORE ENGINE BAR (vivo com bandas)
 * ═══════════════════════════════════════════════════════════════════════════ */
function ScoreEngineBar({
  score,
  bandInfo,
  scoreBreakdown,
}: {
  score: number;
  bandInfo: { label: string; color: string; barColor: string; band: ScoreBand };
  scoreBreakdown: ScoreBreakdownDisplay | null;
}) {
  const bandConfig = SCORE_BAND_CONFIG[bandInfo.band];

  return (
    <div className={`px-4 py-3 border-b border-border ${bandConfig.bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] tracking-widest text-muted-foreground">SCORE ENGINE</span>
        <div className="flex items-center gap-2">
          {scoreBreakdown?.strategy && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
              {scoreBreakdown.strategy}
            </span>
          )}
          <span className={`text-sm font-bold ${bandInfo.color} transition-all duration-300`}>
            {score}
          </span>
        </div>
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${bandInfo.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[10px] font-semibold ${bandInfo.color}`}>{bandInfo.label}</span>
        <span className="text-[9px] text-muted-foreground">
          0 ──── 40 ──── 60 ──── 70 ──── 85 ──── 100
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SCORE BREAKDOWN (pontos por filtro)
 * ═══════════════════════════════════════════════════════════════════════════ */
function ScoreBreakdownPanel({ scoreBreakdown }: { scoreBreakdown: ScoreBreakdownDisplay }) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2.5">
        <BarChart3 className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">
          PONTUAÇÃO POR FILTRO
        </span>
      </div>

      <div className="space-y-1.5">
        {scoreBreakdown.filters.map((filter) => (
          <ScoreFilterRow key={filter.name} filter={filter} />
        ))}
      </div>

      {/* Entry / Refusal Reason */}
      {scoreBreakdown.entryReason && (
        <div className="mt-3 p-2.5 rounded-lg bg-success/5 border border-success/10">
          <div className="text-[9px] tracking-widest text-success mb-1">MOTIVO DA ENTRADA</div>
          <div className="text-[10px] text-foreground">{scoreBreakdown.entryReason}</div>
        </div>
      )}

      {scoreBreakdown.refusalReason && (
        <div className="mt-3 p-2.5 rounded-lg bg-danger/5 border border-danger/10">
          <div className="text-[9px] tracking-widest text-danger mb-1">MOTIVO DA RECUSA</div>
          <div className="text-[10px] text-foreground">{scoreBreakdown.refusalReason}</div>
        </div>
      )}
    </div>
  );
}

function ScoreFilterRow({ filter }: { filter: ScoreFilterDisplay }) {
  const pct = filter.maxPoints > 0 ? (filter.points / filter.maxPoints) * 100 : 0;
  const isPositive = filter.points > 0;
  const isNegative = filter.points < 0;
  const barColor = isPositive ? "bg-success" : isNegative ? "bg-danger" : "bg-muted-foreground";

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-[110px] text-muted-foreground truncate">{filter.name}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span
        className={`w-[36px] text-right font-mono font-bold ${
          isPositive ? "text-success" : isNegative ? "text-danger" : "text-muted-foreground"
        }`}
      >
        {filter.points >= 0 ? "+" : ""}
        {filter.points}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. LEITURA DA VELA
 * ═══════════════════════════════════════════════════════════════════════════ */
function CandleReadingPanel({
  reading,
}: {
  reading: {
    isGreen: boolean | null;
    bodyPercent: number;
    wickTopPercent: number;
    wickBottomPercent: number;
    dominance: string;
    pressure: string;
    volumeAboveAverage: boolean;
    colorLabel: string;
    icon: string;
    progress: number;
    phase: string;
  };
}) {
  const progressWidth = Math.min(100, Math.max(0, reading.progress));

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Activity className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">LEITURA DA VELA</span>
      </div>

      {/* Candle Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{reading.icon}</span>
          <div>
            <div className="text-[11px] font-bold">{reading.colorLabel}</div>
            <div className="text-[9px] text-muted-foreground">{reading.phase}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">Progresso</div>
          <div className="text-[11px] font-bold font-mono">{progressWidth}%</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            reading.isGreen === true
              ? "bg-success"
              : reading.isGreen === false
                ? "bg-danger"
                : "bg-muted-foreground"
          }`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      {/* Candle Metrics */}
      {reading.bodyPercent > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <MiniInfo label="Corpo" value={`${reading.bodyPercent.toFixed(0)}%`} />
          <MiniInfo label="Pavio sup." value={`${reading.wickTopPercent.toFixed(0)}%`} />
          <MiniInfo label="Pavio inf." value={`${reading.wickBottomPercent.toFixed(0)}%`} />
          <MiniInfo label="Dominância" value={reading.dominance} />
          <MiniInfo label="Pressão" value={reading.pressure} />
          <MiniInfo
            label="Volume"
            value={reading.volumeAboveAverage ? "Acima da média" : "Na média"}
          />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. PENSAMENTO DA IA
 * ═══════════════════════════════════════════════════════════════════════════ */
function AIThinkingPanel({
  reasoning,
  status,
  nextAction,
}: {
  reasoning: { id: string; text: string; checked: boolean }[];
  status: AnalystAIState;
  nextAction: { text: string; condition?: string; result?: string } | null;
}) {
  const stateConfig = ANALYST_AI_STATE_CONFIG[status];

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Brain className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">PENSAMENTO DA IA</span>
      </div>

      {reasoning.length === 0 ? (
        <div className="p-3 rounded-lg bg-secondary/30 text-center">
          <span className="text-lg">{stateConfig.avatar}</span>
          <div className="text-[10px] text-muted-foreground mt-1">
            {status === "idle" ? "Aguardando robô iniciar..." : "Processando..."}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {reasoning.slice(0, 10).map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 text-[10px] py-1 transition-all duration-300 ${
                item.checked ? "opacity-100" : "opacity-50"
              }`}
            >
              {item.checked ? (
                <CheckCircle2 className="size-3.5 text-success shrink-0" />
              ) : (
                <Clock className="size-3.5 text-muted-foreground shrink-0 animate-pulse" />
              )}
              <span className={item.checked ? "text-foreground" : "text-muted-foreground"}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Próxima Ação */}
      {nextAction && (
        <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
          <div className="text-[9px] tracking-widest text-muted-foreground mb-1.5">
            PRÓXIMA AÇÃO
          </div>
          <div className="text-[11px] font-semibold text-foreground">{nextAction.text}</div>
          {nextAction.condition && (
            <div className="text-[10px] text-muted-foreground mt-1">↓ {nextAction.condition}</div>
          )}
          {nextAction.result && (
            <div className="text-[10px] text-success mt-1 font-semibold">→ {nextAction.result}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. DIÁRIO DO TRADER
 * ═══════════════════════════════════════════════════════════════════════════ */
function DiaryPanel({
  diary,
}: {
  diary: { id: string; timestamp: Date; text: string; icon: string; level: string }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [diary.length]);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <BookOpen className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">DIÁRIO DO TRADER</span>
      </div>

      <div ref={containerRef} className="max-h-[220px] overflow-y-auto space-y-0">
        {diary.length === 0 ? (
          <div className="py-4 text-center">
            <div className="text-[10px] text-muted-foreground">Aguardando eventos...</div>
          </div>
        ) : (
          diary.slice(0, 50).map((entry) => {
            const time = entry.timestamp.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const levelDot =
              entry.level === "success"
                ? "bg-success"
                : entry.level === "error"
                  ? "bg-danger"
                  : entry.level === "warning"
                    ? "bg-warning"
                    : "bg-primary";
            return (
              <div key={entry.id} className="flex items-start gap-2 py-1.5">
                <span className={`size-1.5 rounded-full mt-1.5 shrink-0 ${levelDot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground/60">{time}</span>
                    <span className="text-xs">{entry.icon}</span>
                  </div>
                  <div className="text-[10px] leading-relaxed text-foreground/80">{entry.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. SCAN LOG (Multi-Asset)
 * ═══════════════════════════════════════════════════════════════════════════ */
function ScanLogPanel({ scanLog }: { scanLog: ScanLogEntry[] }) {
  const passed = scanLog.filter((e) => !e.blocked);
  const blocked = scanLog.filter((e) => e.blocked);
  const bestScore = passed.length > 0 ? Math.max(...passed.map((e) => e.score)) : 0;

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">CATÁLOGO AO VIVO</span>
        <span className="text-[8px] ml-auto text-muted-foreground">{scanLog.length} ativos</span>
      </div>

      {/* Summary badges */}
      <div className="flex gap-1.5 mb-2">
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-success/10 text-success border border-success/20">
          {passed.length} SINAL
        </span>
        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-danger/10 text-danger border border-danger/20">
          {blocked.length} BLOQUEADO
        </span>
        {bestScore > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary border border-primary/20">
            MELHOR: {bestScore}/100
          </span>
        )}
      </div>

      {/* Scan entries */}
      <div className="space-y-1 max-h-[120px] overflow-y-auto">
        {scanLog.map((entry, i) => {
          const trendIcon =
            entry.trend === "alta" ? (
              <TrendingUp className="size-2.5 text-success" />
            ) : entry.trend === "baixa" ? (
              <TrendingDown className="size-2.5 text-danger" />
            ) : (
              <Minus className="size-2.5 text-muted-foreground" />
            );

          const scoreColor =
            entry.score >= 80
              ? "text-success"
              : entry.score >= 60
                ? "text-warning"
                : entry.score > 0
                  ? "text-warning"
                  : "text-muted-foreground";

          const statusBg = entry.blocked
            ? "bg-danger/5 border-danger/10"
            : entry.score === bestScore
              ? "bg-success/10 border-success/20"
              : "bg-success/5 border-success/10";

          return (
            <div key={entry.traceId} className={`p-1.5 rounded border ${statusBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {trendIcon}
                  <span className="text-[9px] font-mono font-bold">
                    {entry.asset.replace("USDT", "")}
                  </span>
                  {entry.direction && (
                    <span
                      className={`text-[7px] font-bold px-1 rounded ${
                        entry.direction === "call"
                          ? "bg-success/20 text-success"
                          : "bg-danger/20 text-danger"
                      }`}
                    >
                      {entry.direction.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-mono font-bold ${scoreColor}`}>
                  {entry.score > 0 ? `${entry.score}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {entry.pattern && (
                  <span className="text-[7px] text-muted-foreground">{entry.pattern}</span>
                )}
                <span className="text-[7px] ml-auto text-muted-foreground/60 truncate max-w-[100px]">
                  {entry.reason}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */
function InfoBox({
  label,
  value,
  mono,
  green,
  red,
}: {
  label: string;
  value: string;
  mono?: boolean;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="p-2 rounded-lg bg-secondary/30">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div
        className={`text-[11px] font-bold mt-0.5 ${
          mono ? "font-mono" : ""
        } ${green ? "text-success" : red ? "text-danger" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-1.5 rounded bg-secondary/30">
      <div className="text-[8px] text-muted-foreground">{label}</div>
      <div className="text-[10px] font-bold capitalize">{value}</div>
    </div>
  );
}

function DecisionContextPanelInline({ context }: { context: import("../flow-continuity/types/decision-context.types").DecisionContext }) {
  const DECISION_COLORS: Record<string, string> = {
    CALL: "text-success",
    PUT: "text-danger",
    WAIT: "text-warning",
    REJECT: "text-muted-foreground",
  };
  const DECISION_BG: Record<string, string> = {
    CALL: "bg-success/10",
    PUT: "bg-danger/10",
    WAIT: "bg-warning/10",
    REJECT: "bg-zinc-500/10",
  };
  const confPct = Math.round(context.confidence * 100);
  const confLabel = confPct >= 80 ? "High" : confPct >= 50 ? "Medium" : "Low";
  const confColor = confPct >= 80 ? "text-success" : confPct >= 50 ? "text-warning" : "text-muted-foreground";

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-2">DECISION CONTEXT</div>
      <div className={`rounded p-2 mb-2 ${DECISION_BG[context.decision]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${DECISION_COLORS[context.decision]}`}>{context.decision}</span>
          <span className="text-[10px] text-muted-foreground">Score {context.finalScore}/{context.minimumScore}</span>
        </div>
        <div className="text-[10px] text-foreground/70 mt-1">{context.decisionReason}</div>
      </div>
      <div className="flex items-center justify-between text-[10px] mb-2">
        <span className="text-muted-foreground">Confidence</span>
        <span className={confColor}>{confLabel} ({confPct}%)</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <div className="bg-secondary/40 rounded p-1 text-center">
          <div className="text-[8px] text-muted-foreground">TREND</div>
          <div className="text-[10px] font-medium">{context.trend}</div>
        </div>
        <div className="bg-secondary/40 rounded p-1 text-center">
          <div className="text-[8px] text-muted-foreground">VOL</div>
          <div className="text-[10px] font-medium">{context.volatility}</div>
        </div>
        <div className="bg-secondary/40 rounded p-1 text-center">
          <div className="text-[8px] text-muted-foreground">BIAS</div>
          <div className="text-[10px] font-medium">{context.bias}</div>
        </div>
      </div>
      {context.approvedFilters.length > 0 && (
        <div className="bg-success/5 rounded p-1.5 mb-1">
          <div className="text-[9px] text-success font-semibold mb-0.5">APPROVED ({context.approvedFilters.length})</div>
          {context.approvedFilters.map((f) => (
            <div key={f.id} className="text-[9px] text-foreground/70">
              {f.name}: <span className="text-success">{f.contribution}/{f.weight}</span>
            </div>
          ))}
        </div>
      )}
      {context.rejectedFilters.length > 0 && (
        <div className="bg-danger/5 rounded p-1.5 mb-1">
          <div className="text-[9px] text-danger font-semibold mb-0.5">REJECTED ({context.rejectedFilters.length})</div>
          {context.rejectedFilters.map((f) => (
            <div key={f.id} className="text-[9px] text-foreground/70">
              {f.name}: <span className="text-danger">{f.contribution}/{f.weight}</span>
            </div>
          ))}
        </div>
      )}
      <div className="bg-secondary/40 rounded p-1.5 text-[10px]">
        <span className="text-muted-foreground">TRIGGER: </span>
        <span className="font-medium">{context.executionTrigger}</span>
      </div>
    </div>
  );
}

function OperationContextPanelInline({ context }: { context: import("../flow-continuity/types/operation-context.types").OperationContext }) {
  const STATUS_COLORS: Record<string, string> = {
    WIN: "text-success",
    LOSS: "text-danger",
    DRAW: "text-warning",
    CANCELLED: "text-muted-foreground",
    PENDING: "text-info",
    OPEN: "text-info",
  };
  const STATUS_BG: Record<string, string> = {
    WIN: "bg-success/10",
    LOSS: "bg-danger/10",
    DRAW: "bg-warning/10",
    CANCELLED: "bg-zinc-500/10",
    PENDING: "bg-info/10",
    OPEN: "bg-info/10",
  };
  const profitColor = context.profit > 0 ? "text-success" : context.profit < 0 ? "text-danger" : "text-muted-foreground";
  const profitSign = context.profit > 0 ? "+" : "";

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-2">LAST OPERATION</div>
      <div className={`rounded p-2 mb-2 ${STATUS_BG[context.status]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${STATUS_COLORS[context.status]}`}>{context.status}</span>
          <span className="text-[10px] text-muted-foreground">{context.direction} {context.asset}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entry</span>
            <span className="font-medium">{context.entryPrice.toFixed(5)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exit</span>
            <span className="font-medium">{context.exitPrice > 0 ? context.exitPrice.toFixed(5) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">R$ {context.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Profit</span>
            <span className={`font-bold ${profitColor}`}>{profitSign}{context.profit.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">{context.expiration}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Latency</span>
            <span className="font-medium">{context.executionLatency}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">{context.score}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <span className="font-medium">{context.executionSource}</span>
          </div>
        </div>
      </div>
      <div className="bg-secondary/40 rounded p-1.5 text-[10px]">
        <span className="text-muted-foreground">REASON: </span>
        <span className="font-medium">{context.executionReason}</span>
      </div>
    </div>
  );
}

function ReplayTimelinePanelInline({ context }: { context: import("../flow-continuity/types/replay-context.types").ReplayContext }) {
  const RESULT_COLORS: Record<string, string> = {
    WIN: "text-success",
    LOSS: "text-danger",
    BREAKEVEN: "text-warning",
    TIMEOUT: "text-muted-foreground",
  };
  const RESULT_BG: Record<string, string> = {
    WIN: "bg-success/10",
    LOSS: "bg-danger/10",
    BREAKEVEN: "bg-warning/10",
    TIMEOUT: "bg-zinc-500/10",
  };
  const profitColor = context.profit > 0 ? "text-success" : context.profit < 0 ? "text-danger" : "text-muted-foreground";
  const profitSign = context.profit > 0 ? "+" : "";
  const durationSec = (context.durationMs / 1000).toFixed(0);
  const timeStr = new Date(context.operationStartTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const STEP_ICONS: Record<string, string> = {
    "market.classified": "📊",
    "strategy.selected": "⚙️",
    "score.calculated": "🎯",
    "filters.approved": "✅",
    "decision.made": "⚖️",
    "order.sent": "📤",
    "broker.confirmed": "🏦",
    "trade.opened": "📈",
    "trade.closed": "🏁",
  };

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-2">REPLAY TIMELINE</div>
      <div className={`rounded p-2 mb-2 ${RESULT_BG[context.result]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${RESULT_COLORS[context.result]}`}>{context.result}</span>
          <span className="text-[10px] text-muted-foreground">{timeStr} — {durationSec}s</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ativo</span>
            <span className="font-medium">{context.decisionContext.asset}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Score</span>
            <span className="font-medium">{context.operationContext.score}/100</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estratégia</span>
            <span className="font-medium">{context.decisionContext.strategyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lucro</span>
            <span className={`font-bold ${profitColor}`}>{profitSign}R$ {context.profit.toFixed(2)}</span>
          </div>
        </div>
      </div>
      {/* Timeline */}
      <div className="space-y-0">
        {context.timeline.map((event, i) => {
          const isLast = i === context.timeline.length - 1;
          return (
            <div key={event.stepIndex} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <span className="text-xs">{STEP_ICONS[event.step] || "📌"}</span>
                {!isLast && <div className="w-px h-4 bg-border" />}
              </div>
              <div className={`pb-1.5 ${isLast ? "" : "border-b border-border/50"} flex-1`}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold text-foreground/80">{event.label}</span>
                  <span className="text-[8px] text-muted-foreground/60 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SEVERITY_CONFIG_INSIGHTS: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  SUCCESS: { icon: <CheckCircle2 className="size-3 text-success" />, color: "text-success", bg: "bg-success/5" },
  INFO: { icon: <Brain className="size-3 text-info" />, color: "text-info", bg: "bg-info/5" },
  WARNING: { icon: <AlertTriangle className="size-3 text-warning" />, color: "text-warning", bg: "bg-warning/5" },
  DANGER: { icon: <AlertTriangle className="size-3 text-danger" />, color: "text-danger", bg: "bg-danger/5" },
};

function PerformanceInsightsInline({ context }: { context: PerformanceContext }) {
  const health = context.robotHealth;

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="size-3 text-muted-foreground" />
        <span className="text-[9px] tracking-widest text-muted-foreground">PERFORMANCE INSIGHTS</span>
      </div>

      {/* Robot Health Score Mini */}
      <div className={`p-2 rounded-lg mb-2 ${health.score >= 60 ? "bg-success/5 border border-success/20" : health.score >= 40 ? "bg-warning/5 border border-warning/20" : "bg-danger/5 border border-danger/20"}`}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold text-muted-foreground">SAÚDE DO ROBÔ</span>
          <span className={`text-sm font-extrabold ${health.color}`}>{health.score}/100</span>
        </div>
        <div className="text-[9px] mt-0.5">{health.label}</div>
      </div>

      {/* Top Insights */}
      <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
        {context.insights.length === 0 ? (
          <div className="text-[10px] text-muted-foreground text-center py-2">
            Aguardando dados...
          </div>
        ) : (
          context.insights.slice(0, 6).map((insight) => {
            const config = SEVERITY_CONFIG_INSIGHTS[insight.severity] || SEVERITY_CONFIG_INSIGHTS.INFO;
            return (
              <div key={insight.id} className={`flex items-start gap-1.5 p-1.5 rounded ${config.bg}`}>
                {config.icon}
                <div className="flex-1 min-w-0">
                  <div className={`text-[9px] font-bold ${config.color}`}>{insight.title}</div>
                  <div className="text-[8px] text-foreground/60 truncate">{insight.description}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
