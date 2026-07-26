/**
 * StrategyLifecycleCard
 *
 * Compact dashboard card showing current strategy lifecycle state.
 * Shows: Strategy name, State, Time in state, Next step.
 * Standardized with PanelCard and semantic color tokens.
 */

import React, { useEffect, useState } from "react";
import { Activity, Eye, Loader, Crosshair, CheckCircle, Zap, Check, X, Brain } from "lucide-react";
import {
  StrategyState,
  STRATEGY_STATE_INFO,
  type StrategyLifecycleInstance,
} from "../types/strategy-lifecycle.types";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge, type StatusTone } from "../../../components/ui/StatusBadge";

interface StrategyLifecycleCardProps {
  instance: StrategyLifecycleInstance | null;
}

const STATE_ICONS: Record<StrategyState, React.ReactNode> = {
  [StrategyState.IDLE]: <div className="size-2 rounded-full bg-muted-foreground/40" />,
  [StrategyState.MONITORING]: <Eye className="size-3.5 text-info" />,
  [StrategyState.PREPARING]: <Loader className="size-3.5 text-warning animate-spin" />,
  [StrategyState.READY]: <Crosshair className="size-3.5 text-success" />,
  [StrategyState.CONFIRMED]: <CheckCircle className="size-3.5 text-success" />,
  [StrategyState.EXECUTING]: <Zap className="size-3.5 text-success" />,
  [StrategyState.ACTIVE]: <Activity className="size-3.5 text-success animate-pulse" />,
  [StrategyState.COMPLETED]: <Check className="size-3.5 text-success" />,
  [StrategyState.CANCELLED]: <X className="size-3.5 text-danger" />,
  [StrategyState.LEARNING]: <Brain className="size-3.5 text-info" />,
};

const STATE_TONE: Record<StrategyState, StatusTone> = {
  [StrategyState.IDLE]: "info",
  [StrategyState.MONITORING]: "info",
  [StrategyState.PREPARING]: "warning",
  [StrategyState.READY]: "success",
  [StrategyState.CONFIRMED]: "success",
  [StrategyState.EXECUTING]: "success",
  [StrategyState.ACTIVE]: "success",
  [StrategyState.COMPLETED]: "success",
  [StrategyState.CANCELLED]: "danger",
  [StrategyState.LEARNING]: "info",
};

const NEXT_STATE: Record<StrategyState, string | null> = {
  [StrategyState.IDLE]: "Monitorando",
  [StrategyState.MONITORING]: "Preparando",
  [StrategyState.PREPARING]: "Pronto",
  [StrategyState.READY]: "Confirmado",
  [StrategyState.CONFIRMED]: "Executando",
  [StrategyState.EXECUTING]: "Ativo",
  [StrategyState.ACTIVE]: "Concluído",
  [StrategyState.COMPLETED]: "Aprendendo",
  [StrategyState.CANCELLED]: "Inativo",
  [StrategyState.LEARNING]: "Inativo",
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function StrategyLifecycleCard({ instance }: StrategyLifecycleCardProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!instance) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - instance.currentStateSince);
    }, 1000);
    return () => clearInterval(interval);
  }, [instance?.currentStateSince]);

  if (!instance) {
    return (
      <PanelCard
        icon={Activity}
        title="Ciclo da Estratégia"
        description="Acompanhamento do ciclo de vida da estratégia."
        status={<StatusBadge tone="warning" label="AGUARDANDO" />}
      >
        <div className="text-xs text-muted-foreground">Nenhuma estratégia ativa</div>
      </PanelCard>
    );
  }

  const info = STRATEGY_STATE_INFO[instance.state];
  const nextState = NEXT_STATE[instance.state];

  return (
    <PanelCard
      icon={Activity}
      title="Ciclo da Estratégia"
      description="Acompanhamento do ciclo de vida da estratégia."
      status={
        <StatusBadge
          tone={STATE_TONE[instance.state]}
          label={info.label}
          pulse={instance.state === StrategyState.ACTIVE}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] text-muted-foreground">Estratégia</div>
          <div className="text-xs font-medium text-foreground truncate">
            {instance.strategyName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-muted-foreground">Tempo no estado</div>
          <div className="text-[10px] font-medium text-foreground tabular-nums">
            {formatDuration(elapsed)}
          </div>
        </div>
        {nextState && (
          <div className="col-span-2 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-[9px] text-muted-foreground">Próximo</span>
            <span className="text-[10px] font-medium text-primary">{nextState}</span>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
