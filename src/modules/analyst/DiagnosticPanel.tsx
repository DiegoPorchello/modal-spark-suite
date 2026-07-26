/**
 * modules/analyst/DiagnosticPanel.tsx
 * Painel de diagnóstico — exibe o estado de cada etapa do fluxo do robô.
 *
 * 6 indicadores:
 *   1. Recebendo dados
 *   2. Analisando mercado
 *   3. Score calculado
 *   4. Entrada autorizada ou bloqueada
 *   5. Ordem enviada
 *   6. Ordem confirmada
 */

import type { DiagnosticState, DiagnosticStatus } from "./AnalystTypes";

interface DiagnosticPanelProps {
  diagnostic: DiagnosticState;
}

const STEP_CONFIG: {
  key: keyof DiagnosticState;
  label: string;
  icon: string;
}[] = [
  { key: "receiving", label: "Recebendo dados", icon: "📡" },
  { key: "analyzing", label: "Analisando mercado", icon: "🧠" },
  { key: "score", label: "Score calculado", icon: "📊" },
  { key: "entry", label: "Entrada", icon: "🎯" },
  { key: "order", label: "Ordem enviada", icon: "📤" },
  { key: "confirmed", label: "Ordem confirmada", icon: "✅" },
];

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  loading: { dot: "bg-warning animate-pulse", text: "text-warning", bg: "bg-warning/10" },
  ok: { dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  error: { dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
  blocked: { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  authorized: { dot: "bg-info", text: "text-info", bg: "bg-info/10" },
  unknown: { dot: "bg-gray-400", text: "text-gray-400", bg: "bg-gray-400/10" },
};

function formatTime(ts: number): string {
  if (ts === 0) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DiagnosticPanel({ diagnostic }: DiagnosticPanelProps) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Fluxo do Robô
      </h4>
      {STEP_CONFIG.map(({ key, label, icon }) => {
        const step = diagnostic[key];
        const style = STATUS_STYLES[step.status];

        return (
          <div
            key={key}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${style?.bg ?? "bg-gray-400/10"} transition-colors`}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 ${style?.dot ?? "bg-gray-400"}`} />
            <span className="text-sm">{icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate">{label}</span>
                {step.timestamp > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1 shrink-0">
                    {formatTime(step.timestamp)}
                  </span>
                )}
              </div>
              <p className={`text-[11px] ${style?.text ?? "text-gray-400"} truncate`}>
                {step.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
