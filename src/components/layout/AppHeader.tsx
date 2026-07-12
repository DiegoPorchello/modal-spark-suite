import { useState, useEffect } from "react";
import {
  Menu,
  Bell,
  Maximize2,
  Minimize2,
  User,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Zap,
  Settings,
} from "lucide-react";

import { AppSettingsPanel } from "./AppSettingsPanel";

interface AppHeaderProps {
  onToggleSidebar: () => void;
  connected: boolean;
  robotState: {
    config: {
      timeframes: string[];
      autoDirection: boolean;
      assets: string[];
      scanMode: string;
    };
    currentSession: string;
  };
  now: Date | null;
  onTimeframeChange: (tf: "M1" | "M5" | "M15") => void;
  onToggleAutoDirection: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  userName: string | null;
  accountType: string | undefined;
  notifications: { id: number; type: string; message: string; time: Date }[];
  onClearNotifications: () => void;
}

export function AppHeader({
  onToggleSidebar,
  connected,
  robotState,
  now,
  onTimeframeChange,
  onToggleAutoDirection,
  soundEnabled,
  onToggleSound,
  userName,
  accountType,
  notifications,
  onClearNotifications,
}: AppHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const unreadCount = notifications.length;

  return (
    <>
      <header className="h-16 border-b border-border bg-panel flex items-center px-5 gap-4">
        <button
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent/40 transition-colors"
          title="Toggle sidebar"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex gap-2">
          {(["M1", "M5", "M15"] as const).map((t) => {
            const active = robotState.config.timeframes?.includes(t);
            return (
              <button
                key={t}
                onClick={() => onTimeframeChange(t)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? "bg-success text-success-foreground shadow-md shadow-success/20"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <button
          onClick={onToggleAutoDirection}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide border transition-all ${
            robotState.config.autoDirection
              ? "bg-success/15 border-success/40 text-success"
              : "border-border text-muted-foreground hover:bg-accent/40"
          }`}
        >
          <Zap className="size-3.5" />
          AUTO
        </button>
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
          <span className="text-muted-foreground" suppressHydrationWarning>
            {now ? `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <button
            onClick={onToggleSound}
            className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
            title={soundEnabled ? "Desativar som" : "Ativar som"}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setSettingsPanelOpen(false);
            }}
            className="relative hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-danger text-[9px] text-danger-foreground flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            onClick={() => {
              setSettingsPanelOpen(!settingsPanelOpen);
              setNotifOpen(false);
            }}
            className="hover:text-foreground p-1.5 rounded-md hover:bg-accent/40 transition-colors"
            title={settingsPanelOpen ? "Fechar configurações" : "Abrir configurações"}
          >
            {settingsPanelOpen ? <X className="size-4" /> : <Settings className="size-4" />}
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-2 panel px-3 py-1.5">
            <User className="size-4" />
            <div className="text-xs">
              <div className="font-semibold text-foreground">{userName ?? "NEXOR TRADER"}</div>
              <div className="text-muted-foreground text-[10px]">
                {accountType === "real" ? "Conta Real" : "Conta Demo"}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Panel */}
      {notifOpen && (
        <div className="absolute top-16 right-5 z-50 w-80 panel p-0 shadow-2xl border border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold tracking-wide">NOTIFICAÇÕES</span>
            <div className="flex gap-2">
              <button
                onClick={onClearNotifications}
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
                    <CheckCircle2 className="size-4 text-success mt-0.5 shrink-0" />
                  )}
                  {n.type === "error" && (
                    <AlertTriangle className="size-4 text-danger mt-0.5 shrink-0" />
                  )}
                  {n.type === "warning" && (
                    <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                  )}
                  {n.type === "info" && <Clock className="size-4 text-blue-400 mt-0.5 shrink-0" />}
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

      {/* Settings Panel */}
      {settingsPanelOpen && (
        <AppSettingsPanel isOpen={settingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
      )}
    </>
  );
}
