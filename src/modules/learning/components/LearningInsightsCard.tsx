/**
 * LearningInsightsCard
 *
 * Dashboard card showing learning insights, rankings, and recommendations.
 * Displays: Top Strategy, Top Core, Top Session, Top Indicator, Top Filter.
 * Standardized with PanelCard and semantic color tokens.
 */

import React from "react";
import {
  Brain,
  Trophy,
  Clock,
  Activity,
  Target,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import type { LearningContext } from "../types/learning-types";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";

interface LearningInsightsCardProps {
  context: LearningContext | null;
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function TrendIcon({ trend }: { trend?: "UP" | "DOWN" | "STABLE" }) {
  if (trend === "UP") return <ArrowUp className="size-3 text-success" />;
  if (trend === "DOWN") return <ArrowDown className="size-3 text-danger" />;
  return <Minus className="size-3 text-muted-foreground" />;
}

export function LearningInsightsCard({ context }: LearningInsightsCardProps) {
  if (!context || context.analytics.totalOperations === 0) {
    return (
      <PanelCard
        icon={Brain}
        title="Aprendizado"
        description="Insights e recomendações da inteligência adaptativa."
        status={<StatusBadge tone="warning" label="AGUARDANDO" />}
      >
        <div className="text-[11px] text-muted-foreground">
          Aguarde operações para gerar insights de aprendizado.
        </div>
      </PanelCard>
    );
  }

  const { topStrategy, topCore, topSession, topIndicator, topFilter, insights } = context;

  return (
    <PanelCard
      icon={Brain}
      title="Aprendizado"
      description="Insights e recomendações da inteligência adaptativa."
      status={<StatusBadge tone="info" label={`${context.analytics.totalOperations} OPS`} />}
    >
      {/* Rankings Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {topStrategy && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Trophy className="size-3.5 text-warning" />
            <div>
              <div className="text-[9px] text-muted-foreground">Melhor Estratégia</div>
              <div className="text-[11px] font-medium text-foreground truncate">
                {topStrategy.strategyName}
              </div>
              <div className="text-[10px] text-success font-medium">
                {formatPercent(topStrategy.winRate)}
              </div>
            </div>
          </div>
        )}

        {topCore && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Activity className="size-3.5 text-info" />
            <div>
              <div className="text-[9px] text-muted-foreground">Melhor Core</div>
              <div className="text-[11px] font-medium text-foreground truncate">{topCore.core}</div>
              <div className="text-[10px] text-success font-medium">
                {formatPercent(topCore.winRate)}
              </div>
            </div>
          </div>
        )}

        {topSession && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Clock className="size-3.5 text-info" />
            <div>
              <div className="text-[9px] text-muted-foreground">Melhor Sessão</div>
              <div className="text-[11px] font-medium text-foreground truncate">
                {topSession.session}
              </div>
              <div className="text-[10px] text-success font-medium">
                {formatPercent(topSession.winRate)}
              </div>
            </div>
          </div>
        )}

        {topIndicator && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Target className="size-3.5 text-primary" />
            <div>
              <div className="text-[9px] text-muted-foreground">Melhor Indicador</div>
              <div className="text-[11px] font-medium text-foreground truncate">
                {topIndicator.indicator}
              </div>
              <div className="text-[10px] text-success font-medium">
                {formatPercent(topIndicator.contributionPercent)} dos WINs
              </div>
            </div>
          </div>
        )}
      </div>

      {topFilter && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 mb-3">
          <Lightbulb className="size-3.5 text-success" />
          <div>
            <div className="text-[9px] text-muted-foreground">Filtro Mais Eficiente</div>
            <div className="text-[11px] font-medium text-foreground">{topFilter.filter}</div>
            <div className="text-[10px] text-muted-foreground">
              Evitou {topFilter.avoidedLosses} LOSS
            </div>
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-muted-foreground font-medium">INSIGHTS RECENTES</div>
          {insights.slice(0, 3).map((insight) => (
            <div key={insight.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
              <TrendIcon trend={insight.trend} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium text-foreground truncate">
                  {insight.title}
                </div>
                <div className="text-[9px] text-muted-foreground truncate">
                  {insight.recommendation}
                </div>
              </div>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  insight.severity === "HIGH"
                    ? "bg-danger/20 text-danger"
                    : insight.severity === "MEDIUM"
                      ? "bg-warning/20 text-warning"
                      : "bg-muted/30 text-muted-foreground"
                }`}
              >
                {insight.severity === "HIGH"
                  ? "ALTO"
                  : insight.severity === "MEDIUM"
                    ? "MÉDIO"
                    : "BAIXO"}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
