/**
 * MarketProfileCard
 *
 * Dashboard card showing market profile with confidence levels.
 * Displays: Mode, Market, Core, Strategy, Confidence Level.
 * Standardized with PanelCard (icon · title · description · status) and
 * semantic color tokens only (success / warning / danger / info).
 */

import { Globe, Activity, Target, Shield, BarChart3 } from "lucide-react";
import type { MarketProfile } from "../types/market-profile.types";
import { scoreToConfidence, ConfidenceLevel } from "../types/market-profile.types";
import { PanelCard } from "../../../components/ui/PanelCard";
import { StatusBadge } from "../../../components/ui/StatusBadge";

const CONFIDENCE_BAR: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.ELITE]: "bg-success",
  [ConfidenceLevel.HIGH]: "bg-success",
  [ConfidenceLevel.GOOD]: "bg-success",
  [ConfidenceLevel.MODERATE]: "bg-warning",
  [ConfidenceLevel.LOW]: "bg-danger",
};

const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.ELITE]: "text-success",
  [ConfidenceLevel.HIGH]: "text-success",
  [ConfidenceLevel.GOOD]: "text-success",
  [ConfidenceLevel.MODERATE]: "text-warning",
  [ConfidenceLevel.LOW]: "text-danger",
};

const CONFIDENCE_SURFACE: Record<ConfidenceLevel, string> = {
  [ConfidenceLevel.ELITE]: "border-success/30 bg-success/10",
  [ConfidenceLevel.HIGH]: "border-success/30 bg-success/10",
  [ConfidenceLevel.GOOD]: "border-success/30 bg-success/10",
  [ConfidenceLevel.MODERATE]: "border-warning/30 bg-warning/10",
  [ConfidenceLevel.LOW]: "border-danger/30 bg-danger/10",
};

const MODE_LABEL: Record<string, string> = {
  AUTO: "AUTO",
  FOREX: "FOREX",
  HYBRID: "HYBRID",
  HYBRID_FLOW: "HYBRID FLOW",
  HYBRID_PROBABILITY: "HYBRID PROB",
};

export function MarketProfileCard({ profile }: { profile: MarketProfile | null }) {
  if (!profile) {
    return (
      <PanelCard
        icon={Globe}
        title="Perfil de Mercado"
        description="Detecção automática do mercado e do core."
        status={<StatusBadge tone="warning" label="AGUARDANDO" />}
      >
        <div className="text-xs text-muted-foreground">Aguardando configuração...</div>
      </PanelCard>
    );
  }

  const confidenceProfile = scoreToConfidence(profile.confidence);

  return (
    <PanelCard
      icon={Globe}
      title="Perfil de Mercado"
      description="Detecção automática do mercado e do core."
      status={<StatusBadge tone="info" label={MODE_LABEL[profile.mode] ?? profile.mode} />}
    >
      <div className="grid grid-cols-2 gap-2">
        {/* Mercado */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Activity className="size-3.5 text-info" />
          <div>
            <div className="text-[9px] text-muted-foreground">Mercado</div>
            <div className="text-xs font-medium text-foreground">{profile.detectedMarket}</div>
          </div>
        </div>

        {/* Core */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Activity className="size-3.5 text-primary" />
          <div>
            <div className="text-[9px] text-muted-foreground">Core</div>
            <div className="text-xs font-medium text-foreground">{profile.activeProfileName}</div>
          </div>
        </div>

        {/* Estratégia */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Target className="size-3.5 text-primary" />
          <div>
            <div className="text-[9px] text-muted-foreground">Estratégia</div>
            <div className="text-xs font-medium text-foreground truncate">
              {profile.activeStrategyName}
            </div>
          </div>
        </div>

        {/* Confiança */}
        <div
          className={`flex items-center gap-2 p-2 rounded-lg border ${CONFIDENCE_SURFACE[confidenceProfile.level]}`}
        >
          <Shield className={`size-3.5 ${CONFIDENCE_TEXT[confidenceProfile.level]}`} />
          <div>
            <div className="text-[9px] text-muted-foreground">Confiança</div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${CONFIDENCE_TEXT[confidenceProfile.level]}`}>
                {confidenceProfile.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{profile.confidence}%</span>
            </div>
          </div>
        </div>

        {/* Score Bar */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 col-span-2">
          <BarChart3 className="size-3.5 text-success" />
          <div className="flex-1">
            <div className="text-[9px] text-muted-foreground">Score</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${CONFIDENCE_BAR[confidenceProfile.level]}`}
                  style={{ width: `${profile.confidence}%` }}
                />
              </div>
              <span className="text-xs font-mono font-semibold text-foreground">
                {profile.confidence}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}
