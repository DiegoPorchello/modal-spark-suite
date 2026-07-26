import { useState, useEffect, useCallback, useRef } from "react";
import { useAssetStore } from "@/stores/asset-store-provider";
import type { AssetViewModel } from "@/components/asset-config/types";

interface UseAssetDataReturn {
  assets: AssetViewModel[];
  recentTrades: {
    asset: string;
    result: "WIN" | "LOSS" | "BREAKEVEN";
    profit: number;
    timestamp: number;
    direction: string;
    score: number;
  }[];
  loading: boolean;
  refresh: () => void;
}

export function useAssetData(): UseAssetDataReturn {
  const store = useAssetStore();
  const [, forceRender] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub = store.on((_changed) => {
      if (mountedRef.current) {
        forceRender((n) => n + 1);
      }
    });
    return unsub;
  }, [store]);

  const assets = store.getAssets();
  const recentTrades = store.getRecentTrades();
  const loading = assets.length === 0;

  const refresh = useCallback(() => {
    forceRender((n) => n + 1);
  }, []);

  return { assets, recentTrades, loading, refresh };
}
