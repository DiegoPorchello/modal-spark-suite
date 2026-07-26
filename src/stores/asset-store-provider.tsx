import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AssetStore } from "./asset-store";
import { useBroker } from "@/hooks/useBroker";
import { useRobot } from "@/hooks/useRobot";
import { usePerformance } from "@/hooks/usePerformance";
import { useAssetConfig } from "@/components/asset-config/useAssetConfig";
import type { BrokerAsset } from "@/broker/types";

const AssetStoreContext = createContext<AssetStore | null>(null);

export function AssetStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AssetStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new AssetStore();
  }
  const store = storeRef.current;

  const { adapter, connected } = useBroker();
  const { state: robotState, engine } = useRobot();
  const { performance } = usePerformance();
  const { assetStates, confidenceThresholds } = useAssetConfig();

  const [brokerAssets, setBrokerAssets] = useState<BrokerAsset[]>([]);

  useEffect(() => {
    if (!adapter || !connected) {
      setBrokerAssets([]);
      return;
    }
    let cancelled = false;
    adapter
      .getAssets()
      .then((assets) => {
        if (!cancelled) setBrokerAssets(assets);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [adapter, connected]);

  const engineAssets = engine ? (robotState.config.assets ?? []) : [];

  useEffect(() => {
    store.setEngineAssets(engineAssets);
  }, [engineAssets, store]);

  useEffect(() => {
    store.setPerformance(performance);
  }, [performance, store]);

  useEffect(() => {
    store.setBrokerAssets(brokerAssets);
  }, [brokerAssets, store]);

  useEffect(() => {
    store.setAssetStates(assetStates);
  }, [assetStates, store]);

  useEffect(() => {
    store.setConfidenceThresholds(confidenceThresholds);
  }, [confidenceThresholds, store]);

  return <AssetStoreContext.Provider value={store}>{children}</AssetStoreContext.Provider>;
}

export function useAssetStore(): AssetStore {
  const store = useContext(AssetStoreContext);
  if (!store) throw new Error("useAssetStore must be used within an AssetStoreProvider");
  return store;
}
