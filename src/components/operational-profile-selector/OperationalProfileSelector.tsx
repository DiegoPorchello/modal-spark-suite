/**
 * OperationalProfileSelector — Card-based selector for choosing operational profile.
 *
 * Four selectable profiles: AUTO, FOREX, HYBRID FLOW, HYBRID PROBABILITY
 * Each card shows icon, name, description, and engine badge.
 * The profile can be changed without restarting the robot.
 */

import { useState, useEffect } from 'react';
import { Zap, Globe, TrendingUp, Brain } from 'lucide-react';
import { OperationProfile } from '../../types/operation-profile';
import { useRobot } from '../../hooks/useRobot';

const PROFILE_TO_MARKET_MODE: Record<OperationProfile, 'AUTO' | 'FOREX' | 'HYBRID'> = {
  [OperationProfile.AUTO]: 'AUTO',
  [OperationProfile.FOREX]: 'FOREX',
  [OperationProfile.HYBRID_FLOW]: 'HYBRID',
  [OperationProfile.HYBRID_PROBABILITY]: 'HYBRID',
};

interface ProfileCard {
  id: OperationProfile;
  name: string;
  shortName: string;
  description: string;
  engine: string;
  icon: typeof Zap;
}

const PROFILES: ProfileCard[] = [
  {
    id: OperationProfile.AUTO,
    name: 'AUTO',
    shortName: 'AUTO',
    description: 'Seleção automática do mercado e motor de decisão com base no contexto.',
    engine: 'Automático',
    icon: Zap,
  },
  {
    id: OperationProfile.FOREX,
    name: 'FOREX',
    shortName: 'FOREX',
    description: 'Motor Forex exclusivo com indicadores cambiais dedicados.',
    engine: 'Cambial',
    icon: Globe,
  },
  {
    id: OperationProfile.HYBRID_FLOW,
    name: 'HYBRID FLOW',
    shortName: 'FLOW',
    description: 'Continuidade híbrida combinando estrutura de preço e momentum.',
    engine: 'Híbrido',
    icon: TrendingUp,
  },
  {
    id: OperationProfile.HYBRID_PROBABILITY,
    name: 'HYBRID PROB',
    shortName: 'PROB',
    description: 'Motor de probabilidade (ADX / EMA200 / ATR / Flow Index / Score).',
    engine: 'Probabilidade',
    icon: Brain,
  },
];

interface OperationalProfileSelectorProps {
  onProfileChange?: (profile: OperationProfile) => void;
}

export function OperationalProfileSelector({ onProfileChange }: OperationalProfileSelectorProps) {
  const { state, updateConfig } = useRobot();
  const initialProfile = (state.config.operationProfile ?? "AUTO") as OperationProfile;
  const [selectedProfile, setSelectedProfile] = useState<OperationProfile>(initialProfile);

  useEffect(() => {
    const current = (state.config.operationProfile ?? "AUTO") as OperationProfile;
    setSelectedProfile(current);
  }, [state.config.operationProfile]);

  const handleProfileSelect = (profile: OperationProfile) => {
    try {
      setSelectedProfile(profile);
      updateConfig({
        marketMode: PROFILE_TO_MARKET_MODE[profile],
        operationProfile: profile,
      });
      onProfileChange?.(profile);
      console.log('[OperationalProfileSelector] Profile changed to:', profile);
    } catch (error) {
      console.error('[OperationalProfileSelector] Failed to load profile', profile, error);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Zap className="size-3.5 text-primary" />
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Perfil Operacional
          </div>
        </div>
      </div>

      {/* Profile cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PROFILES.map((profile) => {
          const isSelected = selectedProfile === profile.id;
          const Icon = profile.icon;

          return (
            <button
              key={profile.id}
              onClick={() => handleProfileSelect(profile.id)}
              className={`
                relative group text-left p-4 rounded-lg border transition-all duration-200
                ${isSelected
                  ? 'bg-orange-600/10 border-orange-600/50 shadow-[0_0_12px_rgba(234,88,12,0.15)]'
                  : 'bg-panel border-border hover:border-border hover:bg-panel hover:shadow-lg'
                }
              `}
            >
              {/* Selection indicator */}
              <div className="absolute top-3 right-3">
                <div
                  className={`
                    size-2.5 rounded-full transition-colors duration-200
                    ${isSelected ? 'bg-orange-600 animate-pulse' : 'bg-muted-foreground/30'}
                  `}
                />
              </div>

              {/* Icon */}
              <div
                className={`
                  size-9 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200
                  ${isSelected
                    ? 'bg-orange-600/15 border border-orange-600/30'
                    : 'bg-muted/50 border border-border group-hover:bg-muted'
                  }
                `}
              >
                <Icon
                  className={`size-4.5 transition-colors duration-200 ${
                    isSelected ? 'text-orange-600' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                />
              </div>

              {/* Name */}
              <div
                className={`
                  text-[13px] font-bold tracking-wide mb-1 transition-colors duration-200
                  ${isSelected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'}
                `}
              >
                {profile.name}
              </div>

              {/* Description */}
              <p className="text-[10px] leading-relaxed text-muted-foreground mb-2 line-clamp-2">
                {profile.description}
              </p>

              {/* Engine badge */}
              <span
                className={`
                  inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border
                  ${isSelected
                    ? 'bg-orange-600/10 text-orange-600 border-orange-600/30'
                    : 'bg-muted/40 text-muted-foreground border-border'
                  }
                `}
              >
                {profile.engine}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
