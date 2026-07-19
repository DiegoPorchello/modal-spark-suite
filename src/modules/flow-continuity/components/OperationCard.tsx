"use client";

import React from "react";
import type { RobotOperation } from "../../../engine/flow-robot-engine";
import { ArrowUp, ArrowDown, X } from "lucide-react";

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
    if (isSuccessful) return "text-green-400 bg-green-500/15 border-green-500/40";
    if (isActive) return "text-yellow-400 bg-yellow-500/15 border-yellow-500/40";
    return "text-red-400 bg-red-500/15 border-red-500/40";
  };

  const getStatusLabel = () => {
    if (isSuccessful) return "GANHOU";
    if (isActive) return "ABERTO";
    return "PENDENTE";
  };

  const getTimeframeColor = (timeframe: string) => {
    const colors: Record<string, string> = {
      M1: "text-blue-400 bg-blue-500/15 border-blue-500/40",
      M5: "text-purple-400 bg-purple-500/15 border-purple-500/40",
      M15: "text-orange-400 bg-orange-500/15 border-orange-500/40",
      DEFAULT: "text-muted-foreground bg-muted/15 border-muted/40",
    };
    return colors[timeframe] || colors.DEFAULT;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="panel w-[420px] p-5 shadow-2xl glow-success relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/50 via-yellow-500/50 to-red-500/50" />

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold tracking-wide text-foreground">OPERAÇÃO EM TEMPO REAL</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
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
                <> <span className="size-1.5 rounded-full bg-green-500 animate-pulse" /> <span className="size-1.5 rounded-full bg-green-500/60" /> <span className="size-1.5 rounded-full bg-green-500/30" /> </>
              ) : isActive ? (
                <> <span className="size-1.5 rounded-full bg-yellow-500 animate-pulse" /> <span className="size-1.5 rounded-full bg-yellow-500/60" /> <span className="size-1.5 rounded-full bg-yellow-500/30" /> </>
              ) : (
                <> <span className="size-1.5 rounded-full bg-red-500 animate-pulse" /> <span className="size-1.5 rounded-full bg-red-500/60" /> <span className="size-1.5 rounded-full bg-red-500/30" /> </>
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