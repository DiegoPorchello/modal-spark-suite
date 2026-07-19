import type { DecisionContext } from "../../flow-continuity/types/decision-context.types";
import type { OperationContext } from "../../flow-continuity/types/operation-context.types";
import type { ReplayContext } from "../../flow-continuity/types/replay-context.types";
import type {
  PerformanceContext,
  StrategyPerformance,
  AssetPerformance,
  HourPerformance,
  TrendPerformance,
  FilterPerformance,
  RecentTrade,
  PerformanceInsight,
  PerformanceInsightSeverity,
  PerformanceInsightCategory,
  RobotHealthScore,
  HeatmapData,
  HeatmapCell,
  PerformanceTrend,
  PerformanceSnapshot,
} from "../types/performance-context.types";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function computeStreaks(results: ("WIN" | "LOSS" | "BREAKEVEN" | "TIMEOUT")[]): {
  currentWin: number;
  currentLoss: number;
  longestWin: number;
  longestLoss: number;
} {
  let currentWin = 0;
  let currentLoss = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let tempWin = 0;
  let tempLoss = 0;

  for (const r of results) {
    if (r === "WIN") {
      tempWin++;
      tempLoss = 0;
      longestWin = Math.max(longestWin, tempWin);
    } else if (r === "LOSS") {
      tempLoss++;
      tempWin = 0;
      longestLoss = Math.max(longestLoss, tempLoss);
    } else {
      tempWin = 0;
      tempLoss = 0;
    }
  }

  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === "WIN") {
      currentWin++;
    } else if (results[i] === "LOSS") {
      currentLoss++;
    } else {
      break;
    }
  }

  return { currentWin, currentLoss, longestWin, longestLoss };
}

// ══════════════════════════════════════════════════════════════════════════
// ROBOT HEALTH SCORE (0-100)
// ══════════════════════════════════════════════════════════════════════════

export function computeRobotHealthScore(params: {
  winRate: number;
  profitFactor: number;
  averageLatency: number;
  currentLossStreak: number;
  totalTrades: number;
  netProfit: number;
}): RobotHealthScore {
  const { winRate, profitFactor, averageLatency, currentLossStreak, totalTrades, netProfit } = params;

  // Win Rate component (0-25 points)
  const winRateScore = Math.min(25, (winRate / 100) * 25);

  // Profit Factor component (0-25 points)
  const pfScore = Math.min(25, (Math.min(profitFactor, 3) / 3) * 25);

  // Latency component (0-20 points) — lower is better
  const latencyScore = Math.min(20, averageLatency <= 100 ? 20 : averageLatency <= 300 ? 15 : averageLatency <= 500 ? 10 : averageLatency <= 1000 ? 5 : 0);

  // Loss streak penalty (0-15 points) — fewer losses is better
  const lossStreakScore = currentLossStreak === 0 ? 15 : currentLossStreak === 1 ? 12 : currentLossStreak === 2 ? 9 : currentLossStreak <= 4 ? 5 : 0;

  // Consistency component (0-15 points) — more trades + positive profit = more consistent
  const consistencyScore = Math.min(15, (totalTrades >= 50 ? 10 : totalTrades >= 20 ? 7 : totalTrades >= 5 ? 4 : 0) + (netProfit > 0 ? 5 : 0));

  const total = Math.round(winRateScore + pfScore + latencyScore + lossStreakScore + consistencyScore);

  let label: string;
  let color: string;
  if (total >= 80) {
    label = "EXCELENTE";
    color = "text-emerald-400";
  } else if (total >= 60) {
    label = "BOM";
    color = "text-green-400";
  } else if (total >= 40) {
    label = "REGULAR";
    color = "text-amber-400";
  } else if (total >= 20) {
    label = "RUIM";
    color = "text-orange-400";
  } else {
    label = "CRÍTICO";
    color = "text-red-400";
  }

  return {
    score: total,
    label,
    color,
    breakdown: {
      winRate: Math.round(winRateScore * 100) / 100,
      profitFactor: Math.round(pfScore * 100) / 100,
      latency: Math.round(latencyScore * 100) / 100,
      lossStreak: Math.round(lossStreakScore * 100) / 100,
      consistency: Math.round(consistencyScore * 100) / 100,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// HEATMAP BUILDER
// ══════════════════════════════════════════════════════════════════════════

function buildHourStrategyHeatmap(replays: ReplayContext[]): HeatmapData {
  const strategies = new Set<string>();
  const hours = new Set<number>();
  const data = new Map<string, { wins: number; total: number }>();

  for (const r of replays) {
    const hour = new Date(r.operationContext.timestamp).getHours();
    const strategy = r.operationContext.strategyName;
    strategies.add(strategy);
    hours.add(hour);
    const key = `${hour}|${strategy}`;
    const existing = data.get(key) || { wins: 0, total: 0 };
    existing.total++;
    if (r.result === "WIN") existing.wins++;
    data.set(key, existing);
  }

  const sortedHours = Array.from(hours).sort((a, b) => a - b);
  const sortedStrategies = Array.from(strategies);
  const cells: HeatmapCell[] = [];

  for (const hour of sortedHours) {
    for (const strategy of sortedStrategies) {
      const key = `${hour}|${strategy}`;
      const d = data.get(key);
      const winRate = d ? Math.round(safeDiv(d.wins, d.total) * 100) : 0;
      cells.push({
        row: `${hour}h`,
        col: strategy,
        value: winRate,
        label: d ? `${d.wins}/${d.total} (${winRate}%)` : "0/0",
      });
    }
  }

  return {
    title: "HORÁRIO × ESTRATÉGIA",
    rows: sortedHours.map((h) => `${h}h`),
    cols: sortedStrategies,
    cells,
  };
}

function buildAssetHourHeatmap(replays: ReplayContext[]): HeatmapData {
  const assets = new Set<string>();
  const hours = new Set<number>();
  const data = new Map<string, { wins: number; total: number }>();

  for (const r of replays) {
    const hour = new Date(r.operationContext.timestamp).getHours();
    const asset = r.operationContext.asset;
    assets.add(asset);
    hours.add(hour);
    const key = `${hour}|${asset}`;
    const existing = data.get(key) || { wins: 0, total: 0 };
    existing.total++;
    if (r.result === "WIN") existing.wins++;
    data.set(key, existing);
  }

  const sortedHours = Array.from(hours).sort((a, b) => a - b);
  const sortedAssets = Array.from(assets);
  const cells: HeatmapCell[] = [];

  for (const hour of sortedHours) {
    for (const asset of sortedAssets) {
      const key = `${hour}|${asset}`;
      const d = data.get(key);
      const winRate = d ? Math.round(safeDiv(d.wins, d.total) * 100) : 0;
      cells.push({
        row: `${hour}h`,
        col: asset,
        value: winRate,
        label: d ? `${d.wins}/${d.total} (${winRate}%)` : "0/0",
      });
    }
  }

  return {
    title: "HORÁRIO × ATIVO",
    rows: sortedHours.map((h) => `${h}h`),
    cols: sortedAssets,
    cells,
  };
}

function buildDayWeekHeatmap(replays: ReplayContext[]): HeatmapData {
  const DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  const hours = new Set<number>();
  const dayWins = new Map<number, Map<number, { wins: number; total: number }>>();

  for (const r of replays) {
    const d = new Date(r.operationContext.timestamp);
    const day = d.getDay();
    const hour = d.getHours();
    hours.add(hour);

    if (!dayWins.has(day)) dayWins.set(day, new Map());
    const hourMap = dayWins.get(day)!;
    const existing = hourMap.get(hour) || { wins: 0, total: 0 };
    existing.total++;
    if (r.result === "WIN") existing.wins++;
    hourMap.set(hour, existing);
  }

  const sortedHours = Array.from(hours).sort((a, b) => a - b);
  const cells: HeatmapCell[] = [];

  for (let day = 0; day < 7; day++) {
    for (const hour of sortedHours) {
      const hourMap = dayWins.get(day);
      const d = hourMap?.get(hour);
      const winRate = d ? Math.round(safeDiv(d.wins, d.total) * 100) : 0;
      cells.push({
        row: DAYS_PT[day],
        col: `${hour}h`,
        value: winRate,
        label: d ? `${d.wins}/${d.total} (${winRate}%)` : "0/0",
      });
    }
  }

  return {
    title: "DIA DA SEMANA × HORÁRIO",
    rows: DAYS_PT,
    cols: sortedHours.map((h) => `${h}h`),
    cells,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// TREND BUILDER
// ══════════════════════════════════════════════════════════════════════════

function buildTrends(replays: ReplayContext[]): PerformanceTrend[] {
  const now = Date.now();
  const DAY = 86400000;

  const last7d = replays.filter((r) => now - r.operationContext.timestamp < 7 * DAY);
  const last30d = replays.filter((r) => now - r.operationContext.timestamp < 30 * DAY);

  function computeMetrics(subset: ReplayContext[]) {
    const completed = subset.filter((r) => r.result === "WIN" || r.result === "LOSS" || r.result === "BREAKEVEN");
    const total = completed.length;
    const wins = completed.filter((r) => r.result === "WIN").length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const profits = completed.map((r) => r.operationContext.profit);
    const grossProfit = profits.filter((p) => p > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(profits.filter((p) => p < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? Math.round(safeDiv(grossProfit, grossLoss) * 100) / 100 : grossProfit > 0 ? 999.99 : 0;
    const scores = completed.map((r) => r.operationContext.score);
    const confidences = completed.map((r) => r.decisionContext.confidence);
    const latencies = completed.map((r) => r.operationContext.executionLatency);
    return {
      winRate,
      profitFactor,
      averageScore: Math.round(avg(scores)),
      averageConfidence: Math.round(avg(confidences) * 100) / 100,
      averageLatency: Math.round(avg(latencies)),
      netProfit: Math.round((grossProfit - grossLoss) * 100) / 100,
    };
  }

  const current = computeMetrics(replays);
  const prev7d = computeMetrics(last7d);
  const prev30d = computeMetrics(last30d);

  function direction(currentVal: number, prev7: number): "up" | "down" | "stable" {
    if (currentVal > prev7 * 1.05) return "up";
    if (currentVal < prev7 * 0.95) return "down";
    return "stable";
  }

  return [
    {
      label: "Win Rate",
      current: current.winRate,
      previous7d: prev7d.winRate,
      previous30d: prev30d.winRate,
      direction: direction(current.winRate, prev7d.winRate),
    },
    {
      label: "Profit Factor",
      current: current.profitFactor,
      previous7d: prev7d.profitFactor,
      previous30d: prev30d.profitFactor,
      direction: direction(current.profitFactor, prev7d.profitFactor),
    },
    {
      label: "Score Médio",
      current: current.averageScore,
      previous7d: prev7d.averageScore,
      previous30d: prev30d.averageScore,
      direction: direction(current.averageScore, prev7d.averageScore),
    },
    {
      label: "Confiança Média",
      current: current.averageConfidence,
      previous7d: prev7d.averageConfidence,
      previous30d: prev30d.averageConfidence,
      direction: direction(current.averageConfidence, prev7d.averageConfidence),
    },
    {
      label: "Latência Média",
      current: current.averageLatency,
      previous7d: prev7d.averageLatency,
      previous30d: prev30d.averageLatency,
      direction: direction(current.averageLatency, prev7d.averageLatency) === "up" ? "down" : direction(current.averageLatency, prev7d.averageLatency) === "down" ? "up" : "stable",
    },
  ];
}

// ══════════════════════════════════════════════════════════════════════════
// BUILD FUNCTIONS (existing + enhanced)
// ══════════════════════════════════════════════════════════════════════════

function buildByStrategy(replays: ReplayContext[]): StrategyPerformance[] {
  const map = new Map<string, {
    strategyId: string;
    strategyName: string;
    trades: number;
    wins: number;
    losses: number;
    draws: number;
    profit: number;
    scores: number[];
    confidences: number[];
  }>();

  for (const r of replays) {
    const o = r.operationContext;
    const d = r.decisionContext;
    const key = o.strategyId;
    if (!map.has(key)) {
      map.set(key, {
        strategyId: o.strategyId,
        strategyName: o.strategyName,
        trades: 0, wins: 0, losses: 0, draws: 0,
        profit: 0, scores: [], confidences: [],
      });
    }
    const entry = map.get(key)!;
    entry.trades++;
    if (r.result === "WIN") entry.wins++;
    else if (r.result === "LOSS") entry.losses++;
    else entry.draws++;
    entry.profit += o.profit;
    entry.scores.push(o.score);
    entry.confidences.push(d.confidence);
  }

  return Array.from(map.values()).map((s) => ({
    strategyId: s.strategyId,
    strategyName: s.strategyName,
    totalTrades: s.trades,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    winRate: Math.round(safeDiv(s.wins, s.trades) * 100),
    netProfit: Math.round(s.profit * 100) / 100,
    averageScore: Math.round(avg(s.scores)),
    averageConfidence: Math.round(avg(s.confidences) * 100) / 100,
    profitFactor: Math.round(safeDiv(s.profit > 0 ? s.profit : 0, s.profit < 0 ? Math.abs(s.profit) : 1) * 100) / 100,
  }));
}

function buildByAsset(replays: ReplayContext[]): AssetPerformance[] {
  const map = new Map<string, {
    asset: string; trades: number; wins: number; losses: number;
    profit: number; scores: number[];
  }>();

  for (const r of replays) {
    const o = r.operationContext;
    const key = o.asset;
    if (!map.has(key)) {
      map.set(key, { asset: o.asset, trades: 0, wins: 0, losses: 0, profit: 0, scores: [] });
    }
    const entry = map.get(key)!;
    entry.trades++;
    if (r.result === "WIN") entry.wins++;
    else if (r.result === "LOSS") entry.losses++;
    entry.profit += o.profit;
    entry.scores.push(o.score);
  }

  return Array.from(map.values()).map((a) => ({
    asset: a.asset,
    totalTrades: a.trades,
    wins: a.wins,
    losses: a.losses,
    winRate: Math.round(safeDiv(a.wins, a.trades) * 100),
    netProfit: Math.round(a.profit * 100) / 100,
    averageScore: Math.round(avg(a.scores)),
  }));
}

function buildByHour(replays: ReplayContext[]): HourPerformance[] {
  const map = new Map<number, {
    hour: number; trades: number; wins: number; losses: number; profit: number;
  }>();

  for (const r of replays) {
    const hour = new Date(r.operationContext.timestamp).getHours();
    if (!map.has(hour)) {
      map.set(hour, { hour, trades: 0, wins: 0, losses: 0, profit: 0 });
    }
    const entry = map.get(hour)!;
    entry.trades++;
    if (r.result === "WIN") entry.wins++;
    else if (r.result === "LOSS") entry.losses++;
    entry.profit += r.operationContext.profit;
  }

  return Array.from(map.values())
    .map((h) => ({
      hour: h.hour,
      totalTrades: h.trades,
      wins: h.wins,
      losses: h.losses,
      winRate: Math.round(safeDiv(h.wins, h.trades) * 100),
      netProfit: Math.round(h.profit * 100) / 100,
    }))
    .sort((a, b) => a.hour - b.hour);
}

function buildByTrend(replays: ReplayContext[]): TrendPerformance[] {
  const map = new Map<string, {
    trend: string; trades: number; wins: number; losses: number; profit: number;
  }>();

  for (const r of replays) {
    const trend = r.decisionContext.trend;
    if (!map.has(trend)) {
      map.set(trend, { trend, trades: 0, wins: 0, losses: 0, profit: 0 });
    }
    const entry = map.get(trend)!;
    entry.trades++;
    if (r.result === "WIN") entry.wins++;
    else if (r.result === "LOSS") entry.losses++;
    entry.profit += r.operationContext.profit;
  }

  return Array.from(map.values()).map((t) => ({
    trend: t.trend,
    totalTrades: t.trades,
    wins: t.wins,
    losses: t.losses,
    winRate: Math.round(safeDiv(t.wins, t.trades) * 100),
    netProfit: Math.round(t.profit * 100) / 100,
  }));
}

function buildByFilter(replays: ReplayContext[]): FilterPerformance[] {
  const map = new Map<string, {
    filterName: string;
    approvals: number;
    rejections: number;
    approvalWins: number;
    rejectionWins: number;
    contributions: number[];
  }>();

  for (const r of replays) {
    const d = r.decisionContext;
    const isWin = r.result === "WIN";

    for (const f of d.approvedFilters) {
      if (!map.has(f.name)) {
        map.set(f.name, {
          filterName: f.name, approvals: 0, rejections: 0,
          approvalWins: 0, rejectionWins: 0, contributions: [],
        });
      }
      const entry = map.get(f.name)!;
      entry.approvals++;
      if (isWin) entry.approvalWins++;
      entry.contributions.push(f.contribution);
    }

    for (const f of d.rejectedFilters) {
      if (!map.has(f.name)) {
        map.set(f.name, {
          filterName: f.name, approvals: 0, rejections: 0,
          approvalWins: 0, rejectionWins: 0, contributions: [],
        });
      }
      const entry = map.get(f.name)!;
      entry.rejections++;
      if (isWin) entry.rejectionWins++;
    }
  }

  return Array.from(map.values()).map((f) => ({
    filterName: f.filterName,
    totalApprovals: f.approvals,
    totalRejections: f.rejections,
    approvalWinRate: Math.round(safeDiv(f.approvalWins, f.approvals) * 100),
    rejectionWinRate: Math.round(safeDiv(f.rejectionWins, f.rejections) * 100),
    averageContribution: Math.round(avg(f.contributions) * 100) / 100,
  }));
}

function buildRecentTrades(replays: ReplayContext[], limit: number = 20): RecentTrade[] {
  return replays.slice(0, limit).map((r) => ({
    id: r.replayId,
    timestamp: r.operationContext.timestamp,
    asset: r.operationContext.asset,
    direction: r.operationContext.direction,
    strategyName: r.operationContext.strategyName,
    score: r.operationContext.score,
    result: r.result === "TIMEOUT" ? "LOSS" : r.result,
    profit: r.operationContext.profit,
    durationMs: r.durationMs,
  }));
}

function buildInsights(
  byStrategy: StrategyPerformance[],
  byAsset: AssetPerformance[],
  byHour: HourPerformance[],
  byTrend: TrendPerformance[],
  byFilter: FilterPerformance[],
  winRate: number,
  profitFactor: number,
  currentWinStreak: number,
  currentLossStreak: number,
  robotHealth: RobotHealthScore,
): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  let idCounter = 0;
  const now = Date.now();

  function addInsight(
    type: "positive" | "negative" | "neutral" | "warning",
    severity: PerformanceInsightSeverity,
    category: PerformanceInsightCategory,
    title: string,
    description: string,
    metric?: number,
  ) {
    insights.push({
      id: `insight-${++idCounter}`,
      type,
      severity,
      category,
      title,
      description,
      text: description,
      metric,
      timestamp: now,
    });
  }

  // Best strategy
  if (byStrategy.length > 0) {
    const best = byStrategy.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    if (best.totalTrades >= 3) {
      addInsight(
        "positive",
        "SUCCESS",
        "strategy",
        "Melhor Estratégia",
        `${best.strategyName} — ${best.winRate}% WR, ${best.totalTrades} trades, R$ ${best.netProfit.toFixed(2)}`,
        best.winRate,
      );
    }
  }

  // Worst strategy
  if (byStrategy.length > 1) {
    const worst = byStrategy.reduce((a, b) => (a.winRate < b.winRate ? a : b));
    if (worst.totalTrades >= 3 && worst.winRate < 40) {
      addInsight(
        "negative",
        "DANGER",
        "strategy",
        "Estratégia em Queda",
        `${worst.strategyName} — ${worst.winRate}% WR (atenção)`,
        worst.winRate,
      );
    }
  }

  // Best asset
  if (byAsset.length > 0) {
    const best = byAsset.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    if (best.totalTrades >= 3) {
      addInsight(
        "positive",
        "SUCCESS",
        "asset",
        "Melhor Ativo",
        `${best.asset} — ${best.winRate}% WR, +R$ ${best.netProfit.toFixed(2)}`,
        best.winRate,
      );
    }
  }

  // Worst asset
  if (byAsset.length > 1) {
    const worst = byAsset.reduce((a, b) => (a.netProfit < b.netProfit ? a : b));
    if (worst.totalTrades >= 3 && worst.netProfit < 0) {
      addInsight(
        "warning",
        "WARNING",
        "asset",
        "Ativo com Prejuízo",
        `${worst.asset} — R$ ${worst.netProfit.toFixed(2)}`,
        worst.netProfit,
      );
    }
  }

  // Best hour
  const profitableHours = byHour.filter((h) => h.netProfit > 0 && h.totalTrades >= 2);
  if (profitableHours.length > 0) {
    const best = profitableHours.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    addInsight(
      "positive",
      "SUCCESS",
      "time",
      "Horário Mais Lucrativo",
      `${best.hour}h — ${best.winRate}% WR`,
      best.hour,
    );
  }

  // Critical hour
  const lossHours = byHour.filter((h) => h.netProfit < 0 && h.totalTrades >= 2);
  if (lossHours.length > 0) {
    const worst = lossHours.reduce((a, b) => (a.netProfit < b.netProfit ? a : b));
    addInsight(
      "warning",
      "WARNING",
      "time",
      "Horário Crítico",
      `${worst.hour}h — ${worst.netProfit.toFixed(2)} de prejuízo`,
      worst.hour,
    );
  }

  // Best trend
  if (byTrend.length > 0) {
    const best = byTrend.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    if (best.totalTrades >= 3) {
      addInsight(
        "positive",
        "INFO",
        "general",
        "Melhor Tendência",
        `${best.trend} — ${best.winRate}% WR`,
        best.winRate,
      );
    }
  }

  // Filter insights
  const highWinFilters = byFilter.filter((f) => f.approvalWinRate >= 70 && f.totalApprovals >= 3);
  if (highWinFilters.length > 0) {
    const best = highWinFilters.reduce((a, b) => (a.approvalWinRate > b.approvalWinRate ? a : b));
    addInsight(
      "positive",
      "SUCCESS",
      "filter",
      "Filtro Mais Eficiente",
      `${best.filterName} — ${best.approvalWinRate}% WR quando aprovado`,
      best.approvalWinRate,
    );
  }

  const lowWinFilters = byFilter.filter((f) => f.approvalWinRate < 40 && f.totalApprovals >= 3);
  if (lowWinFilters.length > 0) {
    const worst = lowWinFilters.reduce((a, b) => (a.approvalWinRate < b.approvalWinRate ? a : b));
    addInsight(
      "warning",
      "WARNING",
      "filter",
      "Filtro Menos Confiável",
      `${worst.filterName} — ${worst.approvalWinRate}% WR quando aprovado`,
      worst.approvalWinRate,
    );
  }

  // Streak insights
  if (currentWinStreak >= 3) {
    addInsight(
      "positive",
      "SUCCESS",
      "streak",
      "Sequência de WIN",
      `${currentWinStreak} vitórias consecutivas`,
      currentWinStreak,
    );
  }
  if (currentLossStreak >= 3) {
    addInsight(
      "negative",
      "DANGER",
      "streak",
      "Sequência de LOSS",
      `${currentLossStreak} derrotas consecutivas — atenção!`,
      currentLossStreak,
    );
  }

  // Profit factor
  if (profitFactor > 2) {
    addInsight(
      "positive",
      "SUCCESS",
      "general",
      "Profit Factor Excelente",
      `${profitFactor.toFixed(2)}x — operando com vantagem`,
      profitFactor,
    );
  } else if (profitFactor < 1) {
    addInsight(
      "negative",
      "DANGER",
      "general",
      "Profit Factor Baixo",
      `${profitFactor.toFixed(2)}x — operando no prejuízo`,
      profitFactor,
    );
  }

  // Health score
  if (robotHealth.score < 30) {
    addInsight(
      "negative",
      "DANGER",
      "health",
      "Saúde do Robô Crítica",
      `Score: ${robotHealth.score}/100 — considere pausar operações`,
      robotHealth.score,
    );
  } else if (robotHealth.score >= 80) {
    addInsight(
      "positive",
      "SUCCESS",
      "health",
      "Saúde do Robô Excelente",
      `Score: ${robotHealth.score}/100 — tudo operando bem`,
      robotHealth.score,
    );
  }

  return insights;
}

// ══════════════════════════════════════════════════════════════════════════
// SNAPSHOT BUILDER
// ══════════════════════════════════════════════════════════════════════════

export function buildSnapshot(ctx: PerformanceContext): PerformanceSnapshot {
  return {
    timestamp: ctx.generatedAt,
    winRate: ctx.winRate,
    profitFactor: ctx.profitFactor,
    netProfit: ctx.netProfit,
    averageScore: ctx.averageScore,
    averageConfidence: ctx.averageConfidence,
    averageLatency: ctx.averageLatency,
    totalTrades: ctx.totalTrades,
    healthScore: ctx.robotHealth.score,
  };
}

/**
 * Pure utility — builds a PerformanceContext from arrays of the three contexts.
 *
 * Does NOT execute trades, recalculate scores, or make decisions.
 * ONLY measures, ranks, and generates insights from historical data.
 */
export function buildPerformanceContext(
  decisionHistory: DecisionContext[],
  operationHistory: OperationContext[],
  replayHistory: ReplayContext[],
): PerformanceContext {
  const completed = replayHistory.filter(
    (r) => r.result === "WIN" || r.result === "LOSS" || r.result === "BREAKEVEN"
  );

  const totalTrades = completed.length;
  const wins = completed.filter((r) => r.result === "WIN").length;
  const losses = completed.filter((r) => r.result === "LOSS").length;
  const draws = completed.filter((r) => r.result === "BREAKEVEN").length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const profits = completed.map((r) => r.operationContext.profit);
  const grossProfit = profits.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(profits.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const netProfit = Math.round((grossProfit - grossLoss) * 100) / 100;
  const roi = grossLoss > 0 ? Math.round(safeDiv(netProfit, grossLoss) * 100) : 0;
  const profitFactor = grossLoss > 0 ? Math.round(safeDiv(grossProfit, grossLoss) * 100) / 100 : grossProfit > 0 ? 999.99 : 0;
  const expectancy = totalTrades > 0 ? Math.round(safeDiv(netProfit, totalTrades) * 100) / 100 : 0;

  const scores = completed.map((r) => r.operationContext.score);
  const confidences = completed.map((r) => r.decisionContext.confidence);
  const latencies = completed.map((r) => r.operationContext.executionLatency);
  const payouts = completed.map((r) => r.operationContext.payout);
  const durations = completed.map((r) => r.durationMs);

  const byStrategy = buildByStrategy(completed);
  const byAsset = buildByAsset(completed);
  const byHour = buildByHour(completed);
  const byTrend = buildByTrend(completed);
  const byFilter = buildByFilter(completed);
  const recentTrades = buildRecentTrades(completed);

  const bestStrategy = byStrategy.length > 0
    ? byStrategy.reduce((a, b) => (a.netProfit > b.netProfit ? a : b)).strategyName
    : "—";
  const bestAsset = byAsset.length > 0
    ? byAsset.reduce((a, b) => (a.netProfit > b.netProfit ? a : b)).asset
    : "—";
  const bestHour = byHour.length > 0
    ? byHour.filter((h) => h.netProfit > 0).sort((a, b) => b.winRate - a.winRate)[0]?.hour ?? -1
    : -1;
  const bestTrend = byTrend.length > 0
    ? byTrend.reduce((a, b) => (a.winRate > b.winRate ? a : b)).trend
    : "—";

  const resultOrder = completed.map((r) => r.result);
  const streaks = computeStreaks(resultOrder);

  const robotHealth = computeRobotHealthScore({
    winRate,
    profitFactor,
    averageLatency: Math.round(avg(latencies)),
    currentLossStreak: streaks.currentLoss,
    totalTrades,
    netProfit,
  });

  const trends = buildTrends(completed);
  const heatmaps = {
    hourStrategy: buildHourStrategyHeatmap(completed),
    assetHour: buildAssetHourHeatmap(completed),
    dayWeek: buildDayWeekHeatmap(completed),
  };

  const insights = buildInsights(
    byStrategy, byAsset, byHour, byTrend, byFilter,
    winRate, profitFactor, streaks.currentWin, streaks.currentLoss,
    robotHealth,
  );

  return {
    generatedAt: Date.now(),
    totalTrades,
    wins,
    losses,
    draws,
    winRate,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    netProfit,
    roi,
    profitFactor,
    expectancy,
    averageScore: Math.round(avg(scores)),
    averageConfidence: Math.round(avg(confidences) * 100) / 100,
    averageLatency: Math.round(avg(latencies)),
    averagePayout: Math.round(avg(payouts) * 100),
    averageDuration: Math.round(avg(durations)),
    bestStrategy,
    bestAsset,
    bestHour,
    bestTrend,
    currentWinStreak: streaks.currentWin,
    currentLossStreak: streaks.currentLoss,
    longestWinStreak: streaks.longestWin,
    longestLossStreak: streaks.longestLoss,
    robotHealth,
    trends,
    heatmaps,
    byStrategy,
    byAsset,
    byHour,
    byTrend,
    byFilter,
    recentTrades,
    insights,
  };
}
