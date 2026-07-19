import {
  StrategyProfile,
  DEFAULT_PROFILES,
  StrategyMode,
} from "../types/strategy-profile";

export class StrategyManager {
  private static instance: StrategyManager;
  private profiles: StrategyProfile[];
  private activeProfileId: string;

  private constructor() {
    this.profiles = [...DEFAULT_PROFILES];
    this.activeProfileId = "balanced";
  }

  static getInstance(): StrategyManager {
    if (!StrategyManager.instance) {
      StrategyManager.instance = new StrategyManager();
    }
    return StrategyManager.instance;
  }

  getActiveProfile(): StrategyProfile {
    return (
      this.profiles.find((p) => p.id === this.activeProfileId) ??
      this.profiles[0]
    );
  }

  setActiveProfile(id: string): void {
    const found = this.profiles.find((p) => p.id === id);
    if (found) {
      this.activeProfileId = id;
    }
  }

  getProfiles(): StrategyProfile[] {
    return [...this.profiles];
  }

  getProfileById(id: string): StrategyProfile | undefined {
    return this.profiles.find((p) => p.id === id);
  }

  getProfileByMode(mode: StrategyMode): StrategyProfile | undefined {
    return this.profiles.find((p) => p.mode === mode);
  }

  meetsThresholds(
    score: number,
    probability: number,
    filtersPassed: number,
  ): { eligible: boolean; details: string[] } {
    const profile = this.getActiveProfile();
    const details: string[] = [];
    let eligible = true;

    if (score < profile.thresholds.minScore) {
      eligible = false;
      details.push(
        `Score ${score} abaixo do mínimo ${profile.thresholds.minScore}`,
      );
    }
    if (probability < profile.thresholds.minProbability) {
      eligible = false;
      details.push(
        `Probabilidade ${probability}% abaixo do mínimo ${profile.thresholds.minProbability}%`,
      );
    }
    if (filtersPassed < profile.thresholds.minFiltersPassed) {
      eligible = false;
      details.push(
        `${filtersPassed} filtros passaram, mínimo é ${profile.thresholds.minFiltersPassed}`,
      );
    }

    return { eligible, details };
  }

  getRiskParams() {
    return this.getActiveProfile().risk;
  }

  getFilterConfig() {
    return this.getActiveProfile().filters;
  }

  getWeightConfig() {
    return this.getActiveProfile().weights;
  }
}

export const strategyManager = StrategyManager.getInstance();
