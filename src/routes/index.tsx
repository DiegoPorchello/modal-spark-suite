import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { useBroker } from "../hooks/useBroker";
import { useRobot } from "../hooks/useRobot";
import { useAnalystStore } from "../modules/analyst/AnalystStore";
import { AnalystPanel } from "../modules/analyst/AnalystPanel";
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
  User,
  Check,
  Circle,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  X,
  Moon,
  Sun,
  Palette,
  Volume2,
  VolumeX,
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
} from "lucide-react";
import { CriticalErrorModal } from "../components/ui/CriticalErrorModal";
import type {
  RobotEvent,
  RobotOperation,
  RobotStatus,
  RobotConfig,
} from "../engine/flow-robot-engine";

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
  { section: "OPERAÇÕES", items: [{ key: "historico", label: "Histórico", icon: History }] },
  {
    section: "GERENCIAMENTO",
    items: [{ key: "calc", label: "Calculadora Sorosgale", icon: Calculator }],
  },
  { section: "BACKTEST", items: [{ key: "backtest", label: "Simulador", icon: FlaskConical }] },
  { section: "INTEGRAÇÕES", items: [{ key: "puma", label: "Puma Broker", icon: Plug }] },
  { section: "CONFIGURAÇÕES", items: [{ key: "config", label: "Configurações", icon: Settings }] },
  { section: "AJUDA", items: [{ key: "ajuda", label: "Suporte", icon: HelpCircle }] },
];

function Dashboard() {
  const [active, setActive] = useState<NavKey>("fluxo");
  const [timeframes, setTimeframes] = useState<("M1" | "M5" | "M15")[]>(["M1"]);
  const [now, setNow] = useState<Date>(new Date());
  const [seconds, setSeconds] = useState<number>(0);
  const [chartTab, setChartTab] = useState<"grafico" | "estrutura">("grafico");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
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
                return (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
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
                            <Clock className="size-4 text-blue-400 mt-0.5 shrink-0" />
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
          {/* Top metrics row - acima do broker */}
          <section className="flex gap-4 flex-wrap">
            <Metric label="ATIVO OPERADO" value="EUR/USD" flag="🇪🇺" sub="" />
            <Metric label="TIMEFRAME" value="M1" sub="Expiração 1 min" />
            <Metric label="SCORE ATUAL" value="92" badge="PREMIUM" />
            <Metric label="PROBABILIDADE" value="87%" sub="Alta" accent />
            <Metric label="PAYOUT ATUAL" value="87%" accent />
            <Metric label="LUCRO DA SESSÃO" value="R$ 231,45" sub="+18,47%" accent />
            <Metric label="WINS / LOSS" value="19 / 7" sub="73%" accent />
            <Metric label="STATUS DO ROBÔ" value="OPERANDO" sub="Automático" status />
          </section>
          {/* Robot Controls */}
          <section className="p-4 panel flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground">
                CONTROLE DO ROBÔ
              </span>
              <RobotControls />
            </div>
          </section>

          {/* FLUXO DE CONTINUIDADE PRO - Configuração de Ativos */}
          {active === "config-ativos" && <AssetsConfigPanel />}

          {/* Broker + Financeiro + Historico */}
          <section className="grid grid-cols-12 gap-4">
            <BrokerCard />
            <FinancePanel />
            <HistoryPanel />
          </section>

          {/* Analysis row */}
          <section className="grid grid-cols-12 gap-4">
            <AnalysisPanel chartTab={chartTab} setChartTab={setChartTab} />
          </section>

          {/* Calculator row */}
          <section className="grid grid-cols-12 gap-4">
            <CalcPanel />
          </section>

          {/* Ranking row */}
          <section className="grid grid-cols-12 gap-4">
            <RankingPanel />
          </section>

          {/* Status bar */}
          <section className="grid grid-cols-12 gap-4">
            <PerformancePanel />
          </section>
        </main>

        {/* Analyst Panel (Nexor AI) */}
        <AnalystPanel store={store} robotState={robotState} />

        {/* Footer status */}
        <footer className="h-10 border-t border-border bg-panel flex items-center px-5 text-[11px] text-muted-foreground gap-6">
          <span className="flex items-center gap-2 text-success">
            <span className="size-2 rounded-full bg-success" /> ROBO ATIVO
          </span>
          <span>
            PRÓXIMA ANÁLISE: <span className="text-foreground font-mono">00:05</span>
          </span>
          <span>
            MODO: <span className="text-foreground">AUTOMÁTICO</span>
          </span>
          <span>
            GERENCIAMENTO: <span className="text-success">SOROSGALE ●</span>
          </span>
          <span className="ml-auto">
            CONEXÃO: <span className="text-foreground">PUMA BROKER</span>
          </span>
        </footer>
      </div>

      {/* Modal de operação ativa */}
      <NewOperationModal
        activeOperation={robotState.activeOperation}
        onClose={() => setModalOpen(false)}
        onCancel={() => {}}
      />
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function BrokerCard() {
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
      <div className="panel col-span-2 p-4">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          CONEXÃO PUMA BROKER
        </div>
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
      </div>
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
      <div className="panel col-span-2 p-4">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
          CONEXÃO PUMA BROKER
        </div>
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
      </div>
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
    <div className="panel col-span-2 p-4">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
        CONEXÃO PUMA BROKER
      </div>
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
    </div>
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
      setTimeout(() => setSaved(false), 2000);
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
    <section className="panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider text-foreground flex items-center gap-2">
          <ListFilter className="size-4 text-success" />
          CONFIGURAÇÃO DE ATIVOS PARA OPERAÇÃO
        </h3>
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
      </div>

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
    </section>
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

function Metric({
  label,
  value,
  sub,
  badge,
  flag,
  accent,
  status,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  flag?: string;
  accent?: boolean;
  status?: boolean;
}) {
  return (
    <div
      className={`panel flex-1 min-w-0 p-3 border-l-[3px] ${accent ? "border-l-success" : status ? "border-l-success" : "border-l-border"}`}
    >
      <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
        {flag && <span className="text-sm">{flag}</span>}
        {label}
      </div>
      <div className="flex items-center gap-2">
        {status && <span className="size-2.5 rounded-full bg-success animate-pulse shrink-0" />}
        <span
          className={`text-lg font-extrabold tracking-tight truncate ${accent && value.startsWith("+") ? "text-success" : accent && value.startsWith("-") ? "text-danger" : accent || status ? "text-success" : "text-foreground"}`}
        >
          {value}
        </span>
        {badge && (
          <span className="text-[10px] bg-success/15 text-success px-2 py-0.5 rounded-full font-bold tracking-wider shrink-0">
            {badge}
          </span>
        )}
      </div>
      {sub && (
        <div
          className={`text-[11px] mt-1.5 font-medium ${sub.startsWith("+") ? "text-success" : sub.startsWith("-") ? "text-danger" : "text-muted-foreground"}`}
        >
          {sub}
        </div>
      )}
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const scoreItems = [
    { label: "Continuidade", value: "38/40" },
    { label: "Dominância", value: "22/25" },
    { label: "Força do Candle", value: "14/15" },
    { label: "Estrutura (S/R)", value: "8/10" },
    { label: "Histórico (Catálogo)", value: "10/10" },
  ];
  const filters = [
    { label: "Continuidade", ok: true },
    { label: "Força do Candle", ok: true },
    { label: "Distância de S/R", ok: true },
    { label: "Lateralização", ok: false },
    { label: "Rompimento", ok: true },
    { label: "Horário Favorável", ok: true },
  ];

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
    setTimeout(() => setSaved(false), 2000);
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="panel col-span-12 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="size-4 text-success" />
        <h3 className="text-sm font-semibold tracking-wide">
          ANÁLISE DO ROBÔ - FLUXO DE CONTINUIDADE PRO
        </h3>
      </div>
      <div className="grid grid-cols-12 gap-4">
        {/* Motor de Score */}
        <div className="col-span-4">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
            MOTOR DE SCORE
          </div>
          <div className="space-y-2">
            {scoreItems.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <Check className="size-3 text-success" />
                  {s.label}
                </span>
                <span className="font-mono text-success">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">SCORE FINAL</span>
              <span className="font-mono">
                <span className="text-success font-bold text-base">92</span> / 100
              </span>
            </div>
            <div className="flex justify-between items-center text-xs mt-3">
              <span className="text-muted-foreground">CLASSIFICAÇÃO</span>
              <span className="bg-success/15 text-success px-2 py-1 rounded text-[10px] font-bold tracking-wider">
                PREMIUM
              </span>
            </div>
          </div>

          {/* Configuração do Robô */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] tracking-widest text-muted-foreground">
                CONFIGURAÇÃO DO ROBÔ
              </div>
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
                    <Loader2 className="size-3.5 animate-spin" /> SALVANDO...
                  </>
                ) : saved ? (
                  <>
                    <Check className="size-3.5" /> SALVO
                  </>
                ) : (
                  "SALVAR CONFIG"
                )}
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">META DE LUCRO</div>
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
                  <div className="text-[10px] text-muted-foreground">COOLDOWN PÓS-LOSS</div>
                  <div className="font-mono text-warning font-bold">
                    {state.config.assetCooldownMinutes} min
                  </div>
                </div>
                <div className="bg-secondary/40 rounded p-2">
                  <div className="text-[10px] text-muted-foreground">INTERVALO DE ANÁLISE</div>
                  <div className="font-mono text-blue-400 font-bold">
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
                  MODO: {state.config.scanMode === "multi" ? "MULTI-ASSET" : "SINGLE"}
                </span>
                <span
                  className={`px-2 py-1 rounded text-[10px] font-medium ${
                    state.config.autoDirection
                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {state.config.autoDirection ? "AUTO DIREÇÃO" : "DIREÇÃO FIXA"}
                </span>
                <span className="px-2 py-1 rounded text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                  EXPIRAÇÃO: {state.config.expirationSeconds}s
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
          <div className="text-[10px] text-muted-foreground mb-2">EUR/USD OTC · M1</div>
          <CandleChart />
        </div>

        {/* Filters */}
        <div className="col-span-3">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">
            FILTROS ATIVOS
          </div>
          <div className="space-y-2">
            {filters.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2"
              >
                <span className="text-foreground/90">{f.label}</span>
                {f.ok ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <X className="size-3.5 text-danger" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-2">STATUS</div>
            <div className="text-xs font-semibold text-warning">Aguardando</div>
            <div className="text-[10px] text-muted-foreground mt-1">Confirmação da entrada</div>
          </div>
        </div>
      </div>
    </div>
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
  const rows = [
    { rank: 1, asset: "EUR/USD OTC", flag: "🇪🇺", score: 92, wr: "73%", ops: 26 },
    { rank: 2, asset: "GBP/USD OTC", flag: "🇬🇧", score: 89, wr: "69%", ops: 23 },
    { rank: 3, asset: "USD/JPY OTC", flag: "🇯🇵", score: 86, wr: "67%", ops: 21 },
    { rank: 4, asset: "AUD/USD OTC", flag: "🇦🇺", score: 83, wr: "62%", ops: 18 },
    { rank: 5, asset: "BTC/USDT OTC", flag: "₿", score: 81, wr: "65%", ops: 20 },
    { rank: 6, asset: "GOLD OTC", flag: "🥇", score: 79, wr: "61%", ops: 16 },
    { rank: 7, asset: "ETH/USDT OTC", flag: "Ξ", score: 76, wr: "58%", ops: 19 },
    { rank: 8, asset: "EUR/GBP OTC", flag: "🇪🇺", score: 74, wr: "57%", ops: 14 },
    { rank: 9, asset: "USD/CHF OTC", flag: "🇨🇭", score: 72, wr: "55%", ops: 12 },
    { rank: 10, asset: "NZD/USD OTC", flag: "🇳🇿", score: 70, wr: "53%", ops: 15 },
  ];
  return (
    <div className="panel col-span-12 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="size-4 text-success" />
          RANKING DE ATIVOS (M1)
        </h3>
        <span className="text-[10px] text-muted-foreground">Atualizado: 09:42:18</span>
      </div>
      <div className="text-[10px] text-muted-foreground grid grid-cols-12 gap-1 px-2 pb-2 border-b border-border tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-4">ATIVO</span>
        <span className="col-span-2 text-right">SCORE</span>
        <span className="col-span-2 text-right">WIN RATE</span>
        <span className="col-span-2 text-right">OPERAÇÕES</span>
        <span className="col-span-1 text-right">STATUS</span>
      </div>
      <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
        {rows.map((r) => (
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
    </div>
  );
}

function CalcPanel() {
  const { engine, state } = useRobot();
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
  const meta = state.config.targetProfit;
  const stop = state.config.stopLoss;

  return (
    <div className="panel col-span-12 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Calculator className="size-4 text-success" />
        CALCULADORA SOROSGALE - NÍVEL ATUAL
      </h3>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3 space-y-3">
          <Stat title="NÍVEL ATUAL" value={String(nivelAtual)} big />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ESTRATÉGIA</div>
            <div className="text-xs font-semibold">Sorosgale Fracionado</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div
              className={`text-xs flex items-center gap-1 ${state.status === "running" ? "text-success" : "text-muted-foreground"}`}
            >
              <span
                className={`size-1.5 rounded-full ${state.status === "running" ? "bg-success" : "bg-muted-foreground"}`}
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
                    Inicie o robô para gerar a tabela
                  </td>
                </tr>
              )}
              {tableRows.map((l) => {
                const isActive = l.level === nivelAtual;
                const e1 = l.entry1.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                const e2 = l.entry2.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
    </div>
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
    <div className="panel col-span-2 p-4">
      <h3 className="text-sm font-semibold mb-3">RESUMO FINANCEIRO</h3>
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
    </div>
  );
}

function HistoryPanel() {
  const { state } = useRobot();
  const { getToken } = useBroker();
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
                return { ...t, result: resolved.result, status: resolved.status, profit: resolved.profit };
              }

              // Infere WIN/LOSS pelo profit se daemon ainda retorna PENDING
              let result = t.result ?? "";
              let status = t.status ?? "";
              if (result === "PENDING" || result === "ACTIVE" || result === "" || !result) {
                if (t.profit < 0) { result = "LOSS"; status = "LOSS"; }
                else if (t.profit > 0) { result = "WIN"; status = "WIN"; }
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
            ? t.result.toUpperCase()
            : (t.status?.toUpperCase() ?? "PENDING");

        // Se o daemon ainda retorna PENDING mas o profit já veio, infere o resultado
        if ((status === "PENDING" || status === "ACTIVE") && t.profit !== undefined && t.profit !== null) {
          if (t.profit < 0) status = "LOSS";
          else if (t.profit > 0) status = "WIN";
        }

        // Se ainda está PENDING/ACTIVE, inicia polling individual
        if (status === "PENDING" || status === "ACTIVE") {
          pollTradeUntilResolved(t.id);
        }

        return {
          id: t.id,
          asset: t.asset,
          direction: t.direction,
          amount: t.amount,
          entryPrice: t.entryPrice ?? 0,
          payout: t.payout ?? 0,
          status,
          profit: t.profit ?? 0,
          result: status !== "PENDING" && status !== "ACTIVE" ? status : (t.result ?? ""),
          openedAt: t.openedAt ?? 0,
          expiresAt: t.expiresAt,
          expiration: t.expiration,
        };
      });

    return [...localOps, ...serverOps]
      .sort((a, b) => ((b.openedAt ?? 0) as number) - ((a.openedAt ?? 0) as number))
      .slice(0, 8);
  })();

  const fmtTime = (ts: number) =>
    ts
      ? new Date(ts).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";

  const getCloseTime = (op: (typeof allOps)[0]) => {
    if (op.expiresAt) {
      const d = new Date(op.expiresAt);
      if (!isNaN(d.getTime()))
        return d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
    }
    if (op.expiration && op.openedAt) return fmtTime(op.openedAt + op.expiration * 1000);
    if (op.openedAt) return fmtTime(op.openedAt + 60000); // fallback M1
    return "—";
  };

  const getStatusLabel = (status: string, result: string) => {
    const s = status.toUpperCase();
    const r = (result || "").toUpperCase();
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
    <div className="panel col-span-8 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">HISTÓRICO RECENTE</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">{allOps.length} op.</span>
          <button onClick={fetchTrades} className="text-[10px] text-success hover:underline">
            ATUALIZAR
          </button>
        </div>
      </div>
      {/* Cabeçalho */}
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground tracking-widest px-3 pb-2 border-b border-border">
        <span>ENTRADA</span>
        <span>FECHAMENTO</span>
        <span>PAR</span>
        <span>DIREÇÃO</span>
        <span>RESULTADO</span>
        <span className="text-right">VALOR</span>
        <span className="text-right">LUCRO</span>
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
              className={`grid grid-cols-7 gap-1 text-xs items-center rounded px-3 py-2 ${
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
                  op.direction === "CALL"
                    ? "text-success font-semibold"
                    : "text-danger font-semibold"
                }
              >
                {op.direction}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PerformancePanel() {
  // Simple area line
  const points = Array.from({ length: 25 })
    .map((_, i) => {
      const y = 120 - (Math.sin(i / 3) * 20 + i * 3);
      return `${i * 20},${Math.max(20, Math.min(140, y))}`;
    })
    .join(" ");
  return (
    <div className="panel col-span-12 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">DESEMPENHO DO DIA</h3>
        <div className="flex gap-6 text-xs">
          <div>
            <span className="text-muted-foreground">Lucro </span>
            <span className="text-success font-bold">R$ 231,45</span>
          </div>
          <div>
            <span className="text-muted-foreground">Operações </span>
            <span className="font-bold">26</span>
          </div>
          <div>
            <span className="text-muted-foreground">Win Rate </span>
            <span className="text-success font-bold">73%</span>
          </div>
        </div>
      </div>
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
    </div>
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
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!activeOperation) return;

    const calculateRemainingTime = () => {
      const openedAt = new Date(activeOperation.openedAt).getTime();
      if (!openedAt) return 0;
      const endTime = openedAt + 60000;
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      return Math.round(remainingMs / 1000);
    };

    setRemainingTime(calculateRemainingTime());

    countdownInterval.current = setInterval(() => {
      const calculated = calculateRemainingTime();
      setRemainingTime(calculated);
      if (calculated <= 0) {
        clearInterval(countdownInterval.current);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="panel w-[420px] p-5 shadow-2xl glow-success">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold tracking-wide">OPERAÇÃO EM TEMPO REAL</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ATIVO</div>
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
              {isSuccessful ? "GANHOU" : isActive ? "ABERTO" : "PENDENTE"}
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
            <div className="text-[10px] text-muted-foreground tracking-widest">
              VALOR DA ENTRADA
            </div>
            <div className="text-sm font-bold mt-1">
              R${(activeOperation.amount || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">DIREÇÃO</div>
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
                {robotState.selectedTimeframe || robotState.config.timeframes[0] || "M1"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EXPIRAÇÃO</div>
              <div className="text-sm font-bold mt-1">
                {robotState.config.timeframes.includes("M5") ||
                robotState.config.timeframes.includes("M1")
                  ? "1 MINUTO"
                  : "5 MINUTOS"}
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
              {(engine?.getSmartRecovery()?.getConfig()?.payout ?? 0.85) * 100}%
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
                  (engine?.getSmartRecovery()?.getState()?.currentLevel ??
                    activeOperation.recoveryStep) <
                  (engine?.getSmartRecovery()?.getConfig()?.maxLevel ?? 15) / 2
                    ? "var(--success)"
                    : (engine?.getSmartRecovery()?.getState()?.currentLevel ??
                          activeOperation.recoveryStep) <
                        (engine?.getSmartRecovery()?.getConfig()?.maxLevel ?? 15) * 0.75
                      ? "var(--warning)"
                      : "var(--danger)",
              }}
            >
              {engine?.getSmartRecovery()?.getState()?.currentLevel ?? activeOperation.recoveryStep}
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
              {engine?.getSmartRecovery()?.getState()?.entryNumber ?? activeOperation.entryNumber}/
              {engine?.getSmartRecovery()?.getConfig()?.maxLevel ?? 15}
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
