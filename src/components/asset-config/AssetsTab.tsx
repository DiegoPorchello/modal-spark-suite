import { useState, useMemo } from "react";
import { Search, ShieldAlert, ShieldCheck, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AssetViewModel, AssetCategory, AssetConfigState } from "./types";
import { CATEGORY_LABELS, ALL_CATEGORIES } from "./types";

interface AssetsTabProps {
  assets: AssetViewModel[];
  getAssetState: (symbol: string) => AssetConfigState;
  onToggle: (symbol: string) => void;
  onSelect: (symbol: string) => void;
  selectedAsset: string | null;
}

function guessCategory(symbol: string): AssetCategory {
  const s = symbol.toUpperCase();
  if (s.includes("BTC") || s.includes("ETH") || s.includes("SOL") || s.includes("DOGE")) return "crypto";
  if (s.includes("EUR") || s.includes("GBP") || s.includes("USD") || s.includes("JPY") || s.includes("CHF") || s.includes("AUD") || s.includes("NZD") || s.includes("CAD")) {
    if (s.includes("EUR") && s.includes("USD")) return "forex-major";
    if (s.includes("GBP") && s.includes("USD")) return "forex-major";
    if (s.includes("USD") && s.includes("JPY")) return "forex-major";
    if (s.includes("USD") && s.includes("CHF")) return "forex-major";
    if (s.includes("AUD") && s.includes("USD")) return "forex-major";
    if (s.includes("NZD") && s.includes("USD")) return "forex-major";
    if (s.includes("USD") && s.includes("CAD")) return "forex-major";
    if (s.includes("EUR") && s.includes("GBP")) return "forex-major";
    if (s.includes("EUR") && s.includes("JPY")) return "forex-major";
    if (s.includes("GBP") && s.includes("JPY")) return "forex-major";
    if (s.includes("EUR") && s.includes("CHF")) return "forex-minor";
    if (s.includes("GBP") && s.includes("CHF")) return "forex-minor";
    if (s.includes("AUD") && s.includes("JPY")) return "forex-minor";
    return "forex-exotic";
  }
  if (s.includes("GOLD") || s.includes("SILVER") || s.includes("OIL") || s.includes("XAU") || s.includes("XAG")) return "commodity";
  if (s.includes("IBOV") || s.includes("SPX") || s.includes("NAS") || s.includes("DAX") || s.includes("FTSE")) return "index";
  return "forex-exotic";
}

export function AssetsTab({ assets, getAssetState, onToggle, onSelect, selectedAsset }: AssetsTabProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | "all">("all");

  const enriched = useMemo(() => {
    return assets.map((a) => {
      const state = getAssetState(a.symbol);
      const cat = (a.category as AssetCategory) || guessCategory(a.symbol);
      return { ...a, state, displayCategory: cat };
    });
  }, [assets, getAssetState]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.symbol.toLowerCase().includes(q) || a.displayCategory.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      list = list.filter((a) => a.displayCategory === categoryFilter);
    }
    return list.sort((a, b) => {
      if (a.state.quarantined !== b.state.quarantined) return a.state.quarantined ? 1 : -1;
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return b.profit - a.profit;
    });
  }, [enriched, search, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enriched.length };
    for (const a of enriched) {
      counts[a.displayCategory] = (counts[a.displayCategory] || 0) + 1;
    }
    return counts;
  }, [enriched]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ativo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setCategoryFilter("all")} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          Todos ({categoryCounts.all || 0})
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          return (
            <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)} className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${categoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      <ScrollArea className="h-[320px]">
        <div className="space-y-1.5 pr-2">
          {filtered.length === 0 && <div className="text-center py-8 text-xs text-muted-foreground">Nenhum ativo encontrado</div>}
          {filtered.map((a) => (
            <div key={a.symbol} onClick={() => onSelect(a.symbol)} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${selectedAsset === a.symbol ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/50"} ${!a.enabled ? "opacity-50" : ""} ${a.status === "quarantined" ? "border-warning/50 bg-warning/5" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{a.symbol}</span>
                  <span className="text-[9px] text-muted-foreground">{CATEGORY_LABELS[a.displayCategory] || a.displayCategory}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">{a.operations} ops</span>
                  <span className={`text-[10px] font-medium ${a.winRate >= 50 ? "text-success" : "text-danger"}`}>{a.winRate.toFixed(1)}% WR</span>
                  <span className={`text-[10px] font-medium ${a.profit >= 0 ? "text-success" : "text-danger"}`}>R${a.profit.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.status === "quarantined" ? (
                  <StatusBadge tone="warning" label="Quarentena" />
                ) : a.confidence >= 70 ? (
                  <StatusBadge tone="success" label={`${a.confidence}%`} />
                ) : a.confidence >= 40 ? (
                  <StatusBadge tone="info" label={`${a.confidence}%`} />
                ) : (
                  <StatusBadge tone="danger" label={`${a.confidence}%`} />
                )}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {a.enabled ? <ShieldCheck className="size-3.5 text-success" /> : <ShieldAlert className="size-3.5 text-danger" />}
                  <Switch checked={a.enabled} onCheckedChange={() => onToggle(a.symbol)} className="scale-75" />
                </div>
                <Eye className="size-3.5 text-muted-foreground shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border pt-2">
        <span>{filtered.filter((a) => a.enabled).length} ativos ativos</span>
        <span>{filtered.filter((a) => a.status === "quarantined").length} em quarentena</span>
        <span>{filtered.length} total</span>
      </div>
    </div>
  );
}
