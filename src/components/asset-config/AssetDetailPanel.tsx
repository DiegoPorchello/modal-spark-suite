import { X, ShieldAlert, ShieldCheck, Brain, TrendingUp, TrendingDown, DollarSign, Trophy, Skull, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AssetViewModel, AssetConfigState } from "./types";

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface AssetDetailPanelProps {
  asset: AssetViewModel;
  state: AssetConfigState;
  recentTrades: { asset: string; result: "WIN" | "LOSS" | "BREAKEVEN"; profit: number; timestamp: number; direction: string; score: number }[];
  onClose: () => void;
  onToggle: () => void;
  onToggleQuarantine: () => void;
}

function getStatus(confidence: number, winRate: number, quarantined: boolean): { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" } {
  if (quarantined) return { label: "Quarentena", tone: "warning" };
  if (confidence >= 70 && winRate >= 55) return { label: "Excelente", tone: "success" };
  if (confidence >= 50 && winRate >= 45) return { label: "Saudável", tone: "info" };
  if (confidence >= 30) return { label: "Atenção", tone: "warning" };
  return { label: "Crítico", tone: "danger" };
}

export function AssetDetailPanel({ asset, state, recentTrades, onClose, onToggle, onToggleQuarantine }: AssetDetailPanelProps) {
  const status = getStatus(asset.confidence, asset.winRate, state.quarantined);

  return (
    <div className="flex flex-col gap-3 p-3 border-l border-border bg-card h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{asset.symbol}</span>
          <StatusBadge tone={status.tone} label={status.label} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0"><X className="size-3.5" /></Button>
      </div>

      <div className="flex gap-2">
        <Button variant={asset.enabled ? "default" : "outline"} size="sm" onClick={onToggle} className="flex-1 h-7 text-[10px]">
          {asset.enabled ? <><ShieldCheck className="size-3 mr-1" /> Ativo</> : <><ShieldAlert className="size-3 mr-1" /> Inativo</>}
        </Button>
        <Button variant={state.quarantined ? "destructive" : "outline"} size="sm" onClick={onToggleQuarantine} className="flex-1 h-7 text-[10px]">
          <AlertTriangle className="size-3 mr-1" /> {state.quarantined ? "Libertar" : "Quarentena"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground">Confiança</div>
          <div className={`text-lg font-bold ${asset.confidence >= 60 ? "text-success" : asset.confidence >= 35 ? "text-warning" : "text-danger"}`}>{asset.confidence}%</div>
        </div>
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground">Win Rate</div>
          <div className={`text-lg font-bold ${asset.winRate >= 50 ? "text-success" : "text-danger"}`}>{asset.winRate.toFixed(1)}%</div>
        </div>
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground">Lucro</div>
          <div className={`text-lg font-bold ${asset.profit >= 0 ? "text-success" : "text-danger"}`}>R${asset.profit.toFixed(2)}</div>
        </div>
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground">Loss Consec.</div>
          <div className={`text-lg font-bold ${asset.consecutiveLosses >= 5 ? "text-danger" : "text-foreground"}`}>{asset.consecutiveLosses}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-1"><Trophy className="size-2.5" /> Wins</div>
          <div className="text-sm font-bold text-success">{asset.wins}</div>
        </div>
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-1"><Skull className="size-2.5" /> Losses</div>
          <div className="text-sm font-bold text-danger">{asset.losses}</div>
        </div>
        <div className="p-2 rounded border border-border text-center">
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-1"><Brain className="size-2.5" /> Score</div>
          <div className="text-sm font-bold">{asset.averageScore.toFixed(1)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span>{asset.operations} ops</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Última:</span><span>{asset.lastOperation ? formatTimeAgo(asset.lastOperation) : "Nunca"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Categoria:</span><span>{asset.category}</span></div>
        {state.quarantinedAt && <div className="flex justify-between"><span className="text-muted-foreground">Desde:</span><span>{new Date(state.quarantinedAt).toLocaleDateString("pt-BR")}</span></div>}
      </div>

      {state.quarantineReason && (
        <div className="p-2 rounded border border-warning/30 bg-warning/5">
          <div className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle className="size-3" /> {state.quarantineReason}</div>
        </div>
      )}

      {recentTrades.length > 0 && (
        <>
          <div className="border-t border-border pt-2 flex items-center gap-1.5">
            <History className="size-3 text-info" />
            <span className="text-[10px] font-semibold">Últimas Operações</span>
          </div>
          <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
            {recentTrades.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-1.5 rounded border border-border bg-secondary/30 text-[10px]">
                <div className="flex items-center gap-2">
                  {t.result === "WIN" ? <TrendingUp className="size-3 text-success" /> : <TrendingDown className="size-3 text-danger" />}
                  <span className="font-medium">{t.direction}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-success">{t.score.toFixed(1)}</span>
                  <span className={`font-bold ${t.profit >= 0 ? "text-success" : "text-danger"}`}>R${t.profit.toFixed(2)}</span>
                  <span className="text-muted-foreground">{formatTimeAgo(t.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
