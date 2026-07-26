import { useMemo } from "react";
import { Brain, TrendingUp, TrendingDown, DollarSign, Trophy, Skull, AlertTriangle, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AssetViewModel, AssetConfigState } from "./types";

interface AimTabProps {
  assets: AssetViewModel[];
  getAssetState: (symbol: string) => AssetConfigState;
  onSelect: (symbol: string) => void;
  selectedAsset: string | null;
}

function getStatus(confidence: number, winRate: number, quarantined: boolean): { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" } {
  if (quarantined) return { label: "Quarentena", tone: "warning" };
  if (confidence >= 70 && winRate >= 55) return { label: "Excelente", tone: "success" };
  if (confidence >= 50 && winRate >= 45) return { label: "Saudável", tone: "info" };
  if (confidence >= 30) return { label: "Atenção", tone: "warning" };
  return { label: "Crítico", tone: "danger" };
}

export function AimTab({ assets, getAssetState, onSelect, selectedAsset }: AimTabProps) {
  const enriched = useMemo(() => {
    return assets
      .map((a) => {
        const state = getAssetState(a.symbol);
        const status = getStatus(a.confidence, a.winRate, state.quarantined);
        return { ...a, state, status };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }, [assets, getAssetState]);

  const selected = selectedAsset ? enriched.find((a) => a.symbol === selectedAsset) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-primary" />
        <span className="text-xs font-semibold">Análise Inteligente de Mercado</span>
      </div>

      {selected && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold">{selected.symbol}</span>
            <StatusBadge tone={selected.status.tone} label={selected.status.label} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Confiança</div>
              <div className={`text-sm font-bold ${selected.confidence >= 60 ? "text-success" : selected.confidence >= 35 ? "text-warning" : "text-danger"}`}>{selected.confidence}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Win Rate</div>
              <div className={`text-sm font-bold ${selected.winRate >= 50 ? "text-success" : "text-danger"}`}>{selected.winRate.toFixed(1)}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Lucro</div>
              <div className={`text-sm font-bold ${selected.profit >= 0 ? "text-success" : "text-danger"}`}>R${selected.profit.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">Loss Consec.</div>
              <div className={`text-sm font-bold ${selected.consecutiveLosses >= 5 ? "text-danger" : selected.consecutiveLosses >= 3 ? "text-warning" : "text-foreground"}`}>{selected.consecutiveLosses}</div>
            </div>
          </div>
          {selected.quarantineReason && (
            <div className="mt-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-warning" />
              <span className="text-[10px] text-warning">{selected.quarantineReason}</span>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="h-[280px]">
        <div className="space-y-1.5 pr-2">
          {enriched.map((a) => (
            <div key={a.symbol} onClick={() => onSelect(a.symbol)} className={`p-2.5 rounded-lg border cursor-pointer transition-all ${selectedAsset === a.symbol ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/50"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{a.symbol}</span>
                  <StatusBadge tone={a.status.tone} label={a.status.label} />
                </div>
                <span className={`text-[10px] font-bold ${a.confidence >= 60 ? "text-success" : a.confidence >= 35 ? "text-warning" : "text-danger"}`}>{a.confidence}%</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Win Rate</span>
                  <span className={`text-[10px] font-medium ${a.winRate >= 50 ? "text-success" : "text-danger"}`}>{a.winRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="size-3" /> Lucro</span>
                  <span className={`text-[10px] font-medium ${a.profit >= 0 ? "text-success" : "text-danger"}`}>R${a.profit.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Trophy className="size-3" /> Wins</span>
                  <span className="text-[10px] font-medium text-success">{a.wins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Skull className="size-3" /> Losses</span>
                  <span className="text-[10px] font-medium text-danger">{a.losses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingDown className="size-3" /> Loss Consec.</span>
                  <span className={`text-[10px] font-medium ${a.consecutiveLosses >= 5 ? "text-danger" : "text-muted-foreground"}`}>{a.consecutiveLosses}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Shield className="size-3" /> Score</span>
                  <span className="text-[10px] font-medium">{a.averageScore.toFixed(1)}</span>
                </div>
              </div>
              {a.quarantineReason && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="size-3 text-warning" />
                  <span className="text-[10px] text-warning truncate">{a.quarantineReason}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
