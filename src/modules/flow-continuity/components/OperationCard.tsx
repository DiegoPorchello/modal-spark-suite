"use client";

import React, { useState } from "react";
import type { RobotOperation } from "../../../engine/flow-robot-engine";
import { ArrowUp, ArrowDown, X, Minus, Maximize2, Minimize2 } from "lucide-react";

interface OperationCardProps {
  operation: RobotOperation | null;
  onClose: () => void;
  onCancel: () => void;
}

export const OperationCard: React.FC<OperationCardProps> = ({
  operation,
  onClose,
  onCancel,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!operation) return null;

  const isSuccessful = operation.result === "win";
  const isActive = operation.status === "active";

  const formatTimeRemaining = () => {
    if (!operation.openedAt) return "--:--";
    const openedAt = new Date(operation.openedAt).getTime();
    const expirationMs = (operation.expirationSeconds ?? 60) * 1000;
    const endTime = openedAt + expirationMs;
    const now = Date.now();
    const remainingMs = Math.max(0, endTime - now);
    const remainingSec = Math.round(remainingMs / 1000);
    return `${Math.floor(remainingSec / 60)}:${(remainingSec % 60).toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
    if (isSuccessful) return "text-success bg-success/15 border-success/40";
    if (isActive) return "text-warning bg-warning/15 border-warning/40";
    return "text-danger bg-danger/15 border-danger/40";
  };

  const getStatusLabel = () => {
    if (isSuccessful) return "GANHOU";
    if (isActive) return "ABERTO";
    return "PENDENTE";
  };

  const getTimeframeColor = (timeframe: string) => {
    const colors: Record<string, string> = {
      M1: "text-info bg-info/15 border-info/40",
      M5: "text-primary bg-primary/15 border-primary/40",
      M15: "text-warning bg-warning/15 border-warning/40",
      DEFAULT: "text-muted-foreground bg-muted/15 border-muted/40",
    };
    return colors[timeframe] || colors.DEFAULT;
  };

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
            <div className="text-xs font-bold">{operation.asset} {operation.direction.toUpperCase()}</div>
            <div className="text-[10px] text-muted-foreground">R${(operation.amount || 0).toFixed(2)} • Clique para expandir</div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm ${isExpanded ? "p-4" : ""}`}>
      <div className={`panel p-5 shadow-2xl glow-success relative overflow-hidden transition-all duration-200 ${
        isExpanded ? "w-full max-w-4xl h-[85vh] overflow-y-auto" : "w-[420px]"
      }`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success/50 via-warning/50 to-danger/50" />

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold tracking-wide text-foreground">OPERAÇÃO EM TEMPO REAL</h3>
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
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-danger/20 text-muted-foreground hover:text-danger transition-colors"
              title="Fechar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ATIVO</div>
            <div className="text-sm font-bold mt-1 flex items-center gap-1">
              🇪🇺 {operation.asset} <span className="text-success text-[10px]">OTC</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div className={`text-sm font-bold mt-1 ${getStatusColor()} px-2 py-1 rounded text-center text-xs`}>{getStatusLabel()}</div>
            <div className="flex gap-1 mt-1 justify-center">
              {isSuccessful ? (
                <> <span className="size-1.5 rounded-full bg-success animate-pulse" /> <span className="size-1.5 rounded-full bg-success/60" /> <span className="size-1.5 rounded-full bg-success/30" /> </>
              ) : isActive ? (
                <> <span className="size-1.5 rounded-full bg-warning animate-pulse" /> <span className="size-1.5 rounded-full bg-warning/60" /> <span className="size-1.5 rounded-full bg-warning/30" /> </>
              ) : (
                <> <span className="size-1.5 rounded-full bg-danger animate-pulse" /> <span className="size-1.5 rounded-full bg-danger/60" /> <span className="size-1.5 rounded-full bg-danger/30" /> </>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">VALOR DA ENTRADA</div>
            <div className="text-sm font-bold mt-1">R${(operation.amount || 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">DIREÇÃO</div>
              <div
                className="text-sm font-bold flex items-center gap-1 mt-1"
                style={{ color: operation.direction === "call" ? "var(--success)" : "var(--danger)" }}
              >
                {operation.direction === "call" ? (
                  <ArrowUp className="size-4" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
                {operation.direction.toUpperCase()}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">TIMEFRAME</div>
              <div
                className={`text-sm font-bold mt-1 px-2 py-1 rounded border ${getTimeframeColor(operation.timeframe)}`}
              >
                {operation.timeframe}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EXPIRAÇÃO</div>
              <div className="text-sm font-bold mt-1">
                {operation.expirationSeconds <= 60
                  ? "1 MINUTO"
                  : operation.expirationSeconds <= 300
                    ? "5 MINUTOS"
                    : "15 MINUTOS"
                }
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative size-32">
              <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
                <circle cx="60" cy="60" r="54" stroke="oklch(0.3 0.03 220)" strokeWidth="6" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  stroke="oklch(0.78 0.19 155)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 54}
                  strokeDashoffset={2 * Math.PI * 54 * (1 - (new Date(operation.openedAt).getTime() + (operation.expirationSeconds ?? 60) * 1000 - Date.now()) / ((operation.expirationSeconds ?? 60) * 1000)) || 0}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground tracking-widest">TEMPO RESTANTE</div>
                <div className="text-2xl font-bold font-mono" style={{ color: isActive ? "var(--warning)" : "var(--success)" }}>
                  {formatTimeRemaining()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">PAYOUT</div>
            <div className="text-success font-bold">{Math.round((operation.payout ?? 0.85) * 100)}%</div>
          </div>

          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">RETORNO</div>
            <div
              className={`font-bold ${operation.profit && operation.profit > 0 ? "text-success" : operation.profit && operation.profit < 0 ? "text-danger" : "text-warning"}`}
            >
              {operation.profit > 0 ? "+" : ""} R${Math.abs(operation.profit || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">NÍVEL</div>
            <div className="font-bold mt-1" style={{ color: "var(--success)" }}>{operation.recoveryStep}</div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ENTRADA</div>
            <div
              className="font-bold mt-1"
              style={{
                color: (operation.entryNumber ?? 1) === 2
                  ? "var(--warning)"
                  : "var(--success)",
              }}
            >
              {operation.entryNumber ?? 1}/15
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">SCORE</div>
            <div className="font-bold mt-1" style={{ color: "var(--success)" }}>--/--</div>
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
};