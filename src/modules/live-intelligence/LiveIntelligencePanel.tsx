import { useState, useEffect, useRef, useMemo } from "react";
import { Scan, Brain, Globe, Zap, Activity, ChevronRight, TrendingUp, TrendingDown, Minus, Target, Droplets, BarChart3, Shield } from "lucide-react";
import type { ScanLogEntry, ScoreBreakdownDisplay, AnalystEventType, BufferAssetEntry } from "../analyst/AnalystTypes";
import { analystBus } from "../analyst/EventBus";
import { useAnalystStore } from "../analyst/AnalystStore";
import { getBestEntryPerAsset } from "../../ranking";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../components/ui/tooltip";

/* ══════════════════════════════════════════════════════════════
   NEXOR AI V2 — LIVE INTELLIGENCE PANEL
   Bloomberg-style real-time scanning + AI reasoning + world map
   ══════════════════════════════════════════════════════════════ */

// ── Types ──
interface ScanPhase {
  label: string;
  icon: React.ReactNode;
  progress: number;
  status: "pending" | "active" | "done";
}

interface AssetCardData {
  asset: string;
  score: number;
  direction?: string;
  blocked: boolean;
  reason: string;
  trend?: string;
  phase: string;
  progress: number;
}

interface TimelineEntry {
  time: string;
  text: string;
  type: "info" | "success" | "warning" | "error";
}

// ── Asset status helpers ──
function getScoreColor(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

function getScoreBg(score: number): string {
  if (score >= 85) return "bg-success/10 border-success/20";
  if (score >= 70) return "bg-warning/10 border-warning/20";
  if (score >= 50) return "bg-warning/10 border-warning/20";
  return "bg-danger/10 border-danger/20";
}

function getTrendIcon(trend?: string) {
  if (trend === "alta" || trend === "UPTREND") return <TrendingUp className="size-3 text-success" />;
  if (trend === "baixa" || trend === "DOWNTREND") return <TrendingDown className="size-3 text-danger" />;
  return <Minus className="size-3 text-muted-foreground" />;
}

function getBarColor(pct: number): string {
  if (pct >= 85) return "bg-success";
  if (pct >= 70) return "bg-warning";
  if (pct >= 50) return "bg-warning";
  return "bg-danger";
}

// ══════════════════════════════════════════════════════════════
// BUFFER PROGRESS BAR — real-time buffer fill visualization
// ══════════════════════════════════════════════════════════════
function getBufferBarColor(percent: number): string {
  if (percent >= 100) return "bg-success";
  if (percent >= 70) return "bg-primary";
  if (percent >= 30) return "bg-warning";
  return "bg-danger";
}

function getHealthDot(health: "live" | "waiting" | "stale"): string {
  if (health === "live") return "bg-success";
  if (health === "waiting") return "bg-warning";
  return "bg-danger";
}

function formatTimeAgo(ms: number): string {
  if (ms <= 0) return "N/A";
  const sec = Math.round((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function BufferAssetCard({ entry }: { entry: BufferAssetEntry }) {
  const { asset, current, capacity, minimum, percent, lastCandleTime, secondsWithoutCandles, isReceiving, bufferHealth, bufferStatus } = entry;
  const barColor = getBufferBarColor(percent);
  const isReady = current >= minimum;
  const markerPct = Math.min(100, Math.round((minimum / capacity) * 100));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative p-2 rounded-lg border border-border bg-panel cursor-default">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className={`size-1.5 rounded-full ${getHealthDot(bufferHealth)} ${isReceiving ? "animate-pulse" : ""}`} />
              <span className="text-[10px] font-mono font-bold text-foreground">{asset}</span>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">
              {current} / {capacity}
            </span>
          </div>

          {/* Progress bar with operational marker */}
          <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{
                width: `${Math.min(100, percent)}%`,
                transition: "width 250ms ease-out",
              }}
            />
            {/* Operational marker */}
            {percent < 100 && (
              <div
                className="absolute top-0 h-full w-px bg-foreground/40"
                style={{ left: `${markerPct}%` }}
              />
            )}
          </div>

          {/* Status text */}
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-muted-foreground">
              {isReady ? (
                <span className="text-success font-bold">Pronto para operar</span>
              ) : (
                <span>Oper. {current} / {minimum}</span>
              )}
            </span>
            <span className={`text-[8px] ${
              bufferHealth === "live" ? "text-success" : bufferHealth === "waiting" ? "text-warning" : "text-danger"
            }`}>
              {bufferStatus}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] max-w-[200px]">
        <div className="space-y-0.5">
          <div className="font-bold">{asset}</div>
          <div>Buffer: {current} / {capacity}</div>
          <div>Percentual: {percent}%</div>
          <div>Min. operacional: {minimum}</div>
          <div>Ultimo candle: {lastCandleTime > 0 ? new Date(lastCandleTime).toLocaleTimeString("pt-BR") : "N/A"}</div>
          <div>Tempo sem candle: {formatTimeAgo(lastCandleTime)}</div>
          <div>Status: {bufferStatus}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Market regions for world map ──
const MARKET_REGIONS = {
  FOREX: ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "USDCHF"],
  CRYPTO: ["BTCUSD", "ETHUSD", "SOLUSD", "DOGEUSD"],
  INDICES: ["US100", "US30", "US500"],
};

// ══════════════════════════════════════════════════════════════
// 1. LASER SCANNER ANIMATION
// ══════════════════════════════════════════════════════════════
function LaserScanner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-lg">
      <div
        className="absolute inset-y-0 w-8 opacity-30"
        style={{
          background: "linear-gradient(90deg, transparent, oklch(0.78 0.19 155 / 0.4), transparent)",
          animation: "laserSweep 2s ease-in-out infinite",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes laserSweep {
          0% { left: -32px; }
          100% { left: calc(100% + 32px); }
        }
      ` }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 2. SCAN PHASE INDICATOR (robot state steps)
// ══════════════════════════════════════════════════════════════
function ScanPhaseIndicator({ phases }: { phases: ScanPhase[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {phases.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide transition-all duration-300 ${
              p.status === "done"
                ? "bg-success/15 text-success border border-success/20"
                : p.status === "active"
                  ? "bg-primary/15 text-primary border border-primary/20 animate-pulse"
                  : "bg-secondary/30 text-muted-foreground border border-border"
            }`}
          >
            {p.icon}
            <span className="truncate max-w-[60px]">{p.label}</span>
            {p.status === "active" && (
              <span className="font-mono text-[7px]">{Math.round(p.progress)}%</span>
            )}
            {p.status === "done" && <span>✔</span>}
          </div>
          {i < phases.length - 1 && (
            <ChevronRight className="size-2.5 text-muted-foreground/30 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 3. ASSET CARD (individual asset with scanner animation)
// ══════════════════════════════════════════════════════════════
function AssetCard({ asset, score, direction, blocked, reason, trend, phase, progress }: AssetCardData) {
  const isActive = phase !== "idle" && phase !== "done";
  const isDone = phase === "done";
  const barColor = blocked ? "bg-danger" : getBarColor(score);

  return (
    <div className={`relative p-2.5 rounded-lg border transition-all duration-300 ${
      isDone && !blocked
        ? "bg-success/5 border-success/15"
        : isDone && blocked
          ? "bg-danger/5 border-danger/15"
          : isActive
            ? "bg-primary/5 border-primary/15"
            : "bg-panel border-border"
    }`}>
      <LaserScanner active={isActive} />

      {/* Header: asset name + trend + score */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {getTrendIcon(trend)}
          <span className="text-[10px] font-mono font-bold text-foreground">{asset}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {direction && (
            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
              direction === "call" || direction === "CALL"
                ? "bg-success/20 text-success"
                : "bg-danger/20 text-danger"
            }`}>
              {direction.toUpperCase()}
            </span>
          )}
          <span className={`text-[10px] font-mono font-bold ${getScoreColor(score)}`}>
            {score > 0 ? score : "—"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${blocked ? 0 : Math.min(100, score || progress)}%` }}
        />
      </div>

      {/* Reason / status */}
      <div className="text-[8px] text-muted-foreground truncate">
        {blocked ? `❌ ${reason}` : isDone && score > 0 ? `✔ Score ${score}` : phase || "Aguardando..."}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 4. AI REASONING PANEL (engine thinking display)
// ══════════════════════════════════════════════════════════════
function AIReasoningPanel({ breakdown, activeAsset }: { breakdown?: ScoreBreakdownDisplay | null; activeAsset?: string }) {
  const filters = breakdown?.filters ?? [];
  const total = breakdown?.total ?? 0;

  const filterIcons: Record<string, React.ReactNode> = {
    "Tendência": <TrendingUp className="size-3" />,
    "LTA/LTB": <BarChart3 className="size-3" />,
    "Suporte/Resistência": <Shield className="size-3" />,
    "Order Block": <Target className="size-3" />,
    "Liquidez": <Droplets className="size-3" />,
    "Pullback": <TrendingDown className="size-3" />,
    "Retração": <Minus className="size-3" />,
    "Força da vela": <Zap className="size-3" />,
    "Continuidade": <Activity className="size-3" />,
    "Nova Alta/Baixa": <TrendingUp className="size-3" />,
    "Smart Money": <Brain className="size-3" />,
    "Volume": <BarChart3 className="size-3" />,
    "Padrão de Candle": <Activity className="size-3" />,
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="size-3.5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-widest text-primary uppercase">NEXOR AI THINKING</div>
            {activeAsset && (
              <div className="text-[8px] text-muted-foreground">{activeAsset}</div>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className={`text-lg font-bold font-mono ${getScoreColor(total)}`}>{total}</div>
        )}
      </div>

      {/* Score bar */}
      {total > 0 && (
        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(total)}`}
            style={{ width: `${total}%` }}
          />
        </div>
      )}

      {/* Filter breakdown */}
      {filters.length > 0 && (
        <div className="space-y-1">
          {filters.map((f, i) => {
            const pct = f.maxPoints > 0 ? (f.points / f.maxPoints) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-24 shrink-0">
                  {filterIcons[f.name] ?? <Activity className="size-3 text-muted-foreground" />}
                  <span className="text-[8px] text-muted-foreground truncate">{f.name}</span>
                </div>
                <div className="flex-1 h-1 bg-secondary/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct >= 70 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-danger"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-muted-foreground w-8 text-right">
                  {f.points}/{f.maxPoints}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Strategy badge */}
      {breakdown?.strategy && (
        <div className="text-[8px] text-center py-1 rounded bg-secondary/20 text-muted-foreground">
          Estratégia: <span className="text-foreground font-semibold">{breakdown.strategy}</span>
        </div>
      )}

      {/* Entry/refusal reason */}
      {breakdown?.entryReason && (
        <div className="text-[8px] text-success bg-success/5 rounded p-1.5 border border-success/10">
          ✔ {breakdown.entryReason}
        </div>
      )}
      {breakdown?.refusalReason && (
        <div className="text-[8px] text-danger bg-danger/5 rounded p-1.5 border border-danger/10">
          ❌ {breakdown.refusalReason}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 5. WORLD ASSETS MAP (regional status display)
// ══════════════════════════════════════════════════════════════
function WorldAssetsMap({ scanLog }: { scanLog: ScanLogEntry[] }) {
  const assetMap = getBestEntryPerAsset(scanLog);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="size-3.5 text-primary" />
        <span className="text-[9px] font-bold tracking-widest text-primary uppercase">CATALOGAÇÃO MUNDIAL</span>
      </div>

      {Object.entries(MARKET_REGIONS).map(([region, assets]) => (
        <div key={region}>
          <div className="text-[8px] font-bold tracking-wider text-muted-foreground/60 uppercase mb-1">{region}</div>
          <div className="flex flex-wrap gap-1">
            {assets.map((asset) => {
              const entry = assetMap.get(asset);
              const hasData = !!entry;
              const passed = hasData && !entry!.blocked;
              const score = entry?.score ?? 0;

              return (
                <div
                  key={asset}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono transition-all duration-300 ${
                    passed
                      ? "bg-success/10 text-success border border-success/15"
                      : hasData && entry!.blocked
                        ? "bg-danger/10 text-danger border border-danger/15"
                        : "bg-secondary/20 text-muted-foreground/50 border border-border/50"
                  }`}
                >
                  <div className={`size-1.5 rounded-full ${
                    passed ? "bg-success animate-pulse" : hasData && entry!.blocked ? "bg-danger" : "bg-muted-foreground/30"
                  }`} />
                  <span className="truncate">{asset.replace("USD", "").replace("USDT", "")}</span>
                  {passed && <span className="font-bold">{score}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 6. LIVE TIMELINE (auto-scrolling event feed)
// ══════════════════════════════════════════════════════════════
function LiveTimeline({ entries }: { entries: TimelineEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length]);

  const typeColor: Record<string, string> = {
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    error: "text-danger",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1.5">
        <Activity className="size-3.5 text-primary" />
        <span className="text-[9px] font-bold tracking-widest text-primary uppercase">TIMELINE</span>
      </div>
      <div ref={containerRef} className="max-h-[120px] overflow-y-auto space-y-0.5 scrollbar-thin">
        {entries.slice(-20).map((e, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[8px] font-mono tab-in" style={{ animationDelay: `${i * 30}ms` }}>
            <span className="text-muted-foreground/40 shrink-0 w-14">{e.time}</span>
            <span className={typeColor[e.type] ?? "text-muted-foreground"}>{e.text}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-[8px] text-muted-foreground/40 text-center py-2">Aguardando eventos...</div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 7. ROBOT STATUS BAR (top status indicator)
// ══════════════════════════════════════════════════════════════
function RobotStatusBar({ status, scanProgress, catalogProgress, assetCount }: { status: string; scanProgress: number; catalogProgress: { scanned: number; total: number } | null; assetCount: number }) {
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    running: { color: "text-success", bg: "bg-success/10", label: "MERCADO ABERTO" },
    paused: { color: "text-warning", bg: "bg-warning/10", label: "PAUSADO" },
    stopped: { color: "text-danger", bg: "bg-danger/10", label: "OFFLINE" },
  };
  const cfg = statusConfig[status] ?? statusConfig.stopped;

  return (
    <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${cfg.bg} border border-border`}>
      <div className="flex items-center gap-2">
        <div className={`size-2 rounded-full ${cfg.color.replace("text-", "bg-")} animate-pulse`} />
        <span className={`text-[9px] font-bold tracking-wider ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="flex items-center gap-3">
        {catalogProgress && catalogProgress.total > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="text-[8px] text-muted-foreground">
              Catalogo <span className="font-mono text-foreground">{catalogProgress.scanned}/{catalogProgress.total}</span>
            </div>
            <div className="w-12 h-1 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((catalogProgress.scanned / catalogProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="text-[8px] text-muted-foreground">
          Scanner <span className="font-mono text-foreground">{Math.round(scanProgress)}%</span>
        </div>
        <div className="text-[8px] text-muted-foreground">
          Ativos <span className="font-mono text-foreground">{assetCount}</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 8. PROFILE TRANSITION OVERLAY
// ══════════════════════════════════════════════════════════════
function ProfileTransitionOverlay({ show, profile }: { show: boolean; profile: string }) {
  if (!show) return null;

  const steps = [
    "Inicializando",
    "Candles",
    "Indicadores",
    "IA",
    "Scanner",
    "Catálogo",
    "Ranking",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="text-center space-y-4 fade-in">
        <div className="text-[10px] font-bold tracking-[0.3em] text-primary/60 uppercase mb-2">
          ═══════════════════════
        </div>
        <Zap className="size-8 text-primary mx-auto animate-pulse" />
        <div className="text-[10px] font-bold tracking-[0.3em] text-primary uppercase">
          Inicializando
        </div>
        <div className="text-xl font-bold text-foreground tracking-wide">
          {profile} ENGINE
        </div>
        <div className="text-[10px] font-bold tracking-[0.3em] text-primary/60 uppercase">
          ═══════════════════════
        </div>
        <div className="space-y-1.5 max-w-[200px] mx-auto">
          {steps.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2 text-[10px] text-muted-foreground/60 tab-in"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div className="h-0.5 flex-1 bg-secondary/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: "0%",
                    animation: `profileFill 0.3s ease-out ${i * 200 + 100}ms forwards`,
                  }}
                />
              </div>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="text-[9px] font-bold text-success tracking-wider tab-in" style={{ animationDelay: "1800ms" }}>
          🚀 ONLINE
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes profileFill {
            to { width: 100%; }
          }
        ` }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN PANEL
// ══════════════════════════════════════════════════════════════
export function LiveIntelligencePanel() {
  const store = useAnalystStore();
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [showProfileTransition, setShowProfileTransition] = useState(false);

  // Derived from store — single source of truth
  const activeAsset = store.market.asset;
  const scanProgress = store.market.scanProgress;
  const currentProfile = store.market.profile;

  // Scan phases derived from engine phase
  const scanPhases: ScanPhase[] = useMemo(() => {
    const phases = [
      { label: "Trend", icon: <TrendingUp className="size-2.5" />, progress: 0, status: "pending" as const },
      { label: "Momentum", icon: <Zap className="size-2.5" />, progress: 0, status: "pending" as const },
      { label: "Liquidez", icon: <Droplets className="size-2.5" />, progress: 0, status: "pending" as const },
      { label: "Estrutura", icon: <Shield className="size-2.5" />, progress: 0, status: "pending" as const },
      { label: "Probability", icon: <Target className="size-2.5" />, progress: 0, status: "pending" as const },
    ];
    const phaseMap: Record<string, number> = {
      trending: 0, scoring: 1, momentum: 2, structure: 3, done: 4,
    };
    const current = phaseMap[store.market.analysisPhase] ?? -1;
    return phases.map((p, i) => {
      if (i < current) return { ...p, progress: 100, status: "done" as const };
      if (i === current) return { ...p, progress: 50, status: "active" as const };
      return p;
    });
  }, [store.market.analysisPhase]);

  // Subscribe to events — only for timeline and scanLog updates
  useEffect(() => {
    const unsub = analystBus.subscribe((type: AnalystEventType, meta?: Record<string, unknown>) => {
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      switch (type) {
        case "scanLog.update":
          if (meta?.scanLog) {
            const entries = meta.scanLog as ScanLogEntry[];
            setScanLog(Array.from(getBestEntryPerAsset(entries).values()));
          }
          break;
        case "analysis.started":
          if (meta?.asset) {
            setTimeline((prev) => [...prev, { time: now, text: `🔍 ${meta.asset} escaneando...`, type: "info" }]);
          }
          break;
        case "analysis.completed":
          if (meta?.direction) {
            setTimeline((prev) => [...prev, { time: now, text: `🎯 ${meta!.asset} → ${meta!.direction} (Score: ${meta!.score ?? "?"})`, type: "success" }]);
          } else if (meta?.asset) {
            setTimeline((prev) => [...prev, { time: now, text: `❌ ${meta!.asset} bloqueado`, type: "warning" }]);
          }
          break;
        case "score.updated":
          if (meta?.asset && typeof meta.score === "number") {
            setScanLog((prev) => {
              const idx = prev.findIndex((e) => e.asset === meta.asset);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  score: meta.score as number,
                  direction: (meta.direction as string) ?? updated[idx].direction,
                  blocked: !meta.direction,
                  reason: meta.direction
                    ? `✅ ${(meta.direction as string).toUpperCase()} — Score: ${meta.score}/100`
                    : (meta.blockedReasons as string[])?.[0] ?? updated[idx].reason,
                };
                return updated;
              }
              return prev;
            });
          }
          break;
        case "candle.new":
          if (meta?.symbol) {
            setTimeline((prev) => [...prev.slice(-19), { time: now, text: `📥 Candle ${meta.symbol}`, type: "info" }]);
          }
          break;
      }
    });
    return unsub;
  }, []);

  // Build asset cards from scanLog
  const assetCards: AssetCardData[] = scanLog.map((entry) => ({
    asset: entry.asset,
    score: entry.score,
    direction: entry.direction,
    blocked: entry.blocked,
    reason: entry.reason,
    trend: entry.trend,
    phase: entry.blocked ? "done" : entry.score > 0 ? "done" : "scanning",
    progress: entry.score > 0 ? entry.score : entry.blocked ? 0 : scanProgress,
  }));

  return (
    <div className="space-y-3 fade-in">
      {/* Profile Transition Overlay */}
      <ProfileTransitionOverlay show={showProfileTransition} profile={currentProfile} />

      {/* Robot Status Bar */}
      <RobotStatusBar
        status={
          ["analyzing", "waiting", "continuity", "recovery", "preparing", "validating"].includes(store.currentStatus)
            ? "running"
            : store.currentStatus === "idle"
              ? "stopped"
              : "paused"
        }
        scanProgress={scanProgress}
        catalogProgress={store.market.catalogProgress}
        assetCount={scanLog.length}
      />

      {/* Buffer Progress Bar — real-time candle fill per asset */}
      {Object.keys(store.bufferAssets).length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="size-3 text-muted-foreground" />
            <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Buffer Status</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.values(store.bufferAssets).map((entry) => (
              <BufferAssetCard key={entry.asset} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Phase Indicator */}
      {scanPhases.length > 0 && (
        <div className="panel p-2">
          <ScanPhaseIndicator phases={scanPhases} />
        </div>
      )}

      {/* Main Grid: Asset Cards + AI Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Asset Cards Grid */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Scan className="size-3.5 text-primary" />
            <span className="text-[9px] font-bold tracking-widest text-primary uppercase">LIVE SCAN ENGINE</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {assetCards.slice(0, 12).map((card) => (
              <AssetCard key={card.asset} {...card} />
            ))}
            {assetCards.length === 0 && (
              <div className="col-span-full text-center py-6 text-[10px] text-muted-foreground/40">
                Aguardando dados do scanner...
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Reasoning Panel */}
        <div className="space-y-3">
          <div className="panel p-3">
            <AIReasoningPanel breakdown={store.scoreBreakdown} activeAsset={activeAsset} />
          </div>

          {/* World Map */}
          <div className="panel p-3">
            <WorldAssetsMap scanLog={scanLog} />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="panel p-3">
        <LiveTimeline entries={timeline} />
      </div>
    </div>
  );
}
