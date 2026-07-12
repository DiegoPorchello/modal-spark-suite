"use client";

import { useState } from "react";
import { X, Moon, Sun, Volume2, VolumeX, Bell, Gamepad2 } from "lucide-react";

interface AppSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSettingsPanel({ isOpen, onClose }: AppSettingsPanelProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [gameMode, setGameMode] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md panel shadow-2xl border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold tracking-wide">CONFIGURAÇÕES</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              APARÊNCIA
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

          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">ÁUDIO</span>
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

          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              NOTIFICAÇÕES
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNotificationsEnabled(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  notificationsEnabled
                    ? "bg-success/15 border border-success/40 text-success"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <Bell className="size-4" />
                Habilitado
              </button>
              <button
                onClick={() => setNotificationsEnabled(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  !notificationsEnabled
                    ? "bg-success/15 border border-success/40 text-success"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <Bell className="size-4 opacity-50" />
                Desabilitado
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">
              MODO DE JOGO
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGameMode(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  gameMode
                    ? "bg-success/15 border border-success/40 text-success"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <Gamepad2 className="size-4" />
                Habilitado
              </button>
              <button
                onClick={() => setGameMode(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  !gameMode
                    ? "bg-success/15 border border-success/40 text-success"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                <Gamepad2 className="size-4 opacity-50" />
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
    </div>
  );
}
