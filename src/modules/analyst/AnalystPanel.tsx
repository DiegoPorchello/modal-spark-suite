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
      color: "text-orange-500",
      barColor: "bg-orange-500",
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
    if (voiceEnabled && voiceRef.current && diary.length > prevDiaryLenRef.current) {
      const newEntry = diary[0];
      if (newEntry) {
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
        <InfoBox label="Ativo" value={robotState?.config.asset || market.asset} />
        <InfoBox label="Timeframes" value={robotState?.config.timeframes?.join(", ") || market.timeframe || "M1"} />
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
        <span className="text-[8px] ml-auto text-muted-foreground">
          {scanLog.length} ativos
        </span>
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
                  ? "text-orange-500"
                  : "text-muted-foreground";

          const statusBg = entry.blocked
            ? "bg-danger/5 border-danger/10"
            : entry.score === bestScore
              ? "bg-success/10 border-success/20"
              : "bg-success/5 border-success/10";

          return (
            <div
              key={`${entry.asset}-${i}`}
              className={`p-1.5 rounded border ${statusBg}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {trendIcon}
                  <span className="text-[9px] font-mono font-bold">{entry.asset.replace("USDT", "")}</span>
                  {entry.direction && (
                    <span className={`text-[7px] font-bold px-1 rounded ${
                      entry.direction === "call" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                    }`}>
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
