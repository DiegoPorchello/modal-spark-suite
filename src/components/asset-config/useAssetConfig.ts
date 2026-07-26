import { useState, useCallback, useEffect } from "react";
import type {
  AssetConfigState,
  QuarantineThresholds,
  ConfidenceThresholds,
} from "./types";
import { DEFAULT_QUARANTINE, DEFAULT_CONFIDENCE } from "./types";

const STORAGE_KEY = "nexor_asset_config";
const QUARANTINE_KEY = "nexor_quarantine_thresholds";
const CONFIDENCE_KEY = "nexor_confidence_thresholds";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silent */
  }
}

export function useAssetConfig() {
  const [assetStates, setAssetStates] = useState<Record<string, AssetConfigState>>(
    () => loadJson(STORAGE_KEY, {}),
  );
  const [quarantineThresholds, setQuarantineThresholds] = useState<QuarantineThresholds>(
    () => loadJson(QUARANTINE_KEY, DEFAULT_QUARANTINE),
  );
  const [confidenceThresholds, setConfidenceThresholds] = useState<ConfidenceThresholds>(
    () => loadJson(CONFIDENCE_KEY, DEFAULT_CONFIDENCE),
  );

  useEffect(() => { saveJson(STORAGE_KEY, assetStates); }, [assetStates]);
  useEffect(() => { saveJson(QUARANTINE_KEY, quarantineThresholds); }, [quarantineThresholds]);
  useEffect(() => { saveJson(CONFIDENCE_KEY, confidenceThresholds); }, [confidenceThresholds]);

  const getAssetState = useCallback(
    (symbol: string): AssetConfigState => {
      return assetStates[symbol] ?? {
        enabled: true,
        quarantined: false,
        quarantineReason: "",
        quarantinedAt: null,
        reactivatedAt: null,
        confidenceOverride: null,
      };
    },
    [assetStates],
  );

  const toggleAsset = useCallback((symbol: string) => {
    setAssetStates((prev) => {
      const current = prev[symbol] ?? {
        enabled: true,
        quarantined: false,
        quarantineReason: "",
        quarantinedAt: null,
        reactivatedAt: null,
        confidenceOverride: null,
      };
      return { ...prev, [symbol]: { ...current, enabled: !current.enabled } };
    });
  }, []);

  const quarantineAsset = useCallback((symbol: string, reason: string) => {
    setAssetStates((prev) => {
      const current = prev[symbol] ?? {
        enabled: true,
        quarantined: false,
        quarantineReason: "",
        quarantinedAt: null,
        reactivatedAt: null,
        confidenceOverride: null,
      };
      return {
        ...prev,
        [symbol]: {
          ...current,
          quarantined: true,
          quarantineReason: reason,
          quarantinedAt: Date.now(),
        },
      };
    });
  }, []);

  const reactivateAsset = useCallback((symbol: string) => {
    setAssetStates((prev) => {
      const current = prev[symbol];
      if (!current) return prev;
      return {
        ...prev,
        [symbol]: {
          ...current,
          quarantined: false,
          quarantineReason: "",
          reactivatedAt: Date.now(),
        },
      };
    });
  }, []);

  const setConfidenceOverride = useCallback((symbol: string, value: number | null) => {
    setAssetStates((prev) => {
      const current = prev[symbol] ?? {
        enabled: true,
        quarantined: false,
        quarantineReason: "",
        quarantinedAt: null,
        reactivatedAt: null,
        confidenceOverride: null,
      };
      return { ...prev, [symbol]: { ...current, confidenceOverride: value } };
    });
  }, []);

  const computeConfidence = useCallback(
    (wins: number, losses: number, netProfit: number, totalTrades: number): number => {
      if (totalTrades === 0) return 0;
      const winRate = (wins / totalTrades) * 100;
      const profitScore = netProfit > 0 ? Math.min(100, 50 + netProfit / 10) : Math.max(0, 50 + netProfit / 10);
      const consistency = Math.max(0, 100 - losses * 3);
      const raw =
        winRate * confidenceThresholds.weightWins +
        profitScore * confidenceThresholds.weightProfit +
        consistency * confidenceThresholds.weightConsistency;
      return Math.round(Math.max(0, Math.min(100, raw)));
    },
    [confidenceThresholds],
  );

  return {
    assetStates,
    quarantineThresholds,
    confidenceThresholds,
    getAssetState,
    toggleAsset,
    quarantineAsset,
    reactivateAsset,
    setConfidenceOverride,
    setQuarantineThresholds,
    setConfidenceThresholds,
    computeConfidence,
  };
}
