import { useMemo } from "react";
import { Trophy, TrendingUp, Brain, History, Medal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AssetViewModel } from "./types";

interface StatsTabProps {
  assets: AssetViewModel[];
  recentTrades: { asset: string; result: "WIN" | "LOSS" | "BREAKEVEN"; profit: number; timestamp: number; direction: string; score: number }[];
}

function getMedalColor(rank: number): string {
  if (rank === 0) return "text-yellow-400";
  if (rank === 1) return "text-gray-300";
  if (rank === 2) return "text-amber-600";
  return "text-muted-foreground";
}

export function StatsTab({ assets, recentTrades }: StatsTabProps) {
  const ranked = useMemo(() => {
    return [...assets].filter((a) => a.operations > 0).sort((a, b) => b.profit - a.profit);
  }, [assets]);

  const stats = useMemo(() => {
    if (ranked.length === 0) return { totalTrades: 0, totalWins: 0, totalLosses: 0, avgWinRate: 0, totalProfit: 0 };
    const totalTrades = ranked.reduce((s, a) => s + a.operations, 0);
    const totalWins = ranked.reduce((s, a) => s + a.wins, 0);
    const totalLosses = ranked.reduce((s, a) => s + a.losses, 0);
    const totalProfit = ranked.reduce((s, a) => s + a.profit, 0);
    return { totalTrades, totalWins, totalLosses, avgWinRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0, totalProfit };
  }, [ranked]);

  const recentByAsset = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number; profit: number; count: number }>();
    for (const t of recentTrades) {
      const existing = map.get(t.asset) || { wins: 0, losses: 0, profit: 0, count: 0 };
      if (t.result === "WIN") existing.wins++;
      else if (t.result === "LOSS") existing.losses++;
      existing.profit += t.profit;
      existing.count++;
      map.set(t.asset, existing);
    }
    return map;
  }, [recentTrades]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-lg border border-border text-center">
          <div className="text-[9px] text-muted-foreground mb-0.5">Total Trades</div>
          <div className="text-sm font-bold">{stats.totalTrades}</div>
          <div className="text-[9px] text-muted-foreground">{stats.totalWins}W / {stats.totalLosses}L</div>
        </div>
        <div className="p-2 rounded-lg border border-border text-center">
          <div className="text-[9px] text-muted-foreground mb-0.5">Win Rate Geral</div>
          <div className={`text-sm font-bold ${stats.avgWinRate >= 50 ? "text-success" : "text-danger"}`}>{stats.avgWinRate.toFixed(1)}%</div>
        </div>
        <div className="p-2 rounded-lg border border-border text-center">
          <div className="text-[9px] text-muted-foreground mb-0.5">Lucro Total</div>
          <div className={`text-sm font-bold ${stats.totalProfit >= 0 ? "text-success" : "text-danger"}`}>R${stats.totalProfit.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Medal className="size-4 text-yellow-400" />
        <span className="text-xs font-semibold">Ranking por Lucro</span>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-1 pr-2">
          {ranked.length === 0 && <div className="text-center py-6 text-[10px] text-muted-foreground">Nenhum dado de performance disponível</div>}
          {ranked.map((a, i) => (
            <div key={a.symbol} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
              <span className={`text-xs font-bold w-5 text-center ${getMedalColor(i)}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{a.symbol}</span>
                  {a.status === "quarantined" && <StatusBadge tone="warning" label="Q" />}
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">{a.operations} ops</span>
                  <span className={`text-[9px] font-medium ${a.winRate >= 50 ? "text-success" : "text-danger"}`}>{a.winRate.toFixed(1)}% WR</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-bold ${a.profit >= 0 ? "text-success" : "text-danger"}`}>R${a.profit.toFixed(2)}</div>
                <div className="text-[9px] text-muted-foreground flex items-center justify-end gap-1">
                  <Brain className="size-2.5" />{a.confidence}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {recentByAsset.size > 0 && (
        <>
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <History className="size-4 text-info" />
            <span className="text-xs font-semibold">Histórico Recente</span>
          </div>
          <ScrollArea className="h-[140px]">
            <div className="space-y-1 pr-2">
              {Array.from(recentByAsset.entries()).sort((a, b) => b[1].profit - a[1].profit).map(([asset, data]) => (
                <div key={asset} className="flex items-center justify-between p-2 rounded border border-border bg-card">
                  <div>
                    <span className="text-xs font-bold">{asset}</span>
                    <span className="text-[9px] text-muted-foreground ml-2">{data.count} ops recentes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-success">{data.wins}W</span>
                    <span className="text-[10px] text-danger">{data.losses}L</span>
                    <span className={`text-[10px] font-bold ${data.profit >= 0 ? "text-success" : "text-danger"}`}>R${data.profit.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
