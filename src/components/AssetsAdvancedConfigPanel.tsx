import { useState, useMemo, useCallback } from "react";
import { Layers, Brain, Settings, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetConfig } from "./asset-config/useAssetConfig";
import { useAssetData } from "./asset-config/useAssetData";
import { AssetsTab } from "./asset-config/AssetsTab";
import { AimTab } from "./asset-config/AimTab";
import { SettingsTab } from "./asset-config/SettingsTab";
import { StatsTab } from "./asset-config/StatsTab";
import { AssetDetailPanel } from "./asset-config/AssetDetailPanel";

export function AssetsAdvancedConfigPanel() {
  const {
    getAssetState,
    toggleAsset,
    quarantineAsset,
    reactivateAsset,
    quarantineThresholds,
    confidenceThresholds,
    setQuarantineThresholds,
    setConfidenceThresholds,
  } = useAssetConfig();

  const { assets, recentTrades, loading } = useAssetData();

  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ativos");

  const selectedAssetData = useMemo(() => {
    if (!selectedAsset) return null;
    return assets.find((a) => a.symbol === selectedAsset) || null;
  }, [selectedAsset, assets]);

  const selectedAssetState = useMemo(() => {
    if (!selectedAsset) return null;
    return getAssetState(selectedAsset);
  }, [selectedAsset, getAssetState]);

  const selectedAssetRecentTrades = useMemo(() => {
    if (!selectedAsset) return [];
    return recentTrades.filter((t) => t.asset === selectedAsset);
  }, [selectedAsset, recentTrades]);

  const handleSelect = useCallback((symbol: string) => {
    setSelectedAsset((prev) => (prev === symbol ? null : symbol));
  }, []);

  const handleToggle = useCallback((symbol: string) => {
    toggleAsset(symbol);
  }, [toggleAsset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-xs text-muted-foreground">Carregando dados...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-9">
          <TabsTrigger value="ativos" className="flex items-center gap-1.5 text-[11px]">
            <Layers className="size-3" />
            Ativos
          </TabsTrigger>
          <TabsTrigger value="aim" className="flex items-center gap-1.5 text-[11px]">
            <Brain className="size-3" />
            AIM
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1.5 text-[11px]">
            <Settings className="size-3" />
            Config
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-1.5 text-[11px]">
            <BarChart3 className="size-3" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          <AssetsTab
            assets={assets}
            getAssetState={getAssetState}
            onToggle={handleToggle}
            onSelect={handleSelect}
            selectedAsset={selectedAsset}
          />
        </TabsContent>

        <TabsContent value="aim">
          <AimTab
            assets={assets}
            getAssetState={getAssetState}
            onSelect={handleSelect}
            selectedAsset={selectedAsset}
          />
        </TabsContent>

        <TabsContent value="config">
          <SettingsTab
            quarantineThresholds={quarantineThresholds}
            confidenceThresholds={confidenceThresholds}
            onQuarantineChange={setQuarantineThresholds}
            onConfidenceChange={setConfidenceThresholds}
          />
        </TabsContent>

        <TabsContent value="stats">
          <StatsTab
            assets={assets}
            recentTrades={recentTrades}
          />
        </TabsContent>
      </Tabs>

      {selectedAsset && selectedAssetData && selectedAssetState && (
        <AssetDetailPanel
          asset={selectedAssetData}
          state={selectedAssetState}
          recentTrades={selectedAssetRecentTrades}
          onClose={() => setSelectedAsset(null)}
          onToggle={() => handleToggle(selectedAsset)}
          onToggleQuarantine={() => {
            if (selectedAssetState.quarantined) {
              reactivateAsset(selectedAsset);
            } else {
              quarantineAsset(selectedAsset, "Manual");
            }
          }}
        />
      )}
    </div>
  );
}
