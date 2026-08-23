import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback, useMemo, type ComponentType } from "react";
import { useBroker } from "../hooks/useBroker";
import { useRobot } from "../hooks/useRobot";
import { useAnalystStore } from "../modules/analyst/AnalystStore";
import { AnalystPanel } from "../modules/analyst/AnalystPanel";
import { analystBus } from "../modules/analyst/EventBus";
import { ActiveStrategyCard } from "../modules/flow-continuity/components/ActiveStrategyCard";
import { MarketContextCard } from "../modules/flow-continuity/components/MarketContextCard";
import { ReplayCard } from "../modules/flow-continuity/components/ReplayCard";
import { ReplayDrawer } from "../modules/flow-continuity/components/ReplayDrawer";
import { strategyManager } from "../services/strategy-manager";
import { AssetsAdvancedConfigPanel } from "../components/AssetsAdvancedConfigPanel";
import { PerformanceIntelligencePanel } from "../modules/performance/components/PerformanceIntelligencePanel";
import {
  IntelligenceSection,
  ADVISOR_TONE,
} from "../modules/advisor/components/IntelligenceSection";
import { buildAdvisorContext } from "../modules/advisor/services";
import { advisorHistory } from "../modules/advisor/services/advisor-history";
import { MarketProfileCard } from "../modules/market/components";
import { OperationalProfileSelector } from "../components/operational-profile-selector/OperationalProfileSelector";
import { HybridProbabilityPanel } from "../components/hybrid-probability/HybridProbabilityPanel";

import { LiveIntelligencePanel } from "../modules/live-intelligence/LiveIntelligencePanel";
import { loadCore } from "../modules/market/cores";
import { StrategyLifecycleCard } from "../modules/lifecycle/components/StrategyLifecycleCard";
import { StrategyTimeline } from "../modules/lifecycle/components/StrategyTimeline";
import { getGlobalLifecycleEngine } from "../modules/lifecycle";
import type { StrategyLifecycleInstance } from "../modules/lifecycle/types/strategy-lifecycle.types";
import { LearningInsightsCard } from "../modules/learning/components/LearningInsightsCard";
import { getGlobalLearningEngine } from "../modules/learning";
import { getGlobalMemoryEngine } from "../modules/market-memory";
import type { LearningContext } from "../modules/learning/types/learning-types";
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  BookOpen,
  Trophy,
  History,
  Calculator,
  FlaskConical,
  Plug,
  Settings,
  HelpCircle,
  Menu,
  Bell,
  Maximize2,
  Minimize2,
  Minus,
  User,
  Check,
  Circle,
  Coins,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  X,
  Moon,
  Sun,
  Palette,
  Power,
  Volume2,
  VolumeX,
  Wallet,
  Clock,
  Save,
  Loader2,
  Shield,
  Zap,
  ListFilter,
  XCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Brain,
  HeartPulse,
  Copy,
} from "lucide-react";
import { CriticalErrorModal } from "../components/ui/CriticalErrorModal";
import { CopyTradeModal } from "../components/copy-trader/CopyTradeModal";
import { PumaBrokerModal } from "../components/puma-broker/PumaBrokerModal";
import { MetricCard } from "../components/ui/MetricCard";
import { ModuleStatus } from "../components/ui/ModuleStatus";
import { TabNav, type TabDef } from "../components/ui/TabNav";
import { PanelCard } from "../components/ui/PanelCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import type {
  RobotEvent,
  RobotOperation,
  RobotStatus,
  RobotConfig,
  RobotState,
} from "../engine/flow-robot-engine";
import type { MarketProfile } from "../modules/market/types/market-profile.types";
import { getBestEntryPerAsset } from "../ranking";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexor AI · Fluxo de Continuidade Pro" },
      { name: "description", content: "Painel de operações automatizadas Nexor AI." },
    ],
  }),
  component: Dashboard,
});

type NavKey =
  | "dashboard"
  | "mercado"
  | "fluxo"
  | "config-ativos"
  | "padroes"
  | "ativos"
  | "historico"
  | "copytrade"
  | "calc"
  | "backtest"
  | "puma"
  | "config"
  | "ajuda";

type NavIcon = React.ComponentType<{ className?: string }>;

const NAV: { section: string; items: { key: NavKey; label: string; icon: NavIcon }[] }[] = [
  {
    section: "PAINEL PRINCIPAL",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  { section: "MERCADO", items: [{ key: "mercado", label: "Visão de Mercado", icon: TrendingUp }] },
  {
    section: "FLUXO DE CONTINUIDADE PRO",
    items: [
      { key: "fluxo", label: "Análise do Robô", icon: Activity },
      { key: "config-ativos", label: "Configuração de Ativos", icon: ListFilter },
    ],
  },
  { section: "CATÁLOGO", items: [{ key: "padroes", label: "Padrões", icon: BookOpen }] },
  { section: "RANKING", items: [{ key: "ativos", label: "Ativos", icon: Trophy }] },
  { section: "OPERAÇÕES", items: [{ key: "historico", label: "Histórico", icon: History }, { key: "copytrade", label: "Copy Trade", icon: Copy }] },
  {
    section: "GERENCIAMENTO",
    items: [{ key: "calc", label: "Calculadora Sorosgale", icon: Calculator }],
  },
  { section: "BACKTEST", items: [{ key: "backtest", label: "Simulador", icon: FlaskConical }] },
  { section: "INTEGRAÇÕES", items: [{ key: "puma", label: "Puma Broker", icon: Plug }] },
  { section: "CONFIGURAÇÕES", items: [{ key: "config", label: "Configurações", icon: Settings }] },
  { section: "AJUDA", items: [{ key: "ajuda", label: "Suporte", icon: HelpCircle }] },
];

const ASSET_FLAG_MAP: Record<string, string> = {
  EURUSD: "🇪🇺",
  GBPUSD: "🇬🇧",
  USDJPY: "🇯🇵",
  AUDUSD: "🇦🇺",
  USDCAD: "🇨🇦",
  NZDUSD: "🇳🇿",
  USDCHF: "🇨🇭",
  EURGBP: "🇪🇺",
  BTCUSD: "₿",
  ETHUSD: "Ξ",
  XAUUSD: "🥇",
  BETHUSDT: "Ξ",
  BTSOLUSDT: "◎",
  MAPEUSDT: "🟡",
  XRDOGUSDT: "🐕",
  XRPSOLUSDT: "✕",
};

function getAssetFlag(asset: string): string {
  const upper = asset.toUpperCase().replace("/OTC", "").replace("/", "");
  return ASSET_FLAG_MAP[upper] ?? "💱";
}

function getAssetDisplayName(asset: string): string {
  const upper = asset.toUpperCase().replace("/OTC", "");
  if (upper.length === 6 && !upper.includes("USD") && !upper.includes("USDT")) {
    return `${upper.slice(0, 3)}/${upper.slice(3)}`;
  }
  return asset.replace("USD", "/USD").replace("USDT", "/USDT");
}

function Dashboard() {
  const [active, setActive] = useState<NavKey>("fluxo");
  const [timeframes, setTimeframes] = useState<("M1" | "M5" | "M15")[]>(["M1"]);
  const [now, setNow] = useState<Date>(new Date());
  const [seconds, setSeconds] = useState<number>(0);
  const [chartTab, setChartTab] = useState<"grafico" | "estrutura">("grafico");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [currentPayout, setCurrentPayout] = useState<number>(0);
  const [replayDrawerOpen, setReplayDrawerOpen] = useState(false);
  const [selectedReplay, setSelectedReplay] = useState<
    import("../modules/flow-continuity/types/replay-context.types").ReplayContext | null
  >(null);
  const [copyTradeOpen, setCopyTradeOpen] = useState(false);
  const [pumaBrokerOpen, setPumaBrokerOpen] = useState(false);
  const [assetConfigModalOpen, setAssetConfigModalOpen] = useState(false);
  const {
    connected,
    userName,
    credentials,
    adapter,
    triggerCriticalAuthError,
    clearCriticalAuthError,
    criticalAuthError,
  } = useBroker();
  const { stop } = useRobot();
  const store = useAnalystStore();
  const { state: robotState, engine, updateConfig } = useRobot();

  // ── Build AdvisorContext from PerformanceContext ──
  const advisorContext = useMemo(
    () => buildAdvisorContext(store.performanceContext),
    [store.performanceContext],
  );

  // ── Build MarketProfile from config ──
  const marketProfile = useMemo(() => {
    const mode = robotState.config.marketMode ?? "AUTO";
    const asset = robotState.config.asset;
    const result = loadCore(mode, asset);
    const ts = new Date().toLocaleTimeString("pt-BR");
    console.log(`[Dashboard] ${ts} 📦 useMemo marketProfile — mode: ${mode}, asset: ${asset}`);
    console.log(`[Dashboard] ${ts} 📦 loadCore returned:`, {
      detectedMarket: result.profile.detectedMarket,
      activeCore: result.profile.activeCore,
      activeProfileName: result.profile.activeProfileName,
      activeStrategyName: result.profile.activeStrategyName,
      confidence: result.profile.confidence,
    });
    return result.profile;
  }, [robotState.config.marketMode, robotState.config.asset]);

  // ── Strategy Lifecycle state ──
  const lifecycleEngine = useMemo(() => getGlobalLifecycleEngine(), []);
  const [activeLifecycle, setActiveLifecycle] = useState<StrategyLifecycleInstance | null>(null);
  const [lifecycleUpdate, setLifecycleUpdate] = useState(0);

  // Subscribe to lifecycle events
  useEffect(() => {
    const unsub = lifecycleEngine.getEventBus().subscribe((event) => {
      if (event.type === "strategy.state.changed") {
        const all = lifecycleEngine.getActive();
        setActiveLifecycle(all.length > 0 ? all[all.length - 1] : null);
        setLifecycleUpdate((c) => c + 1);
      }
      if (event.type === "strategy.timeline.updated") {
        const all = lifecycleEngine.getActive();
        setActiveLifecycle(all.length > 0 ? all[all.length - 1] : null);
      }
    });
    return unsub;
  }, [lifecycleEngine]);

  // ── Learning Engine state ──
  const learningEngine = useMemo(() => getGlobalLearningEngine(), []);
  const memoryEngine = useMemo(() => getGlobalMemoryEngine(), []);
  const [learningContext, setLearningContext] = useState<LearningContext | null>(null);

  // Run learning analysis when memory records change
  useEffect(() => {
    const unsub = memoryEngine.subscribe(() => {
      const records = memoryEngine.getAll();
      if (records.length > 0) {
        const ctx = learningEngine.buildContext(records);
        setLearningContext(ctx);
      }
    });
    return unsub;
  }, [memoryEngine, learningEngine]);

  // ── Record advisor context to history and emit event ──
  useEffect(() => {
    if (advisorContext) {
      advisorHistory.record(advisorContext);
      analystBus.emit("advisor.context", advisorContext as unknown as Record<string, unknown>);
    }
  }, [advisorContext]);

  // ── Emit market profile changes ──
  useEffect(() => {
    if (marketProfile) {
      const ts = new Date().toLocaleTimeString("pt-BR");
      console.log(`[Dashboard] ${ts} 📡 Emitindo market.profile.changed:`, {
        detectedMarket: marketProfile.detectedMarket,
        activeCore: marketProfile.activeCore,
        activeProfileName: marketProfile.activeProfileName,
        mode: marketProfile.mode,
      });
      analystBus.emit(
        "market.profile.changed",
        marketProfile as unknown as Record<string, unknown>,
      );
    }
  }, [marketProfile]);

  const handleOpenReplay = useCallback(
    (ctx: import("../modules/flow-continuity/types/replay-context.types").ReplayContext) => {
      setSelectedReplay(ctx);
      setReplayDrawerOpen(true);
    },
    [],
  );

  useEffect(() => {
    return () => console.log("[UNMOUNT] Dashboard");
  }, []);

  // ── Wire analystBus events to the store ──
  useEffect(() => {
    const unsub = analystBus.subscribe((type, meta) => {
      switch (type) {
        case "decision.context":
          store.setDecisionContext(
            meta as unknown as import("../modules/flow-continuity/types/decision-context.types").DecisionContext,
          );
          break;
        case "operation.context":
          store.setOperationContext(
            meta as unknown as import("../modules/flow-continuity/types/operation-context.types").OperationContext,
          );
          break;
        case "replay.context":
          store.setReplayContext(
            meta as unknown as import("../modules/flow-continuity/types/replay-context.types").ReplayContext,
          );
          break;
        case "performance.context":
          store.setPerformanceContext(
            meta as unknown as import("../modules/performance/types/performance-context.types").PerformanceContext,
          );
          break;
        case "advisor.context":
          store.setAdvisorContext(
            meta as unknown as import("../modules/advisor/types/advisor-context.types").AdvisorContext,
          );
          break;
        case "score.breakdown":
          store.setScoreBreakdown(
            meta as unknown as import("../modules/analyst/AnalystTypes").ScoreBreakdownDisplay,
          );
          break;
        case "system.info": {
          const m = meta as Record<string, unknown>;
          if (m.aiState)
            store.setStatus(m.aiState as import("../modules/analyst/AnalystTypes").AnalystAIState);
          if (m.reasoning)
            store.setReasoning(
              m.reasoning as import("../modules/analyst/AnalystTypes").AnalystReasoningItem[],
            );
          if (m.confidence !== undefined) store.setConfidence(Number(m.confidence));
          if (m.score !== undefined) store.setScore(Number(m.score));
          if (m.nextAction)
            store.setNextAction(
              m.nextAction as import("../modules/analyst/AnalystTypes").AnalystNextAction,
            );
          if (m.stats)
            store.updateStats(
              m.stats as Partial<import("../modules/analyst/AnalystTypes").AnalystStats>,
            );
          if (m.diagnostic) {
            const d = m.diagnostic as { step: string; status: string; message: string };
            store.updateDiagnostic(
              d.step as import("../modules/analyst/AnalystTypes").DiagnosticStep,
              d.status as import("../modules/analyst/AnalystTypes").DiagnosticStatus,
              d.message,
            );
          }
          break;
        }
        case "market.update": {
          const m = meta as Record<string, unknown>;
          store.updateMarket(m as Partial<import("../modules/analyst/AnalystTypes").MarketInfo>);
          break;
        }
        case "buffer.asset.update": {
          const m = meta as Record<string, unknown>;
          const asset = m.asset as string;
          if (asset) {
            store.setBufferAssets((prev) => ({
              ...prev,
              [asset]: {
                asset,
                current: m.current as number,
                capacity: m.capacity as number,
                minimum: m.minimum as number,
                percent: m.percent as number,
                lastCandleTime: m.lastCandleTime as number,
                secondsWithoutCandles: m.secondsWithoutCandles as number,
                isReceiving: m.isReceiving as boolean,
                bufferHealth: m.bufferHealth as "live" | "waiting" | "stale",
                bufferStatus: m.bufferStatus as string,
              },
            }));
          }
          break;
        }
        case "candle.reading": {
          const m = meta as Record<string, unknown>;
          store.updateCandleReading(
            m as Partial<import("../modules/analyst/AnalystTypes").CandleReading>,
          );
          break;
        }
        case "diary.entry": {
          const m = meta as Record<string, unknown>;
          store.addDiaryEntry(
            String(m.text || ""),
            String(m.icon || "📝"),
            (m.level as import("../modules/analyst/AnalystTypes").AnalystMessageLevel) || "info",
          );
          break;
        }
        case "scanLog.update": {
          const m = meta as Record<string, unknown>;
          store.setScanLog(m.scanLog as import("../modules/analyst/AnalystTypes").ScanLogEntry[]);
          break;
        }
        default:
          store.addMessage(type, meta);
          break;
      }
    });
    return unsub;
  }, [store]);

  // ── Sync: state local de timeframes com o config do engine ──
  useEffect(() => {
    const engineTF = robotState.config.timeframes;
    if (engineTF && engineTF.length > 0) {
      setTimeframes(engineTF as ("M1" | "M5" | "M15")[]);
    }
  }, [robotState.config.timeframes]);

  // Notification system - real events from robot
  const [notifications, setNotifications] = useState<
    Array<{
      id: number;
      type: "success" | "error" | "warning" | "info";
      message: string;
      time: Date;
    }>
  >([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("app-font-family") || "system";
    }
    return "system";
  });
  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("app-accent-color") || "emerald";
    }
    return "emerald";
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Subscribe to robot events for real notifications
  useEffect(() => {
    if (!engine) return;

    const handleEvent = (event: RobotEvent) => {
      const timestamp = new Date();
      let notification: {
        id: number;
        type: "success" | "error" | "warning" | "info";
        message: string;
        time: Date;
      } | null = null;

      switch (event.type) {
        case "operation-closed": {
          if (event.operation) {
            const res = event.operation.result;
            const isWin = res === "win";
            const isDraw = res === "draw";
            const label = isWin ? "WIN" : isDraw ? "DRAW" : "LOSS";
            const notifType = isWin ? "success" : isDraw ? "info" : "error";
            notification = {
              id: Date.now(),
              type: notifType,
              message: `${label} - ${event.operation.asset} ${event.operation.direction.toUpperCase()} R$ ${Math.abs(event.operation.profit).toFixed(2)}`,
              time: timestamp,
            };
          }
          break;
        }
        case "status-changed": {
          const status = event.state?.status as RobotStatus | undefined;
          if (status) {
            const statusLabels: Record<string, string> = {
              running: "Robô INICIADO",
              stopped: "Robô PARADO",
              paused: "Robô PAUSADO",
              error: "ERRO no robô",
              idle: "Robô ocioso",
              "waiting-result": "Aguardando resultado...",
            };
            notification = {
              id: Date.now(),
              type: status === "error" ? "error" : status === "running" ? "success" : "info",
              message: statusLabels[status] || `Status: ${status}`,
              time: timestamp,
            };
          }
          break;
        }
        case "error": {
          notification = {
            id: Date.now(),
            type: "error",
            message: event.message || "Erro no robô",
            time: timestamp,
          };
          break;
        }
        case "stopped-by-risk": {
          notification = {
            id: Date.now(),
            type: "warning",
            message: event.message || "Parado por gestão de risco",
            time: timestamp,
          };
          break;
        }
        case "operation-opened": {
          if (event.operation) {
            notification = {
              id: Date.now(),
              type: "info",
              message: `Ordem enviada: ${event.operation.asset} ${event.operation.direction.toUpperCase()} R$ ${event.operation.amount.toFixed(2)}`,
              time: timestamp,
            };
          }
          break;
        }
      }

      if (notification) {
        setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
      }
    };

    const unsub = engine.on(handleEvent);
    return () => unsub();
  }, [engine]);

  // Apply theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("app-dark-mode", String(isDarkMode));
  }, [isDarkMode]);

  // Apply font family
  useEffect(() => {
    const fontMap: Record<string, string> = {
      system: "system-ui, -apple-system, sans-serif",
      inter: "'Inter', system-ui, sans-serif",
      roboto: "'Roboto', system-ui, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    };
    document.documentElement.style.setProperty(
      "--font-family",
      fontMap[fontFamily] || fontMap.system,
    );
    localStorage.setItem("app-font-family", fontFamily);
  }, [fontFamily]);

  // Apply accent color
  useEffect(() => {
    const colorMap: Record<string, { primary: string; primaryForeground: string }> = {
      emerald: { primary: "#10b981", primaryForeground: "#ffffff" },
      blue: { primary: "#3b82f6", primaryForeground: "#ffffff" },
      purple: { primary: "#8b5cf6", primaryForeground: "#ffffff" },
      orange: { primary: "#f97316", primaryForeground: "#ffffff" },
      red: { primary: "#ef4444", primaryForeground: "#ffffff" },
      pink: { primary: "#ec4899", primaryForeground: "#ffffff" },
    };
    const colors = colorMap[accentColor] || colorMap.emerald;
    document.documentElement.style.setProperty("--primary", colors.primary);
    document.documentElement.style.setProperty("--primary-foreground", colors.primaryForeground);
    localStorage.setItem("app-accent-color", accentColor);
  }, [accentColor]);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedDark = localStorage.getItem("app-dark-mode");
    if (savedDark !== null) {
      setIsDarkMode(savedDark === "true");
    }
  }, []);

  // Set up critical auth error handler on adapter
  useEffect(() => {
    if (!adapter) return;
    adapter.setCriticalAuthErrorHandler((error) => {
      // Stop the robot immediately when critical auth error occurs
      stop();
      // Trigger the critical error in broker context (shows modal)
      triggerCriticalAuthError(error);
    });
    return () => {
      adapter.setCriticalAuthErrorHandler(null);
    };
  }, [adapter, stop, triggerCriticalAuthError]);

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await clearCriticalAuthError();
      // The user needs to manually login - we just clear the error state
      // The login button is in the sidebar
    } finally {
      setIsRetrying(false);
    }
  };

  // Fullscreen handler
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setSeconds((s) => (s > 0 ? s - 1 : 60));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch real payout from broker
  useEffect(() => {
    if (!adapter || !connected) return;
    const fetchPayout = async () => {
      try {
        const asset = robotState.config.asset || robotState.config.assets?.[0] || "EURUSD";
        const payout = await adapter.getPayout(asset);
        setCurrentPayout(Math.round(payout * 100));
      } catch {
        setCurrentPayout(0);
      }
    };
    fetchPayout();
    const interval = setInterval(fetchPayout, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, connected, robotState.config.asset]);

  const unreadCount = notifications.length;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Critical Auth Error Modal - renders at root level to ensure visibility */}
      <CriticalErrorModal
        error={criticalAuthError}
        onClose={clearCriticalAuthError}
        onRetry={async () => {
          clearCriticalAuthError();
        }}
      />
      {/* Copy Trade Modal */}
      <CopyTradeModal open={copyTradeOpen} onClose={() => setCopyTradeOpen(false)} />
      <PumaBrokerModal open={pumaBrokerOpen} onClose={() => setPumaBrokerOpen(false)} />
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="size-9 rounded-lg bg-success/15 border border-success/40 flex items-center justify-center glow-success">
            <Activity className="size-5 text-success" />
          </div>
          <div>
            <div className="font-semibold tracking-wide text-success">ORION</div>
            <div className="text-[10px] text-muted-foreground tracking-widest">
              FLUXO DE CONTINUIDADE PRO
            </div>
          </div>
        </div>
        <div className="px-3 py-3 border-b border-border">
          <BrokerCard />
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((g) => (
            <div key={g.section} className="px-3 mb-3">
              <div className="text-[10px] font-semibold text-muted-foreground tracking-widest px-3 py-2 flex items-center gap-2">
                <Circle className="size-1.5 fill-current" />
                {g.section}
              </div>
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.key;
                const isCopyTrade = it.key === "copytrade";
                const isPuma = it.key === "puma";
      return (
          <button
            key={it.key}
            onClick={() => {
              if (isCopyTrade) {
                setCopyTradeOpen(true);
              } else if (it.key === "config-ativos") {
                setAssetConfigModalOpen(true);
              } else if (isPuma) {
                setPumaBrokerOpen(true);
              } else {
                setActive(it.key);
              }
            }}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
              isActive
                ? "bg-success/10 text-success border border-success/30"
                : "text-sidebar-foreground hover:bg-accent/40"
            }`}
          >
            <Icon className="size-4" />
            {it.label}
          </button>
        );
      })}
    </div>
  ))}
</nav>

        <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
          Nexor AI v1.0.0
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-panel flex items-center px-5 gap-4">
          <button className="text-muted-foreground hover:text-foreground">
            <Menu className="size-5" />
          </button>
          <div className="flex gap-2">
            {(["M1", "M5", "M15"] as const).map((t) => {
              const isActive = timeframes.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    if (
                      timeframes.length === 3 &&
                      timeframes.includes("M1") &&
                      timeframes.includes("M5") &&
                      timeframes.includes("M15")
                    ) {
                      const newTimeframes = [t];
                      setTimeframes(newTimeframes);
                      updateConfig({ timeframes: newTimeframes });
                    } else {
                      let newTimeframes = [...timeframes];
                      if (isActive) {
                        if (timeframes.length > 1) {
                          newTimeframes = timeframes.filter((tf) => tf !== t);
                        }
                      } else {
                        newTimeframes = [...timeframes, t];
                      }
                      setTimeframes(newTimeframes);
                      updateConfig({ timeframes: newTimeframes });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                    isActive
                      ? "bg-success text-success-foreground shadow-md shadow-success/20"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                  disabled={isActive && timeframes.length === 1}
                  title={
                    isActive && timeframes.length === 1
                      ? "Pelo menos um timeframe deve estar ativo"
                      : ""
                  }
                >
                  {t}
                </button>
              );
            })}
            <button
              onClick={() => {
                const allTimeframes: ("M1" | "M5" | "M15")[] = ["M1", "M5", "M15"];
                const isAllActive =
                  timeframes.length === 3 && allTimeframes.every((tf) => timeframes.includes(tf));
                if (isAllActive) {
                  const newTimeframes: ("M1" | "M5" | "M15")[] = ["M1"];
                  setTimeframes(newTimeframes);
                  updateConfig({ timeframes: newTimeframes });
                } else {
                  setTimeframes(allTimeframes);
                  updateConfig({ timeframes: allTimeframes });
                }
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                timeframes.length === 3 &&
                timeframes.includes("M1") &&
                timeframes.includes("M5") &&
                timeframes.includes("M15")
                  ? "bg-info text-info-foreground shadow-md shadow-info/20 border border-info/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
              title={
                timeframes.length === 3 &&
                timeframes.includes("M1") &&
                timeframes.includes("M5") &&
                timeframes.includes("M15")
                  ? "Desativa TODOS e mantém apenas M1"
                  : "Ativa M1, M5 e M15 simultaneamente"
              }
            >
              TODOS
            </button>
          </div>
          <div className="flex-1 flex justify-center items-center gap-3 text-xs">
            <span
              className={`flex items-center gap-2 ${connected ? (robotState.currentSession === "open" ? "text-success" : "text-warning") : "text-danger"}`}
            >
              <span
                className={`size-2 rounded-full ${connected ? (robotState.currentSession === "open" ? "bg-success animate-pulse" : "bg-warning") : "bg-danger"}`}
              />
              {connected
                ? robotState.currentSession === "open"
                  ? "MERCADO ABERTO"
                  : "MERCADO FECHADO"
                : "DESCONECTADO"}
            </span>
            <span className="text-muted-foreground">
              {now ? `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}` : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
              title={soundEnabled ? "Desativar som" : "Ativar som"}
            >
              {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  setSettingsOpen(false);
                }}
                className="relative hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
              >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-danger text-[10px] text-danger-foreground flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {notifOpen && (
                <div className="absolute top-16 right-2 z-50 w-80 panel p-0 shadow-2xl border border-border">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <span className="text-xs font-semibold tracking-wide">NOTIFICAÇÕES</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNotifications([])}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Limpar tudo
                      </button>
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="px-4 py-2.5 border-b border-border/50 flex items-start gap-2 text-xs hover:bg-accent/20"
                        >
                          {n.type === "success" && (
                            <Check className="size-4 text-success mt-0.5 shrink-0" />
                          )}
                          {n.type === "error" && (
                            <AlertTriangle className="size-4 text-danger mt-0.5 shrink-0" />
                          )}
                          {n.type === "warning" && (
                            <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                          )}
                          {n.type === "info" && (
                            <Clock className="size-4 text-info mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{n.message}</div>
                            <div
                              className="text-[10px] text-muted-foreground mt-0.5"
                              suppressHydrationWarning
                            >
                              {n.time.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setNotifOpen(false);
                }}
                className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
              >
                <Settings className="size-5" />
              </button>

              {/* Settings Panel */}
              {settingsOpen && (
                <div className="absolute top-16 right-2 z-50 w-72 panel p-0 shadow-2xl border border-border">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <span className="text-xs font-semibold tracking-wide">CONFIGURAÇÕES</span>
                      <button
                        onClick={() => setSettingsOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    {/* Theme */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                        TEMA
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setIsDarkMode(false)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            !isDarkMode
                              ? "bg-success/15 border border-success/40 text-success"
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <Sun className="size-4" />
                          Claro
                        </button>
                        <button
                          onClick={() => setIsDarkMode(true)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            isDarkMode
                              ? "bg-success/15 border border-success/40 text-success"
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <Moon className="size-4" />
                          Escuro
                        </button>
                      </div>
                    </div>

                    {/* Font */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                        FONTE
                      </span>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full px-3 py-2 rounded-md text-xs bg-secondary border border-border focus:outline-none focus:ring-2 focus:ring-success"
                      >
                        <option value="system">Sistema (Padrão)</option>
                        <option value="inter">Inter</option>
                        <option value="roboto">Roboto</option>
                        <option value="mono">Monoespaçada</option>
                      </select>
                    </div>

                    {/* Accent Color */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                        COR DE DESTAQUE
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "emerald", label: "Esmeralda", color: "#10b981" },
                          { key: "blue", label: "Azul", color: "#3b82f6" },
                          { key: "purple", label: "Roxo", color: "#8b5cf6" },
                          { key: "orange", label: "Laranja", color: "#f97316" },
                          { key: "red", label: "Vermelho", color: "#ef4444" },
                          { key: "pink", label: "Rosa", color: "#ec4899" },
                        ].map((c) => (
                          <button
                            key={c.key}
                            onClick={() => setAccentColor(c.key)}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${
                              accentColor === c.key
                                ? "border-foreground scale-110 shadow-lg"
                                : "border-border hover:border-muted-foreground"
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Audio */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                        ÁUDIO
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSoundEnabled(true)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            soundEnabled
                              ? "bg-success/15 border border-success/40 text-success"
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <Volume2 className="size-4" />
                          Habilitado
                        </button>
                        <button
                          onClick={() => setSoundEnabled(false)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            !soundEnabled
                              ? "bg-success/15 border border-success/40 text-success"
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <VolumeX className="size-4" />
                          Desabilitado
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Versão 1.0.0</span>
                        <span>Nexor AI v1.0.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
              title={isFullscreen ? "Sair da tela cheia (F11)" : "Tela cheia (F11)"}
            >
              {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </button>

            <div className="w-px h-6 bg-border mx-1" />
            <div className="flex items-center gap-2 panel px-3 py-1.5">
              <User className="size-4" />
              <div className="text-xs">
                <div className="font-semibold text-foreground">{userName ?? "NEXOR TRADER"}</div>
                <div className="text-muted-foreground text-[10px]">
                  {credentials?.accountType === "demo" ? "Conta Demo" : "Conta Real"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5 space-y-5">
          {/* Top metrics row */}
          <section className="flex gap-6 flex-wrap">
            <MetricCard
              label="ACTIVE ASSET"
              value={getAssetDisplayName(
                store.market.asset || robotState.lastScannedAsset || "EURUSD",
              )}
              flag={getAssetFlag(
                store.market.asset || robotState.lastScannedAsset || "EURUSD",
              )}
            />
            <MetricCard
              label="TIMEFRAME"
              value={robotState.selectedTimeframe || robotState.config.timeframes?.[0] || "M1"}
              sub={`Expiration ${robotState.config.expirationSeconds >= 60 ? Math.round(robotState.config.expirationSeconds / 60) + " min" : robotState.config.expirationSeconds + "s"}`}
            />
            <ActiveStrategyCard />
            <MarketContextCard />
            <MetricCard
              label="CURRENT PAYOUT"
              value={currentPayout > 0 ? `${currentPayout}%` : "—"}
              accent={currentPayout >= 80 ? "success" : "neutral"}
            />
            <MetricCard
              label="SESSION PROFIT"
              value={`${robotState.sessionProfit >= 0 ? "+" : ""}${robotState.sessionProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
              sub={
                robotState.initialBankroll > 0
                  ? `${robotState.sessionProfit >= 0 ? "+" : ""}${((robotState.sessionProfit / robotState.initialBankroll) * 100).toFixed(2)}%`
                  : "0%"
              }
              accent="success"
            />
            <MetricCard
              label="WINS / LOSS"
              value={`${robotState.totalWins} / ${robotState.totalLosses}`}
              sub={`${robotState.winRate.toFixed(0)}%`}
              accent="success"
            />
            <MetricCard
              label="ROBOT STATUS"
              value={
                robotState.status === "running"
                  ? "TRADING"
                  : robotState.status === "waiting-result"
                    ? "WAITING"
                    : robotState.status === "paused"
                      ? "PAUSED"
                      : robotState.status === "error"
                        ? "ERROR"
                        : "STOPPED"
              }
              sub={
                robotState.status === "running"
                  ? "Automatic"
                  : robotState.status === "waiting-result"
                    ? "Processing"
                    : robotState.status === "paused"
                      ? "Manual"
                      : "Inactive"
              }
              accent={
                robotState.status === "running" || robotState.status === "waiting-result"
                  ? "success"
                  : "neutral"
              }
              live={robotState.status === "running" || robotState.status === "waiting-result"}
            />
          </section>
          {/* Robot Controls */}
          <PanelCard
            icon={Power}
            title="Controles do Robô"
            description="Inicie, pause ou reset da operação."
            status={
              robotState.status === "running" ? (
                <StatusBadge tone="success" label="OPERANDO" />
              ) : robotState.status === "waiting-result" ? (
                <StatusBadge tone="success" label="AGUARDANDO" />
              ) : robotState.status === "paused" ? (
                <StatusBadge tone="warning" label="PAUSADO" />
              ) : (
                <StatusBadge tone="neutral" label="PARADO" />
              )
            }
          >
            <RobotControls />
          </PanelCard>

          {/* ═══ NEXOR CONTROL CENTER ═══ */}
          <NexorControlCenter
            robotState={robotState}
            marketProfile={marketProfile}
            learningContext={learningContext}
            chartTab={chartTab}
            setChartTab={setChartTab}
            handleOpenReplay={handleOpenReplay}
            connected={connected}
          />

          {/* ═══ NEXOR AI V2 — LIVE INTELLIGENCE ═══ */}
          <LiveIntelligencePanel />



          {/* ═══ DASHBOARD (VISÃO GERAL) — Monitoramento em tempo real ═══ */}

          <section className="grid grid-cols-12 gap-4">
            {/* ── Left Column: Panels stacked vertically ── */}
            <div className="col-span-12 md:col-span-4 space-y-4">
              <MarketProfileCard profile={marketProfile} />
              <HistoryPanel onReplay={handleOpenReplay} />
              <StrategyLifecycleCard instance={activeLifecycle} />

              {/* Saúde do Robô */}
              <PanelCard
                icon={HeartPulse}
                title="Saúde do Robô"
                description="Pontuação de saúde e estabilidade."
                status={
                  <StatusBadge
                    tone={
                      !advisorContext?.robotHealth || advisorContext.robotHealth.score === 0
                        ? "neutral"
                        : advisorContext.robotHealth.score >= 60
                          ? "success"
                          : advisorContext.robotHealth.score >= 40
                            ? "warning"
                            : "danger"
                    }
                    label={
                      advisorContext?.robotHealth ? advisorContext.robotHealth.label : "AGUARDANDO"
                    }
                  />
                }
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <svg width="44" height="44" viewBox="0 0 44 44">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="oklch(0.2 0.03 220)"
                        strokeWidth="4"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        className={
                          !advisorContext?.robotHealth || advisorContext.robotHealth.score === 0
                            ? "stroke-muted"
                            : advisorContext.robotHealth.score >= 80
                              ? "stroke-success"
                              : advisorContext.robotHealth.score >= 60
                                ? "stroke-success"
                                : advisorContext.robotHealth.score >= 40
                                  ? "stroke-warning"
                                  : "stroke-danger"
                        }
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 18}
                        strokeDashoffset={
                          advisorContext?.robotHealth
                            ? 2 * Math.PI * 18 -
                              (advisorContext.robotHealth.score / 100) * 2 * Math.PI * 18
                            : 2 * Math.PI * 18
                        }
                        transform="rotate(-90 22 22)"
                        style={{ transition: "stroke-dashoffset 1s ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold text-foreground">
                        {advisorContext?.robotHealth ? advisorContext.robotHealth.score : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">
                      {advisorContext?.robotHealth
                        ? advisorContext.robotHealth.label
                        : "Aguardando"}
                    </div>
                  </div>
                </div>
              </PanelCard>

              {/* Conselheiro (Advisor) */}
              <PanelCard
                icon={Brain}
                title="Conselheiro"
                description="Status da inteligência do robô."
                status={
                  advisorContext ? (
                    <StatusBadge
                      tone={ADVISOR_TONE[advisorContext.overallStatus] ?? "neutral"}
                      label={advisorContext.overallStatus}
                    />
                  ) : (
                    <StatusBadge tone="neutral" label="AGUARDANDO" />
                  )
                }
              >
                {!advisorContext ? (
                  <div className="text-xs text-muted-foreground">Aguardando...</div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {advisorContext.recommendations.length} recomendações
                      {advisorContext.alerts.length > 0 &&
                        ` · ${advisorContext.alerts.length} alerta${advisorContext.alerts.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                )}
              </PanelCard>

              <PerformancePanel />
              <FinancePanel />
            </div>

            {/* ── Right Column: Calculadora (tall) ── */}
            <div className="col-span-12 md:col-span-8 h-full">
              <CalcPanel />
            </div>
          </section>

          {/* Última Operação (monitoramento) */}
          {store.replayContext && (
            <section className="grid grid-cols-12 gap-4">
              <ReplayCard
                context={store.replayContext}
                onOpenDrawer={() => setReplayDrawerOpen(true)}
              />
            </section>
          )}

          {/* Strategy Timeline */}
          {activeLifecycle && activeLifecycle.timeline.length > 1 && (
            <section className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <PanelCard
                  icon={Activity}
                  title="Ciclo da Estratégia"
                  description="Linha do tempo dos estados da estratégia."
                  status={<StatusBadge tone="info" label="MONITORANDO" />}
                >
                  <StrategyTimeline
                    timeline={activeLifecycle.timeline}
                    currentState={activeLifecycle.state}
                  />
                </PanelCard>
              </div>
            </section>
          )}

          {/* Intelligence Section (feed + performance intelligence) */}
          <IntelligenceSection
            advisorContext={advisorContext}
            performanceContext={store.performanceContext}
            feedEntries={advisorHistory.getLast(20)}
          />
        </main>

        {/* Analyst Panel (Nexor AI) */}
        <AnalystPanel store={store} robotState={robotState} />

        {/* Replay Drawer */}
        {replayDrawerOpen && selectedReplay && (
          <ReplayDrawer context={selectedReplay} onClose={() => setReplayDrawerOpen(false)} />
        )}

        {/* Footer status */}
        <footer className="h-10 border-t border-border bg-panel flex items-center px-5 text-[11px] text-muted-foreground gap-6">
          <span className="flex items-center gap-2 text-success">
            <span className="size-2 rounded-full bg-success" /> ROBOT ACTIVE
          </span>
          <span>
            NEXT ANALYSIS: <span className="text-foreground font-mono">00:05</span>
          </span>
          <span>
            MODE: <span className="text-foreground">AUTOMATIC</span>
          </span>
          <span>
            RISK: <span className="text-success">SOROSGALE ●</span>
          </span>
          <span className="ml-auto">
            CONNECTION: <span className="text-foreground">PUMA BROKER</span>
          </span>
        </footer>
      </div>

      {/* Assets Config Modal - Updated with new component */}
      {assetConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div 
            className="absolute inset-0"
            onClick={() => setAssetConfigModalOpen(false)}
          />
          <div className="relative w-full max-w-6xl mx-auto p-4 h-[75vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl">
            <AssetsAdvancedConfigPanel
              key={assetConfigModalOpen ? "open" : "closed"}
            />
            <button
              onClick={() => setAssetConfigModalOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-danger text-danger-foreground flex items-center justify-center hover:bg-danger/90 transition-colors z-50"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de operação ativa (mantido por compatibilidade) */}
      <NewOperationModal
        activeOperation={robotState.activeOperation}
        onClose={() => setModalOpen(false)}
        onCancel={() => {}}
      />

    </div>
  );
}

/* ---------------- NEXOR CONTROL CENTER ---------------- */

type OperationProfile = "AUTO" | "FOREX" | "HYBRID_FLOW" | "HYBRID_PROBABILITY";
type ControlTab = "perfil" | "decisao" | "ranking" | "performance" | "aprendizado" | "saude";

const PROFILE_DESCRIPTIONS: Record<OperationProfile, string> = {
  AUTO: "Seleção automática do mercado e do motor de decisão com base no contexto atual.",
  FOREX: "Opera exclusivamente no motor Forex com indicadores cambiais dedicados.",
  HYBRID_FLOW: "Fluxo de continuidade híbrido combinando estrutura de preço e momentum.",
  HYBRID_PROBABILITY:
    "Motor de probabilidade híbrido (Setup / ADX / EMA200 / ATR / Flow Index / Probability Score).",
};

interface NexorControlCenterProps {
  robotState: RobotState;
  marketProfile: MarketProfile;
  learningContext: LearningContext | null;
  chartTab: "grafico" | "estrutura";
  setChartTab: (t: "grafico" | "estrutura") => void;
  handleOpenReplay: (
    ctx: import("../modules/flow-continuity/types/replay-context.types").ReplayContext,
  ) => void;
  connected: boolean;
}

function NexorControlCenter({
  robotState,
  marketProfile,
  learningContext,
  chartTab,
  setChartTab,
  handleOpenReplay,
  connected,
}: NexorControlCenterProps) {
  const [tab, setTab] = useState<ControlTab>("perfil");
  const profile = (robotState.config.operationProfile ?? "AUTO") as OperationProfile;
  const isActive = robotState.status === "running" || robotState.status === "waiting-result";

  const TABS: TabDef[] = [
    { key: "perfil", label: "Perfil Operacional", icon: Settings, state: "Ativo" },
    { key: "decisao", label: "Motor de Decisão", icon: Brain, state: "Online" },
    { key: "ranking", label: "Ranking de Ativos", icon: ListFilter, state: "Ao vivo" },
    { key: "performance", label: "Performance", icon: Trophy, state: "Ativo" },
    { key: "aprendizado", label: "Aprendizado", icon: BookOpen, state: "Online" },
    { key: "saude", label: "Saúde do Robô", icon: Activity, state: "Monitorado" },
  ];

  return (
    <section className="panel p-0 overflow-hidden border-primary/30 shadow-lg shadow-primary/5">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5">
        <div className="size-9 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
          <Zap className="size-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold tracking-wide text-primary">NEXOR CONTROL CENTER</div>
          <div className="text-[10px] text-muted-foreground tracking-widest">
            CENTRAL DE CONTROLE UNIFICADA
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabNav tabs={TABS} active={tab} onChange={(k) => setTab(k as ControlTab)} />

      {/* Content */}
      <div className="p-5">
        {tab === "perfil" && (
          <div className="space-y-4">
            <OperationalProfileSelector />
            <PanelCard
              icon={Settings}
              title="Resumo do Perfil"
              description="Visão geral do perfil operacional."
              status={<StatusBadge tone="info" label="ATIVO" />}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-muted-foreground">PERFIL ATUAL</div>
                  <div className="font-semibold">{profile}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">MERCADO DETECTADO</div>
                  <div className="font-semibold">{marketProfile.detectedMarket}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">ESTRATÉGIA</div>
                  <div className="font-semibold truncate">{marketProfile.activeStrategyName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">CONFIANÇA</div>
                  <div className="font-semibold">{marketProfile.confidence}%</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">{PROFILE_DESCRIPTIONS[profile]}</p>
            </PanelCard>
          </div>
        )}

        {tab === "decisao" && (
          <div className="space-y-4">
            <PanelCard
              icon={Brain}
              title="Motor de Decisão"
              description="Engine responsável pela análise da operação atual."
              status={
                <StatusBadge
                  tone={isActive ? "success" : "warning"}
                  label={
                    robotState.status === "running"
                      ? "OPERANDO"
                      : robotState.status === "waiting-result"
                        ? "AGUARDANDO"
                        : robotState.status === "paused"
                          ? "PAUSADO"
                          : "PARADO"
                  }
                  pulse={isActive}
                />
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard label="Perfil" value={profile} />
                <MetricCard label="Mercado" value={marketProfile.detectedMarket} />
                <MetricCard
                  label="Status"
                  value={
                    robotState.status === "running"
                      ? "OPERANDO"
                      : robotState.status === "waiting-result"
                        ? "AGUARDANDO"
                        : robotState.status === "paused"
                          ? "PAUSADO"
                          : "PARADO"
                  }
                  accent={isActive ? "success" : "warning"}
                  live={isActive}
                />
                <MetricCard
                  label="Score"
                  value={`${Math.round(
                    robotState.lastAnalysis?.probability?.total ??
                      robotState.lastAnalysis?.score?.total ??
                      0,
                  )}%`}
                  accent="success"
                />
              </div>
            </PanelCard>
            {profile === "HYBRID_PROBABILITY" ? (
              <HybridProbabilityPanel />
            ) : (
              <AnalysisPanel chartTab={chartTab} setChartTab={setChartTab} />
            )}
          </div>
        )}

        {tab === "ranking" && <RankingPanel />}

        {tab === "performance" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-7">
              <PerformancePanel />
            </div>
            <div className="col-span-12 lg:col-span-5 space-y-4">
              <FinancePanel />
              <HistoryPanel onReplay={handleOpenReplay} />
            </div>
          </div>
        )}

        {tab === "aprendizado" && <LearningInsightsCard context={learningContext} />}

        {tab === "saude" && (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <PanelCard
                icon={Activity}
                title="Status dos Módulos"
                description="Estado dos módulos do robô."
                status={<StatusBadge tone="info" label="MONITORADO" />}
              >
                <ModuleStatus
                  label="Robô"
                  state={isActive ? "online" : "offline"}
                  value={robotState.status.toUpperCase()}
                />
                <ModuleStatus
                  label="Sessão de Mercado"
                  state={robotState.currentSession === "open" ? "online" : "waiting"}
                  value={(robotState.currentSession ?? "—").toUpperCase()}
                />
                <ModuleStatus
                  label="Conexão / WebSocket"
                  state={connected ? "online" : "offline"}
                  value={connected ? "STREAMING" : "SEM SINAL"}
                />
                <ModuleStatus label="Advisor" state="online" />
                <ModuleStatus label="Motor de Decisão" state="online" value={profile} />
              </PanelCard>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- subcomponents ---------------- */

function BrokerCard() {
  useEffect(() => {
    return () => console.log("[UNMOUNT] BrokerCard");
  }, []);
  const {
    connected,
    connecting,
    balance,
    userName,
    credentials,
    error: brokerError,
    login,
    logout,
  } = useBroker();

  if (connecting) {
    return (
      <PanelCard
        icon={Plug}
        title="Conexão Puma Broker"
        description="Status da conexão com o broker Puma."
        status={<StatusBadge tone="warning" label="CONECTANDO" pulse />}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center text-warning font-bold">
              P
            </div>
            <div>
              <div className="text-sm font-bold">PUMA</div>
              <div className="text-[10px] text-muted-foreground">BROKER</div>
            </div>
          </div>
          <span className="text-[10px] text-warning flex items-center gap-1 bg-warning/10 px-2 py-1 rounded">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" /> CONECTANDO
          </span>
        </div>
        <div className="text-xs text-muted-foreground text-center py-4">
          Conectando ao servidor...
        </div>
      </PanelCard>
    );
  }

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginAccountType, setLoginAccountType] = useState<"demo" | "real">("demo");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!connected) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail || !loginPassword) {
        setLoginError("Preencha email e senha");
        return;
      }
      setLoginError(null);
      setLoggingIn(true);
      try {
        await login({
          username: loginEmail,
          password: loginPassword,
          accountType: loginAccountType,
          serverUrl: "http://127.0.0.1:3001",
          keepConnected: false,
        });
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : "Falha na conexão");
      } finally {
        setLoggingIn(false);
      }
    };

    return (
      <PanelCard
        icon={Plug}
        title="Conexão Puma Broker"
        description="Status da conexão com o broker Puma."
        status={<StatusBadge tone="danger" label="DESCONECTADO" />}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-danger/20 border border-danger/40 flex items-center justify-center text-danger font-bold">
              P
            </div>
            <div>
              <div className="text-sm font-bold">PUMA</div>
              <div className="text-[10px] text-muted-foreground">BROKER</div>
            </div>
          </div>
          <span className="text-[10px] text-danger flex items-center gap-1 bg-danger/10 px-2 py-1 rounded">
            <span className="size-1.5 rounded-full bg-danger" /> DESCONECTADO
          </span>
        </div>
        <div className="space-y-3">
          <form onSubmit={handleLogin}>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-info focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm pr-9 focus:border-info focus:outline-none"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo de conta</label>
              <div className="flex gap-2 mt-1">
                {[
                  { key: "demo" as const, label: "Demo" },
                  { key: "real" as const, label: "Real" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLoginAccountType(opt.key)}
                    className={`px-4 py-2 rounded-md text-sm border transition-colors ${loginAccountType === opt.key ? "bg-info/20 border-info/50 text-info" : "bg-background border-border text-muted-foreground hover:border-info/30"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {loginError && (
              <div className="text-xs text-danger flex items-center gap-2">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2 rounded-md bg-success text-success-foreground text-xs font-semibold tracking-wider hover:bg-success/90 disabled:opacity-50"
            >
              {loggingIn ? "CONECTANDO..." : "CONECTAR"}
            </button>
          </form>
        </div>
      </PanelCard>
    );
  }

  const saldo = balance
    ? credentials?.accountType === "demo"
      ? balance.demoBalance
      : balance.balance
    : 0;
  const fmtSaldo = saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const tipoConta = credentials?.accountType === "demo" ? "Conta Demo" : "Conta Real";

  return (
    <PanelCard
      icon={Plug}
      title="Conexão Puma Broker"
      description="Status da conexão com o broker Puma."
      status={<StatusBadge tone="success" label="CONECTADO" />}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center text-warning font-bold">
            P
          </div>
          <div>
            <div className="text-sm font-bold">PUMA</div>
            <div className="text-[10px] text-muted-foreground">BROKER</div>
          </div>
        </div>
        <span className="text-[10px] text-success flex items-center gap-1 bg-success/10 px-2 py-1 rounded">
          <span className="size-1.5 rounded-full bg-success" /> CONECTADO
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row k="Conta" v={tipoConta} />
        <Row k="Usuário" v={userName ?? "—"} />
        <Row k="Saldo" v={fmtSaldo} />
      </div>
      <button
        onClick={logout}
        className="w-full mt-4 py-2 rounded-md border border-border text-xs font-semibold tracking-wide hover:bg-accent"
      >
        DESCONECTAR
      </button>
    </PanelCard>
  );
}

function RobotControls() {
  const { state, start, stop, reset } = useRobot();
  const isRunning = state.status === "running";
  const isPaused = state.status === "paused";
  return (
    <div className="flex items-center gap-2">
      {!isRunning && !isPaused ? (
        <button
          onClick={() => start()}
          className="px-4 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold tracking-wide hover:bg-success/90 flex items-center gap-1.5"
        >
          <span className="size-2 rounded-full bg-success-foreground animate-pulse" /> INICIAR
        </button>
      ) : (
        <button
          onClick={() => stop()}
          className="px-4 py-1.5 rounded-md bg-danger text-danger-foreground text-xs font-semibold tracking-wide hover:bg-danger/90 flex items-center gap-1.5"
        >
          <span className="size-2 rounded-full bg-danger-foreground" /> PARAR
        </button>
      )}
      <button
        onClick={() => reset()}
        className="px-4 py-1.5 rounded-md border border-border text-xs font-semibold tracking-wide hover:bg-accent"
      >
        RESETAR
      </button>
      <span
        className={`text-[10px] font-mono tracking-wider px-2 py-1 rounded ${isRunning ? "bg-success/10 text-success" : isPaused ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}
      >
        {isRunning ? "RODANDO" : isPaused ? "PAUSADO" : "PARADO"}
      </span>
    </div>
  );
}

/* ===== ASSETS CONFIGURATION PANEL ===== */
function AssetsConfigPanel() {
  const { state, updateConfig } = useRobot();
  const [selectedAssets, setSelectedAssets] = useState<string[]>(state.config.assets);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      console.log("[UNMOUNT] AssetsConfigPanel");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Categorize assets for better UX
  const assetCategories = {
    "Forex Majors": ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD"],
    Crypto: ["BTCUSD", "ETHUSD"],
    "Híbridos Puma": ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"],
    Commodities: ["XAUUSD"],
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      updateConfig({ assets: selectedAssets });
      // Persist to localStorage (handled by robot engine)
      localStorage.setItem("nexor_assets_config", JSON.stringify(selectedAssets));
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Erro ao salvar ativos:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (category: string) => {
    const assets = assetCategories[category as keyof typeof assetCategories] || [];
    setSelectedAssets((prev) => {
      const newSet = new Set(prev);
      assets.forEach((a) => newSet.add(a));
      return Array.from(newSet);
    });
  };

  const handleDeselectAll = (category: string) => {
    const assets = assetCategories[category as keyof typeof assetCategories] || [];
    setSelectedAssets((prev) => prev.filter((a) => !assets.includes(a)));
  };

  const isAssetSelected = (asset: string) => selectedAssets.includes(asset);

  const toggleAsset = (asset: string) => {
    setSelectedAssets((prev) =>
      isAssetSelected(asset) ? prev.filter((a) => a !== asset) : [...prev, asset],
    );
  };

  const allAssets = Object.values(assetCategories).flat();

  return (
    <PanelCard
      icon={Coins}
      title="Configuração de Ativos"
      description="Selecione os ativos operados."
      status={
        saved ? (
          <StatusBadge tone="success" label="SALVO" />
        ) : (
          <StatusBadge tone="neutral" label="CONFIGURÁVEL" />
        )
      }
      headerExtra={
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[10px] text-success font-semibold flex items-center gap-1">
              <CheckCircle2 className="size-3" /> SALVO
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || selectedAssets.length === 0}
            className="px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-semibold tracking-wide hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Save className="size-3.5" />
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> SALVANDO...
              </>
            ) : (
              "SALVAR CONFIGURAÇÃO"
            )}
          </button>
        </div>
      }
      bodyClassName="space-y-4"
    >
      <div className="text-[10px] text-muted-foreground tracking-widest mb-2">
        {selectedAssets.length} de {allAssets.length} ativos selecionados • Modo:{" "}
        {state.config.scanMode === "multi" ? "MULTI-ASSET (Varredura)" : "SINGLE (Um ativo)"}
      </div>

      <div className="space-y-4">
        {Object.entries(assetCategories).map(([category, assets]) => {
          const selectedInCategory = assets.filter(isAssetSelected);
          const allSelected = selectedInCategory.length === assets.length;
          const noneSelected = selectedInCategory.length === 0;

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider">
                  {category}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {selectedInCategory.length}/{assets.length}
                  </span>
                  {!allSelected && (
                    <button
                      onClick={() => handleSelectAll(category)}
                      className="text-[10px] text-success hover:underline px-1.5 py-0.5 rounded"
                      title="Selecionar todos"
                    >
                      Todos
                    </button>
                  )}
                  {!noneSelected && (
                    <button
                      onClick={() => handleDeselectAll(category)}
                      className="text-[10px] text-danger hover:underline px-1.5 py-0.5 rounded"
                      title="Desmarcar todos"
                    >
                      Nenhum
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assets.map((asset) => (
                  <button
                    key={asset}
                    onClick={() => toggleAsset(asset)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-mono font-semibold tracking-wide transition-all ${
                      isAssetSelected(asset)
                        ? "bg-success/10 border-success/40 text-success shadow-sm shadow-success/10"
                        : "bg-secondary border-border text-muted-foreground hover:border-muted-foreground/50 hover:bg-secondary/80"
                    }`}
                    title={asset}
                  >
                    {isAssetSelected(asset) && (
                      <CheckCircle2 className="size-3 text-success shrink-0" />
                    )}
                    {!isAssetSelected(asset) && (
                      <XCircle className="size-3 text-muted-foreground shrink-0" />
                    )}
                    <span>{asset}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-border flex flex-wrap gap-2 items-center">
        <Shield className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {"Mínimo 1 ativo. Para multi-asset, recomenda-se 3-8 ativos com payout >= 80%."}
        </span>
        <Zap className="size-3.5 text-warning ml-auto" />
        <span className="text-xs text-warning font-semibold">Aplicado na próxima análise</span>
      </div>
    </PanelCard>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function AnalysisPanel({
  chartTab,
  setChartTab,
}: {
  chartTab: "grafico" | "estrutura";
  setChartTab: (t: "grafico" | "estrutura") => void;
}) {
  const { state, updateConfig } = useRobot();
  const store = useAnalystStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      console.log("[UNMOUNT] AnalysisPanel");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    };
  }, []);

  const scoreItems = (() => {
    const breakdown = state.lastAnalysis?.scoreBreakdown?.filters;
    const score = state.lastAnalysis?.score;
    const prob = state.lastAnalysis?.probability;
    if (breakdown && breakdown.length > 0) {
      return breakdown.map((f) => ({
        label: f.name,
        weight: f.maxPoints,
        contribution: f.points,
        value: f.detail || `${f.points}/${f.maxPoints}`,
        ok: f.points >= f.maxPoints * 0.5,
      }));
    }
    // Fallback: build from probability breakdown
    const bd = prob?.breakdown;
    if (bd) {
      return [
        {
          label: "Tendencia",
          weight: bd.trend.max,
          contribution: bd.trend.score,
          value: `${bd.trend.score}/${bd.trend.max}`,
          ok: bd.trend.score > bd.trend.max * 0.5,
        },
        {
          label: "Estrutura",
          weight: bd.structure.max,
          contribution: bd.structure.score,
          value: `${bd.structure.score}/${bd.structure.max}`,
          ok: bd.structure.score > bd.structure.max * 0.5,
        },
        {
          label: "Price Action",
          weight: bd.priceAction.max,
          contribution: bd.priceAction.score,
          value: `${bd.priceAction.score}/${bd.priceAction.max}`,
          ok: bd.priceAction.score > bd.priceAction.max * 0.5,
        },
        {
          label: "Smart Money",
          weight: bd.smartMoney.max,
          contribution: bd.smartMoney.score,
          value: `${bd.smartMoney.score}/${bd.smartMoney.max}`,
          ok: bd.smartMoney.score > bd.smartMoney.max * 0.5,
        },
        {
          label: "Momentum",
          weight: bd.momentum.max,
          contribution: bd.momentum.score,
          value: `${bd.momentum.score}/${bd.momentum.max}`,
          ok: bd.momentum.score > bd.momentum.max * 0.5,
        },
      ];
    }
    // Static fallback
    return [
      { label: "Continuidade", weight: 20, contribution: 0, value: "—", ok: false },
      { label: "Dominancia", weight: 15, contribution: 0, value: "—", ok: false },
      { label: "Forca do Candle", weight: 15, contribution: 0, value: "—", ok: false },
      { label: "Estrutura (S/R)", weight: 10, contribution: 0, value: "—", ok: false },
      { label: "Historico (Catalogo)", weight: 10, contribution: 0, value: "—", ok: false },
    ];
  })();
  const filters = (() => {
    const analysisFilters = state.lastAnalysis?.filters;
    if (analysisFilters && analysisFilters.length > 0) {
      return analysisFilters.map((f) => ({
        label: f.name,
        detail: f.detail,
        ok: f.passed,
        statusText: f.passed ? "APPROVED" : "REJECTED",
      }));
    }
    // Static fallback
    return [
      { label: "Continuidade", detail: "", ok: false, statusText: "PENDING" },
      { label: "Forca do Candle", detail: "", ok: false, statusText: "PENDING" },
      { label: "Distancia de S/R", detail: "", ok: false, statusText: "PENDING" },
      { label: "Lateralizacao", detail: "", ok: false, statusText: "PENDING" },
      { label: "Rompimento", detail: "", ok: false, statusText: "PENDING" },
      { label: "Horario Favoravel", detail: "", ok: false, statusText: "PENDING" },
    ];
  })();

  const handleSaveConfig = () => {
    setSaving(true);
    setSaved(false);
    updateConfig({
      targetProfit: state.config.targetProfit,
      stopLoss: state.config.stopLoss,
      reAnalysisIntervalSec: state.config.reAnalysisIntervalSec,
      assetCooldownMinutes: state.config.assetCooldownMinutes,
      scanMode: state.config.scanMode,
      autoDirection: state.config.autoDirection,
      direction: state.config.direction,
      expirationSeconds: state.config.expirationSeconds,
    });
    setSaved(true);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    savingTimerRef.current = setTimeout(() => setSaving(false), 500);
  };

  return (
    <PanelCard
      icon={Activity}
      title="Análise do Fluxo"
      description="Continuidade e filtros do robô."
      status={<StatusBadge tone="info" label="ANÁLISE" />}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Motor de Score */}
        <div className="col-span-4">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">SCORE ENGINE</div>
          <div className="space-y-1.5">
            {scoreItems.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {s.ok ? (
                    <Check className="size-3 text-success shrink-0" />
                  ) : (
                    <X className="size-3 text-danger shrink-0" />
                  )}
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-[10px] text-muted-foreground font-mono">W:{s.weight}</span>
                  <span
                    className={`font-mono font-semibold ${s.ok ? "text-success" : "text-danger"}`}
                  >
                    +{s.contribution}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">FINAL SCORE</span>
              <span className="font-mono">
                <span className="text-success font-bold text-base">
                  {Math.round(
                    state.lastAnalysis?.probability?.total ?? state.lastAnalysis?.score?.total ?? 0,
                  )}
                </span>{" "}
                / 100
              </span>
            </div>
            <div className="flex justify-between items-center text-xs mt-3">
              <span className="text-muted-foreground">CLASSIFICATION</span>
              <span className="bg-success/15 text-success px-2 py-1 rounded text-[10px] font-bold tracking-wider">
                {(
                  state.lastAnalysis?.score?.classification ??
                  state.lastAnalysis?.probability?.level ??
                  "AGUARDANDO"
                ).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Active Strategy */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-2">
              ACTIVE STRATEGY
            </div>
            <div className="bg-secondary/40 rounded p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profile</span>
                <span className="font-semibold text-foreground/90">
                  {strategyManager.getActiveProfile().name}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Description</span>
                <span className="text-foreground/70 text-right max-w-[180px] truncate">
                  {strategyManager.getActiveProfile().description}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Market</span>
                <span className="font-mono text-foreground/80">
                  {store.market.asset || state.lastScannedAsset || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground/70">StrategyManager</span>
              </div>
            </div>
          </div>

          {/* Configuração do Robô */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] tracking-widest text-muted-foreground">ROBOT CONFIG</div>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all ${
                  saving
                    ? "bg-secondary text-muted-foreground cursor-wait"
                    : saved
                      ? "bg-success/15 border border-success/40 text-success"
                      : "bg-success text-success-foreground hover:bg-success/90"
                }`}
              >
                <Save className="size-3.5" />
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> SAVING...
                  </>
                ) : saved ? (
                  <>
                    <Check className="size-3.5" /> SAVED
                  </>
                ) : (
                  "SAVE CONFIG"
                )}
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">PROFIT TARGET</div>
                  <div className="font-mono text-success font-bold">
                    R$ {state.config.targetProfit.toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">STOP LOSS</div>
                  <div className="font-mono text-danger font-bold">
                    R$ {state.config.stopLoss.toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">POST-LOSS COOLDOWN</div>
                  <div className="font-mono text-warning font-bold">
                    {state.config.assetCooldownMinutes} min
                  </div>
                </div>
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">ANALYSIS INTERVAL</div>
                  <div className="font-mono text-info font-bold">
                    {state.config.reAnalysisIntervalSec}s
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-2 py-1 rounded text-[10px] font-medium ${
                    state.config.scanMode === "multi"
                      ? "bg-success/15 text-success border border-success/30"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  SCAN: {state.config.scanMode === "multi" ? "MULTI-ASSET" : "SINGLE"}
                </span>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-medium ${
                    state.config.autoDirection
                      ? "bg-info/15 text-info border border-info/30"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {state.config.autoDirection ? "AUTO DIRECTION" : "FIXED DIRECTION"}
                </span>
                <span className="px-2 py-1 rounded text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                  EXPIRATION: {state.config.expirationSeconds}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="col-span-5">
          <div className="flex gap-1 mb-3 border-b border-border">
            {(["grafico", "estrutura"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartTab(t)}
                className={`px-3 py-1.5 text-xs font-semibold tracking-wide border-b-2 -mb-px ${
                  chartTab === t
                    ? "border-success text-success"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {t === "grafico" ? "GRÁFICO" : "ESTRUTURA"}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mb-2">
            {getAssetDisplayName(store.market.asset || state.lastScannedAsset || "EURUSD")} ·{" "}
            {state.selectedTimeframe || state.config.timeframes?.[0] || "M1"}
          </div>
          <CandleChart />
        </div>

        {/* Filters */}
        <div className="col-span-3">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
            ACTIVE FILTERS
          </div>
          <div className="space-y-1.5">
            {filters.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {f.ok ? (
                    <Check className="size-3.5 text-success shrink-0" />
                  ) : (
                    <X className="size-3.5 text-danger shrink-0" />
                  )}
                  <span className="truncate text-foreground/90">{f.label}</span>
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                    f.ok ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}
                >
                  {f.statusText}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-2">
              DECISION STATUS
            </div>
            <div
              className={`text-xs font-semibold ${
                state.status === "running"
                  ? "text-success"
                  : state.status === "waiting-result"
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {state.status === "running"
                ? state.lastAnalysis
                  ? "Analyzing Market"
                  : "Scanning Assets"
                : state.status === "waiting-result"
                  ? "Active Trade"
                  : state.status === "paused"
                    ? "Paused"
                    : "Inactive"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {state.activeOperation
                ? `${state.activeOperation.direction.toUpperCase()} R$ ${state.activeOperation.amount.toFixed(2)}`
                : state.nextTrade
                  ? `Next: ${state.nextTrade.direction.toUpperCase()}`
                  : "Awaiting entry confirmation"}
            </div>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

function CandleChart() {
  // Static-ish candle SVG with deterministic rounded coordinates
  const candles = Array.from({ length: 26 }).map((_, i) => {
    const seed = +(Math.sin(i * 1.7) * 0.5 + 0.5).toFixed(3);
    const up = Math.sin(i * 0.9) > -0.1;
    const o = +(40 + seed * 60).toFixed(2);
    const c = up ? +(o + 8 + seed * 14).toFixed(2) : +(o - 8 - seed * 14).toFixed(2);
    const h = +(Math.min(o, c) - 4 - seed * 6).toFixed(2);
    const l = +(Math.max(o, c) + 4 + seed * 6).toFixed(2);
    return { x: 10 + i * 14, o, c, h, l, up };
  });
  return (
    <div className="relative bg-background/60 rounded border border-border h-[220px] overflow-hidden">
      <svg viewBox="0 0 380 200" className="w-full h-full">
        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1="0"
            x2="380"
            y1={y}
            y2={y}
            stroke="oklch(0.3 0.03 220)"
            strokeDasharray="2 4"
          />
        ))}
        {candles.map((c, i) => (
          <g key={i}>
            <line
              x1={c.x}
              x2={c.x}
              y1={c.h}
              y2={c.l}
              stroke={c.up ? "oklch(0.78 0.19 155)" : "oklch(0.65 0.24 22)"}
              strokeWidth="1"
            />
            <rect
              x={c.x - 4}
              y={Math.min(c.o, c.c)}
              width="8"
              height={Math.abs(c.c - c.o) || 2}
              fill={c.up ? "oklch(0.78 0.19 155)" : "oklch(0.65 0.24 22)"}
            />
          </g>
        ))}
        <text x="350" y="50" fill="oklch(0.78 0.19 155)" fontSize="9" fontFamily="monospace">
          1.09140
        </text>
        <text x="350" y="100" fill="oklch(0.65 0.02 220)" fontSize="9" fontFamily="monospace">
          1.09100
        </text>
        <text x="350" y="150" fill="oklch(0.65 0.02 220)" fontSize="9" fontFamily="monospace">
          1.09060
        </text>
      </svg>
      <div className="absolute top-3 left-3 bg-success/15 border border-success/40 text-success text-[10px] px-2 py-1 rounded font-semibold">
        COMPRA · Sinal Gerado
      </div>
    </div>
  );
}

function RankingPanel() {
  const { state } = useRobot();
  const store = useAnalystStore();
  const { adapter, connected } = useBroker();
  const [rankingData, setRankingData] = useState<
    Array<{ rank: number; asset: string; flag: string; score: number; wr: string; ops: number }>
  >([]);

  useEffect(() => {
    if (!connected || !adapter) {
      setRankingData([]);
      return;
    }

    const buildRanking = () => {
      const assets = state.config.assets || [];
      const scanLog = state.scanLog || [];
      const ops = state.operations || [];

      // Build from scan log and operations — use shared ranking utility
      const bestByAsset = getBestEntryPerAsset(scanLog);

      const assetStats: Record<
        string,
        { wins: number; losses: number; score: number; ops: number }
      > = {};

      // Initialize from configured assets
      assets.forEach((a) => {
        assetStats[a] = { wins: 0, losses: 0, score: 0, ops: 0 };
      });

      // Merge scan log scores — Highest Score Wins per asset
      bestByAsset.forEach((entry, asset) => {
        if (!assetStats[asset]) {
          assetStats[asset] = { wins: 0, losses: 0, score: entry.score, ops: 0 };
        } else {
          assetStats[asset].score = entry.score;
        }
      });

      // Merge operation history
      ops
        .filter((o) => o.status === "completed")
        .forEach((op) => {
          if (!assetStats[op.asset]) {
            assetStats[op.asset] = { wins: 0, losses: 0, score: 0, ops: 0 };
          }
          assetStats[op.asset].ops++;
          if (op.result === "win") assetStats[op.asset].wins++;
          else if (op.result === "loss") assetStats[op.asset].losses++;
        });

      // Use lastAnalysis score for current asset (override only if higher)
      if (state.lastAnalysis?.probability?.total) {
        const currentAsset = store.market.asset || state.lastScannedAsset || "";
        if (currentAsset && assetStats[currentAsset]) {
          const lastScore = state.lastAnalysis.probability.total;
          if (lastScore > assetStats[currentAsset].score) {
            assetStats[currentAsset].score = lastScore;
          }
        }
      }

      return Object.entries(assetStats)
        .map(([asset, stats]) => {
          const total = stats.wins + stats.losses;
          const wr = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
          return {
            rank: 0,
            asset: getAssetDisplayName(asset),
            flag: getAssetFlag(asset),
            score: stats.score || Math.round(Math.random() * 30 + 50),
            wr: total > 0 ? `${wr}%` : "—",
            ops: stats.ops,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    };

    setRankingData(buildRanking());
    const interval = setInterval(() => setRankingData(buildRanking()), 10000);
    return () => clearInterval(interval);
  }, [connected, adapter, state]);
  return (
    <PanelCard
      icon={Trophy}
      title="Ranking de Ativos"
      description="Ativos ranqueados por desempenho."
      status={<StatusBadge tone="info" label="RANKING" />}
    >
      <div className="text-[10px] text-muted-foreground grid grid-cols-12 gap-1 px-2 pb-2 border-b border-border tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-4">ATIVO</span>
        <span className="col-span-2 text-right">SCORE</span>
        <span className="col-span-2 text-right">WIN RATE</span>
        <span className="col-span-2 text-right">OPERAÇÕES</span>
        <span className="col-span-1 text-right">STATUS</span>
      </div>
      <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
        {rankingData.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Inicie o robô para gerar ranking
          </div>
        )}
        {rankingData.map((r) => (
          <div
            key={r.rank}
            className="grid grid-cols-12 gap-1 px-2 py-2 text-xs hover:bg-accent/30"
          >
            <span className="col-span-1 text-success font-bold">{r.rank}</span>
            <span className="col-span-4 flex items-center gap-1.5">
              <span>{r.flag}</span>
              {r.asset}
            </span>
            <span className="col-span-2 text-right font-mono text-success">{r.score}</span>
            <span className="col-span-2 text-right">{r.wr}</span>
            <span className="col-span-2 text-right">{r.ops}</span>
            <span className="col-span-1 flex justify-end">
              <ArrowUp className="size-3 text-success" />
            </span>
          </div>
        ))}
      </div>
      <button className="w-full mt-3 py-2 text-xs border border-border rounded hover:bg-accent">
        VER TODOS OS ATIVOS
      </button>
    </PanelCard>
  );
}

function CalcPanel() {
  const { engine, state, updateConfig } = useRobot();
  const tableRows = engine?.getTableRows() ?? [];
  const sreState = engine?.getSREState() ?? null;
  const nivelAtual = sreState?.currentLevel ?? state.currentRecoveryStep;
  const entryNumber = sreState?.entryNumber ?? state.entryNumber;
  const phase = sreState?.phase ?? "IDLE";
  const faseLabel =
    phase === "ENTRY_1"
      ? `Entry ${entryNumber}/1`
      : phase === "SOROS"
        ? `SOROS Entry ${entryNumber}/2`
        : phase;
  const isRunning = state.status === "running";
  const meta = state.config.targetProfit;
  const stop = state.config.stopLoss;

  // ── Config form state ──
  const [cfgStake, setCfgStake] = useState(state.config.initialStake);
  const [cfgPayout, setCfgPayout] = useState(Math.round(state.config.payout * 100));
  const [cfgCustomLevels, setCfgCustomLevels] = useState(
    state.config.customLevels?.join(", ") ?? "",
  );
  const [cfgMaxLevel, setCfgMaxLevel] = useState(state.config.maxLevel);
  const [cfgStopLoss, setCfgStopLoss] = useState(state.config.stopLoss);
  const [cfgStopWin, setCfgStopWin] = useState(state.config.targetProfit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      console.log("[UNMOUNT] CalcPanel");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Sync form when engine config changes (e.g. on reset)
  useEffect(() => {
    setCfgStake(state.config.initialStake);
    setCfgPayout(Math.round(state.config.payout * 100));
    setCfgCustomLevels(state.config.customLevels?.join(", ") ?? "");
    setCfgMaxLevel(state.config.maxLevel);
    setCfgStopLoss(state.config.stopLoss);
    setCfgStopWin(state.config.targetProfit);
  }, [
    state.config.initialStake,
    state.config.payout,
    state.config.maxLevel,
    state.config.stopLoss,
    state.config.targetProfit,
  ]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payoutDecimal = cfgPayout / 100;

      const customLevels = cfgCustomLevels
        .split(",")
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      updateConfig({
        initialStake: cfgStake,
        payout: payoutDecimal,
        maxLevel: cfgMaxLevel,
        stopLoss: cfgStopLoss,
        targetProfit: cfgStopWin,
        customLevels: customLevels.length > 0 ? customLevels : [],
      });

      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Erro ao salvar config:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard
      icon={Calculator}
      title="Calculadora SorosGale"
      description="Simulação de recuperação de saldo."
      status={<StatusBadge tone="neutral" label="FERRAMENTA" />}
      className="h-full flex flex-col"
    >
      <div className="grid grid-cols-12 gap-3 flex-1">
        <div className="col-span-3 space-y-3">
          <Stat title="NÍVEL ATUAL" value={String(nivelAtual)} big />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ESTRATÉGIA</div>
            <div className="text-xs font-semibold">Sorosgale Fracionado</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div
              className={`text-xs flex items-center gap-1 ${isRunning ? "text-success" : "text-muted-foreground"}`}
            >
              <span
                className={`size-1.5 rounded-full ${isRunning ? "bg-success" : "bg-muted-foreground"}`}
              />
              {faseLabel}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">META / STOP</div>
            <div className="text-xs">
              {meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /{" "}
              {stop.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>
        <div className="col-span-9 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground tracking-wider">
              <tr className="border-b border-border">
                <th className="text-left py-2">NÍVEL</th>
                <th className="text-left">1ª ENTRADA</th>
                <th className="text-left">2ª ENTRADA (SOROS)</th>
                <th className="text-left">VALOR POR TAXA</th>
                <th className="text-left">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                    Configure e salve os parâmetros abaixo para gerar a tabela
                  </td>
                </tr>
              )}
              {tableRows.map((l) => {
                const isActive = l.level === nivelAtual;
                const e1 = l.entry1.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });
                const e2 = l.entry2.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });
                const total = (l.entry1 + l.entry2).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });
                const accLoss =
                  l.accLossBefore > 0
                    ? l.accLossBefore.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "R$ 0,00";
                return (
                  <tr
                    key={l.level}
                    className={`border-b border-border ${isActive ? "bg-success/10" : ""}`}
                  >
                    <td className="py-2 font-bold">{l.level}</td>
                    <td className={isActive ? "text-success" : ""}>{e1}</td>
                    <td className={isActive ? "text-success" : ""}>{e2}</td>
                    <td className={isActive ? "text-success" : ""}>{total}</td>
                    <td className={l.accLossBefore > 0 ? "text-success" : "text-muted-foreground"}>
                      {accLoss}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Configuração Editável do Sorosgale ── */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold tracking-wider text-foreground flex items-center gap-2">
            <Settings className="size-3.5 text-success" />
            CONFIGURAÇÃO DO SOROSGALE
          </h4>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-[10px] text-success font-semibold flex items-center gap-1">
                <CheckCircle2 className="size-3" /> SALVO
              </span>
            )}
            <button
              onClick={handleSaveConfig}
              disabled={saving || isRunning}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-all ${
                saving
                  ? "bg-secondary text-muted-foreground cursor-wait"
                  : saved
                    ? "bg-success/15 border border-success/40 text-success"
                    : "bg-success text-success-foreground hover:bg-success/90"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="size-3.5" />
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> SALVANDO...
                </>
              ) : (
                "SALVAR CONFIGURAÇÃO"
              )}
            </button>
          </div>
        </div>

        {isRunning && (
          <div className="mb-3 text-[10px] text-warning flex items-center gap-1.5 bg-warning/10 border border-warning/30 rounded px-3 py-2">
            <AlertTriangle className="size-3 shrink-0" />
            Pare o robô primeiro para alterar configurações do Sorosgale.
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              STAKE INICIAL (R$)
            </label>
            <input
              type="number"
              value={cfgStake}
              onChange={(e) => setCfgStake(parseFloat(e.target.value) || 0)}
              min={0.01}
              step={0.01}
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">Entrada 1 no Nível 0</div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              PAYOUT DO BROKER (%)
            </label>
            <input
              type="number"
              value={cfgPayout}
              onChange={(e) => setCfgPayout(parseFloat(e.target.value) || 0)}
              min={1}
              max={100}
              step={1}
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">
              Ex: 87% gera Entrada 2 de R${(cfgStake + cfgStake * (cfgPayout / 100)).toFixed(2)}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              NÍVEL MÁXIMO
            </label>
            <input
              type="number"
              value={cfgMaxLevel}
              onChange={(e) => setCfgMaxLevel(parseInt(e.target.value) || 1)}
              min={1}
              max={50}
              step={1}
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">Proteção de segurança</div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              STOP LOSS (R$)
            </label>
            <input
              type="number"
              value={cfgStopLoss}
              onChange={(e) => setCfgStopLoss(parseFloat(e.target.value) || 0)}
              min={0}
              step={1}
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">Limite de perda diária</div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              STOP WIN (R$)
            </label>
            <input
              type="number"
              value={cfgStopWin}
              onChange={(e) => setCfgStopWin(parseFloat(e.target.value) || 0)}
              min={0}
              step={1}
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">
              Meta de lucro diária (0 = desativado)
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground tracking-widest block mb-1">
              NÍVEIS CUSTOMIZADOS (R$)
            </label>
            <input
              type="text"
              value={cfgCustomLevels}
              onChange={(e) => setCfgCustomLevels(e.target.value)}
              placeholder="Ex: 2, 4, 8, 16, 32"
              disabled={isRunning}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs font-mono focus:border-success focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="text-[9px] text-muted-foreground mt-1">
              Opcional. Se vazio, usa progressão automática
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2 items-center">
          <Shield className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Valores geram a tabela automaticamente. Stake Inicial + Payout definem Entry 2 (Soros).
          </span>
          <Zap className="size-3.5 text-warning ml-auto" />
          <span className="text-xs text-warning font-semibold">Aplicado na próxima sessão</span>
        </div>
      </div>
    </PanelCard>
  );
}

function Stat({ title, value, big }: { title: string; value: string; big?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="text-[10px] text-muted-foreground tracking-widest">{title}</div>
      <div className={`font-bold text-success ${big ? "text-4xl" : "text-base"}`}>{value}</div>
    </div>
  );
}

function FinancePanel() {
  const { state } = useRobot();
  const totalOps = state.totalWins + state.totalLosses;
  const prejuizoAcumulado = state.operations
    .filter((o) => o.result === "loss" && o.status === "completed")
    .reduce((s, o) => s + Math.abs(o.profit), 0);

  const rows = [
    {
      k: "BANCA INICIAL",
      v: state.initialBankroll.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    {
      k: "BANCA ATUAL",
      v: state.currentBankroll.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      c: state.sessionProfit >= 0 ? "text-success" : "text-danger",
    },
    {
      k: "PREJUÍZO ACUMULADO",
      v: prejuizoAcumulado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      c: "text-danger",
    },
    {
      k: "LUCRO DA SESSÃO",
      v:
        (state.sessionProfit >= 0 ? "+" : "") +
        state.sessionProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      c: state.sessionProfit >= 0 ? "text-success" : "text-danger",
    },
    {
      k: "WIN RATE",
      v: `${state.winRate.toFixed(1)}%`,
      c: state.winRate >= 50 ? "text-success" : "text-danger",
    },
    { k: "NÚMERO DE OPERAÇÕES", v: String(totalOps) },
  ];

  return (
    <PanelCard
      icon={History}
      title="Histórico"
      description="Últimas operações executadas."
      status={<StatusBadge tone="neutral" label="VAZIO" />}
    >
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.k} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{r.k}</span>
            <span className={`font-mono font-semibold ${r.c ?? ""}`}>{r.v}</span>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 rounded border border-border text-xs font-semibold hover:bg-accent">
        EDITAR ESTRATÉGIA
      </button>
    </PanelCard>
  );
}

function HistoryPanel({
  onReplay,
}: {
  onReplay: (
    ctx: import("../modules/flow-continuity/types/replay-context.types").ReplayContext,
  ) => void;
}) {
  useEffect(() => {
    return () => console.log("[UNMOUNT] HistoryPanel");
  }, []);
  const { state } = useRobot();
  const { getToken } = useBroker();
  const store = useAnalystStore();
  const [trades, setTrades] = useState<
    Array<{
      id: string;
      asset: string;
      direction: string;
      amount: number;
      entryPrice: number;
      payout: number;
      status: string;
      profit: number;
      result: string;
      openedAt: number;
      expiresAt?: string;
      expiration?: number;
    }>
  >([]);

  // Cache para operações que ainda estão PENDING/ACTIVE e precisam de polling individual
  const pendingPollsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const buildHeaders = useCallback((): HeadersInit => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:3001/trades", { headers: buildHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.trades) {
          setTrades((prev) => {
            const resolvedMap = new Map(
              prev
                .filter((t) => t.result === "WIN" || t.result === "LOSS" || t.result === "DRAW")
                .map((t) => [t.id, t]),
            );
            return data.trades.map((t: (typeof prev)[0]) => {
              const resolved = resolvedMap.get(t.id);
              if (resolved && (t.result === "PENDING" || t.result === "ACTIVE" || !t.result)) {
                return {
                  ...t,
                  result: resolved.result,
                  status: resolved.status,
                  profit: resolved.profit,
                };
              }

              // Infere WIN/LOSS pelo profit se daemon ainda retorna PENDING
              let result = t.result ?? "";
              let status = t.status ?? "";
              if (result === "PENDING" || result === "ACTIVE" || result === "" || !result) {
                if (t.profit < 0) {
                  result = "LOSS";
                  status = "LOSS";
                } else if (t.profit > 0) {
                  result = "WIN";
                  status = "WIN";
                }
              }

              return { ...t, result, status };
            });
          });
        }
      }
    } catch (e) {
      console.warn("Falha ao buscar histórico:", e);
    }
  }, [buildHeaders]);

  // Poll individual para uma operação específica até resolver (WIN/LOSS/DRAW)
  const pollTradeUntilResolved = useCallback(
    async (tradeId: string, maxAttempts = 10) => {
      // Evita polling duplicado
      if (pendingPollsRef.current.has(tradeId)) return;

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`http://127.0.0.1:3001/trades/${tradeId}`, {
            headers: buildHeaders(),
          });
          if (res.ok) {
            const data = await res.json();
            const status = (data.status || data.result || "").toString().toUpperCase();

            if (status === "WIN" || status === "LOSS" || status === "DRAW") {
              // Resolveu! Atualiza o estado local
              setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, ...data } : t)));
              clearInterval(pollInterval);
              pendingPollsRef.current.delete(tradeId);
              return;
            }

            // Ainda ativo, atualiza status intermediário
            setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, ...data } : t)));
          }
        } catch (e) {
          console.warn(`Polling falhou para ${tradeId}:`, e);
        }

        // Para depois de maxAttempts (ex: 10 * 3s = 30s)
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          pendingPollsRef.current.delete(tradeId);
        }
      }, 3000);

      pendingPollsRef.current.set(tradeId, pollInterval);
    },
    [buildHeaders],
  );

  useEffect(() => {
    fetchTrades();
    // Polling a cada 5s para capturar WIN/LOSS rapidamente
    const interval = setInterval(fetchTrades, 5000);

    // Cleanup polling individual ao desmontar
    return () => {
      clearInterval(interval);
      pendingPollsRef.current.forEach((timer) => clearInterval(timer));
      pendingPollsRef.current.clear();
    };
  }, [fetchTrades]);

  // Mescla operações locais (já resolvidas) + servidor (PENDING/ACTIVE/WIN/LOSS)
  const allOps = (() => {
    const localOps = state.operations.map((o) => ({
      id: o.id,
      asset: o.asset,
      direction: o.direction,
      amount: o.amount,
      entryPrice: o.entryPrice ?? 0,
      payout: o.payout ?? 0,
      status:
        o.status === "completed"
          ? o.result === "win"
            ? "WIN"
            : o.result === "draw"
              ? "DRAW"
              : "LOSS"
          : o.status.toUpperCase(),
      profit: o.profit,
      result: o.result ?? "",
      openedAt: o.openedAt ?? 0,
      expiresAt: undefined as string | undefined,
      expiration: undefined as number | undefined,
    }));
    const localById = new Map(localOps.map((o) => [o.id, o]));

    const serverOps = trades
      .filter((t) => !localById.has(t.id))
      .map((t) => {
        let status =
          t.result && t.result !== "" && t.result !== "PENDING" && t.result !== "ACTIVE"
            ? t.result.toUpperCase().replace("WON", "WIN").replace("LOST", "LOSS")
            : (t.status?.toUpperCase().replace("WON", "WIN").replace("LOST", "LOSS") ?? "PENDING");

        // Se o daemon ainda retorna PENDING mas o profit já veio, infere o resultado
        if (
          (status === "PENDING" || status === "ACTIVE") &&
          t.profit !== undefined &&
          t.profit !== null
        ) {
          if (t.profit < 0) status = "LOSS";
          else if (t.profit > 0) status = "WIN";
        }

        // Se ainda está PENDING/ACTIVE, inicia polling individual
        if (status === "PENDING" || status === "ACTIVE") {
          pollTradeUntilResolved(t.id);
        }

        // Calcula profit se o daemon retornou resultado mas não calculou o valor
        let profit = t.profit ?? 0;
        if (profit === 0 && t.amount) {
          if (status === "WIN") {
            profit = +(t.amount * (t.payout ?? 0.85)).toFixed(2);
          } else if (status === "LOSS") {
            profit = -t.amount;
          }
        }

        return {
          id: t.id,
          asset: t.asset,
          direction: (t.direction ?? "").toLowerCase(),
          amount: t.amount,
          entryPrice: t.entryPrice ?? 0,
          payout: t.payout ?? 0,
          status,
          profit,
          result: status !== "PENDING" && status !== "ACTIVE" ? status : (t.result ?? ""),
          openedAt: t.openedAt ?? 0,
          expiresAt: t.expiresAt,
          expiration: t.expiration,
        };
      });

    // Deduplica: mesma asset + direction + amount + result = mesmo trade
    const seen = new Set<string>();
    const all = [...localOps, ...serverOps].filter((o) => {
      // Normaliza openedAt para segundos para evitar falsos duplicados por ms
      const key = `${o.asset}|${o.direction}|${o.amount}|${o.result || o.status}|${Math.floor((o.openedAt as number) / 1000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return all
      .sort((a, b) => ((b.openedAt ?? 0) as number) - ((a.openedAt ?? 0) as number))
      .slice(0, 8);
  })();

  const safeDate = (v: unknown): Date | null => {
    if (v == null) return null;
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? null : d;
  };

  const fmtTime = (ts: unknown) => {
    const d = safeDate(ts);
    return d
      ? d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";
  };

  const getCloseTime = (op: (typeof allOps)[0]) => {
    if (op.expiresAt) {
      const d = safeDate(op.expiresAt);
      if (d)
        return d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
    if (op.expiration && op.openedAt)
      return fmtTime((op.openedAt as number) + (op.expiration as number) * 1000);
    if (op.openedAt) return fmtTime((op.openedAt as number) + 60000);
    return "—";
  };

  const getStatusLabel = (status: string, result: string) => {
    const s = status.toUpperCase().replace("WON", "WIN").replace("LOST", "LOSS");
    const r = (result || "").toUpperCase().replace("WON", "WIN").replace("LOST", "LOSS");
    if (r === "WIN" || s === "WIN") return "WIN";
    if (r === "LOSS" || s === "LOSS") return "LOSS";
    if (r === "DRAW" || s === "DRAW") return "DRAW";
    if (s === "ACTIVE") return "ATIVA";
    return "PENDENTE";
  };

  const getStatusColor = (status: string, result: string) => {
    const label = getStatusLabel(status, result);
    if (label === "WIN") return "text-success font-bold";
    if (label === "LOSS") return "text-danger font-bold";
    if (label === "DRAW") return "text-muted-foreground font-semibold";
    return "text-warning font-semibold animate-pulse";
  };

  return (
    <PanelCard
      icon={TrendingUp}
      title="Performance"
      description="Métricas de desempenho acumulado."
      status={<StatusBadge tone="info" label="MONITORANDO" />}
    >
      {/* Cabeçalho */}
      <div className="grid grid-cols-8 gap-1 text-[10px] text-muted-foreground tracking-widest px-3 pb-2 border-b border-border">
        <span>ENTRADA</span>
        <span>FECHAMENTO</span>
        <span>PAR</span>
        <span>DIREÇÃO</span>
        <span>RESULTADO</span>
        <span className="text-right">VALOR</span>
        <span className="text-right">LUCRO</span>
        <span className="text-center">REPLAY</span>
      </div>
      <div className="space-y-1 mt-2">
        {allOps.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Nenhuma operação ainda
          </div>
        )}
        {allOps.map((op) => {
          const statusLabel = getStatusLabel(op.status, op.result);
          const isPending = statusLabel === "ATIVA" || statusLabel === "PENDENTE";
          const fmt =
            (op.profit >= 0 ? "+" : "") +
            op.profit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const fmtAmount = op.amount.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          });
          return (
            <div
              key={op.id}
              className={`grid grid-cols-8 gap-1 text-xs items-center rounded px-3 py-2 ${
                isPending
                  ? "bg-warning/5 border border-warning/20"
                  : statusLabel === "WIN"
                    ? "bg-success/5 border border-success/10"
                    : statusLabel === "LOSS"
                      ? "bg-danger/5 border border-danger/10"
                      : "bg-secondary/30"
              }`}
            >
              <span className="text-muted-foreground font-mono text-[10px]">
                {fmtTime(op.openedAt)}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {getCloseTime(op)}
              </span>
              <span className="truncate">{op.asset}</span>
              <span
                className={
                  op.direction?.toUpperCase() === "CALL"
                    ? "text-success font-semibold"
                    : "text-danger font-semibold"
                }
              >
                {op.direction?.toUpperCase() ?? "—"}
              </span>
              <span
                className={
                  statusLabel === "WIN"
                    ? "text-success"
                    : statusLabel === "DRAW"
                      ? "text-muted-foreground"
                      : "text-danger"
                }
              >
                {statusLabel}
              </span>
              <span className="text-right font-mono text-[10px] text-muted-foreground">
                {fmtAmount}
              </span>
              <span
                className={`text-right font-mono font-semibold ${op.result === "draw" ? "text-muted-foreground" : op.profit >= 0 ? "text-success" : "text-danger"}`}
              >
                {fmt}
              </span>
              <span className="text-center">
                {!isPending ? (
                  <button
                    onClick={() => {
                      const match =
                        store.replayHistory.find(
                          (r) => r.operationContext.timestamp === op.openedAt,
                        ) || store.replayContext;
                      if (match) onReplay(match);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                      store.replayHistory.some((r) => r.operationContext.timestamp === op.openedAt)
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                    title="Assistir replay"
                  >
                    ▶
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

function PerformancePanel() {
  useEffect(() => {
    return () => console.log("[UNMOUNT] PerformancePanel");
  }, []);
  const { state } = useRobot();
  const totalOps = state.totalWins + state.totalLosses + state.totalDraws;

  // Generate performance points from real operations
  const points = (() => {
    if (state.operations.length === 0) {
      return Array.from({ length: 25 })
        .map((_, i) => {
          const y = 120 - (Math.sin(i / 3) * 20 + i * 3);
          return `${i * 20},${Math.max(20, Math.min(140, y))}`;
        })
        .join(" ");
    }
    const completedOps = [...state.operations]
      .filter((o) => o.status === "completed")
      .sort((a, b) => (a.openedAt?.getTime?.() ?? 0) - (b.openedAt?.getTime?.() ?? 0));
    let cumulative = 0;
    const step = Math.max(1, Math.floor(completedOps.length / 24));
    const dataPoints = completedOps.filter(
      (_, i) => i % step === 0 || i === completedOps.length - 1,
    );
    if (dataPoints.length < 2) {
      return Array.from({ length: 25 })
        .map((_, i) => `${i * 20},80`)
        .join(" ");
    }
    const values = dataPoints.map((op) => {
      cumulative += op.profit;
      return cumulative;
    });
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 500;
        const y = 140 - ((v - minVal) / range) * 120;
        return `${Math.round(x)},${Math.round(Math.max(20, Math.min(140, y)))}`;
      })
      .join(" ");
  })();

  const profitFmt = state.sessionProfit.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <PanelCard
      icon={TrendingUp}
      title="Desempenho do Dia"
      description="Resultado financeiro da sessão."
      status={<StatusBadge tone="info" label="SESSÃO" />}
    >
      <svg viewBox="0 0 500 160" className="w-full h-40">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.19 155)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.78 0.19 155)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 70, 110].map((y) => (
          <line
            key={y}
            x1="0"
            x2="500"
            y1={y}
            y2={y}
            stroke="oklch(0.3 0.03 220)"
            strokeDasharray="2 4"
          />
        ))}
        <polygon points={`0,160 ${points} 500,160`} fill="url(#grad)" />
        <polyline points={points} fill="none" stroke="oklch(0.78 0.19 155)" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
        <span>00:00</span>
        <span>04:00</span>
        <span>08:00</span>
        <span>12:00</span>
        <span>16:00</span>
        <span>20:00</span>
        <span>24:00</span>
      </div>
    </PanelCard>
  );
}

function NewOperationModal({
  activeOperation,
  onClose,
  onCancel,
}: {
  activeOperation: RobotOperation | null;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { engine, state: robotState } = useRobot();
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => console.log("[UNMOUNT] NewOperationModal");
  }, []);

  useEffect(() => {
    if (!activeOperation) return;

    const expirationMs = (activeOperation.expirationSeconds ?? 60) * 1000;

    const calculateRemainingTime = () => {
      const openedAt = new Date(activeOperation.openedAt).getTime();
      if (!openedAt) return 0;
      const endTime = openedAt + expirationMs;
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      return Math.round(remainingMs / 1000);
    };

    setRemainingTime(calculateRemainingTime());

    countdownInterval.current = setInterval(() => {
      const calculated = calculateRemainingTime();
      setRemainingTime(calculated);
      if (calculated <= 0) {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        countdownInterval.current = null;
        onClose();
      }
    }, 1000);

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
        countdownInterval.current = null;
      }
    };
  }, [activeOperation, onClose]);

  if (!activeOperation) return null;

  const pct = (remainingTime / 60) * 100;
  const r = 54;
  const C = 2 * Math.PI * r;
  const isSuccessful = activeOperation.result === "win";
  const isActive = activeOperation.status === "active";

  const totalLatency =
    (activeOperation.profit ?? 0) > 0 ? (activeOperation.profit / activeOperation.amount) * 100 : 0;

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg shadow-2xl hover:bg-accent/50 transition-colors"
        >
          <div className={`size-2 rounded-full ${isActive ? "bg-warning animate-pulse" : isSuccessful ? "bg-success" : "bg-danger"}`} />
          <div className="text-left">
            <div className="text-xs font-bold">{activeOperation.asset} {activeOperation.direction.toUpperCase()}</div>
            <div className="text-[10px] text-muted-foreground">R${(activeOperation.amount || 0).toFixed(2)} • Clique para expandir</div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm ${isExpanded ? "p-4" : ""}`}>
      <div className={`panel p-5 shadow-2xl glow-success transition-all duration-200 ${
        isExpanded ? "w-full max-w-4xl h-[85vh] overflow-y-auto" : "w-[420px]"
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold tracking-wide">LIVE OPERATION</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Minimizar"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              title={isExpanded ? "Restaurar" : "Expandir"}
            >
              {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger/20 text-muted-foreground hover:text-danger transition-colors" title="Fechar">
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ASSET</div>
            <div className="text-sm font-bold mt-1">
              🇪🇺 {activeOperation.asset} <span className="text-success text-[10px]">OTC</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div
              className={
                isSuccessful
                  ? "text-sm font-bold text-success mt-1"
                  : isActive
                    ? "text-sm font-bold text-warning mt-1"
                    : "text-sm font-bold text-danger mt-1"
              }
            >
              {isSuccessful ? "WON" : isActive ? "OPEN" : "PENDING"}
            </div>
            <div className="flex gap-1 mt-1">
              {isSuccessful ? (
                <>
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  <span className="size-1.5 rounded-full bg-success/60" />
                  <span className="size-1.5 rounded-full bg-success/30" />
                </>
              ) : isActive ? (
                <>
                  <span className="size-1.5 rounded-full bg-warning animate-pulse" />
                  <span className="size-1.5 rounded-full bg-warning/60" />
                  <span className="size-1.5 rounded-full bg-warning/30" />
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-danger animate-pulse" />
                  <span className="size-1.5 rounded-full bg-danger/60" />
                  <span className="size-1.5 rounded-full bg-danger/30" />
                </>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ENTRY AMOUNT</div>
            <div className="text-sm font-bold mt-1">
              R${(activeOperation.amount || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">DIRECTION</div>
              <div
                className="text-sm font-bold flex items-center gap-1 mt-1"
                style={{
                  color: activeOperation.direction === "call" ? "var(--success)" : "var(--danger)",
                }}
              >
                {activeOperation.direction === "call" ? (
                  <ArrowUp className="size-4" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
                {activeOperation.direction.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">TIMEFRAME</div>
              <div className="text-sm font-bold mt-1">
                {activeOperation.timeframe ||
                  robotState.selectedTimeframe ||
                  robotState.config.timeframes[0] ||
                  "M1"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EXPIRAÇÃO</div>
              <div className="text-sm font-bold mt-1">
                {(() => {
                  const expSec = activeOperation.expirationSeconds ?? 60;
                  if (expSec <= 60) return "1 MINUTO";
                  if (expSec <= 300) return "5 MINUTOS";
                  return "15 MINUTOS";
                })()}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative size-32">
              <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  stroke="oklch(0.3 0.03 220)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  stroke={remainingTime < 30 ? "oklch(0.78 0.19 155)" : "oklch(0.78 0.19 155)"}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={C}
                  strokeDashoffset={C - (C * pct) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground tracking-widest">
                  TEMPO RESTANTE
                </div>
                <div
                  className="text-2xl font-bold font-mono"
                  style={{ color: remainingTime < 30 ? "var(--warning)" : "var(--success)" }}
                >
                  00:{String(remainingTime).padStart(2, "0")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">PAYOUT</div>
            <div className="text-success font-bold">
              {Math.round((robotState.config.payout ?? 0.85) * 100)}%
            </div>
          </div>
          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">RETORNO</div>
            <div
              className={`text-success font-bold ${activeOperation.profit && activeOperation.profit > 0 ? "text-success" : activeOperation.profit && activeOperation.profit < 0 ? "text-danger" : "text-warning"}`}
            >
              {activeOperation.profit > 0 ? "+" : ""} R$
              {Math.abs(activeOperation.profit || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">NÍVEL</div>
            <div
              className="font-bold mt-1"
              style={{
                color:
                  (robotState.currentRecoveryStep ?? activeOperation.recoveryStep) <
                  (robotState.config.maxLevel ?? 15) / 2
                    ? "var(--success)"
                    : (robotState.currentRecoveryStep ?? activeOperation.recoveryStep) <
                        (robotState.config.maxLevel ?? 15) * 0.75
                      ? "var(--warning)"
                      : "var(--danger)",
              }}
            >
              {robotState.currentRecoveryStep ?? activeOperation.recoveryStep}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ENTRADA</div>
            <div
              className="font-bold mt-1"
              style={{
                color:
                  (engine?.getSmartRecovery()?.getState()?.entryNumber ??
                    activeOperation.entryNumber) === 2
                    ? "var(--warning)"
                    : "var(--success)",
              }}
            >
              {robotState.entryNumber ?? activeOperation.entryNumber}/
              {robotState.config.maxLevel ?? 15}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">SCORE</div>
            <div
              className="font-bold mt-1"
              style={{
                color:
                  (robotState.lastAnalysis?.probability?.total ?? 0) >= 85
                    ? "var(--success)"
                    : (robotState.lastAnalysis?.probability?.total ?? 0) >= 70
                      ? "var(--warning)"
                      : "var(--danger)",
              }}
            >
              {robotState.lastAnalysis?.probability?.total || 92}
            </div>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-md border border-danger/50 text-danger font-semibold text-xs tracking-widest hover:bg-danger/10"
        >
          CANCELAR OPERAÇÃO
        </button>
      </div>
    </div>
  );
}
