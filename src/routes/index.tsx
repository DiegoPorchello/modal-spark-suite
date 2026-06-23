import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, TrendingUp, Activity, BookOpen, Trophy, History,
  Calculator, FlaskConical, Plug, Settings, HelpCircle, Menu, Bell,
  Maximize2, User, X, ArrowUp, ArrowDown, Check, Circle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexor AI · Fluxo de Continuidade Pro" },
      { name: "description", content: "Painel de operações automatizadas Nexor AI." },
    ],
  }),
  component: Dashboard,
});

type NavKey =
  | "dashboard" | "mercado" | "fluxo" | "padroes" | "ativos"
  | "historico" | "calc" | "backtest" | "puma" | "config" | "ajuda";

const NAV: { section: string; items: { key: NavKey; label: string; icon: any }[] }[] = [
  { section: "PAINEL PRINCIPAL", items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { section: "MERCADO", items: [{ key: "mercado", label: "Visão de Mercado", icon: TrendingUp }] },
  { section: "FLUXO DE CONTINUIDADE PRO", items: [{ key: "fluxo", label: "Análise do Robô", icon: Activity }] },
  { section: "CATÁLOGO", items: [{ key: "padroes", label: "Padrões", icon: BookOpen }] },
  { section: "RANKING", items: [{ key: "ativos", label: "Ativos", icon: Trophy }] },
  { section: "OPERAÇÕES", items: [{ key: "historico", label: "Histórico", icon: History }] },
  { section: "GERENCIAMENTO", items: [{ key: "calc", label: "Calculadora Sorosgale", icon: Calculator }] },
  { section: "BACKTEST", items: [{ key: "backtest", label: "Simulador", icon: FlaskConical }] },
  { section: "INTEGRAÇÕES", items: [{ key: "puma", label: "Puma Broker", icon: Plug }] },
  { section: "CONFIGURAÇÕES", items: [{ key: "config", label: "Configurações", icon: Settings }] },
  { section: "AJUDA", items: [{ key: "ajuda", label: "Suporte", icon: HelpCircle }] },
];

function Dashboard() {
  const [active, setActive] = useState<NavKey>("fluxo");
  const [tf, setTf] = useState<"M1" | "M5" | "M15">("M1");
  const [modalOpen, setModalOpen] = useState(true);
  const [seconds, setSeconds] = useState(42);
  const [now, setNow] = useState<Date | null>(null);
  const [chartTab, setChartTab] = useState<"grafico" | "estrutura">("grafico");

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setNow(new Date());
      setSeconds((s) => (s > 0 ? s - 1 : 60));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="size-9 rounded-lg bg-success/15 border border-success/40 flex items-center justify-center glow-success">
            <Activity className="size-5 text-success" />
          </div>
          <div>
            <div className="font-semibold tracking-wide text-success">NEXOR AI</div>
            <div className="text-[10px] text-muted-foreground tracking-widest">FLUXO DE CONTINUIDADE PRO</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((g) => (
            <div key={g.section} className="px-3 mb-3">
              <div className="text-[10px] font-semibold text-muted-foreground tracking-widest px-3 py-2 flex items-center gap-2">
                <Circle className="size-1.5 fill-current" />
                {g.section}
              </div>
              {g.items.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                      isActive
                        ? "bg-success/10 text-success border border-success/30"
                        : "text-sidebar-foreground hover:bg-accent/40"
                    }`}
                  >
                    <Icon className="size-4" />
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
          Nexor AI v1.0.0
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-panel flex items-center px-5 gap-4">
          <button className="text-muted-foreground hover:text-foreground"><Menu className="size-5" /></button>
          <div className="flex gap-2">
            {(["M1", "M5", "M15"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide ${
                  tf === t ? "bg-success text-success-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 flex justify-center items-center gap-3 text-xs">
            <span className="flex items-center gap-2 text-success">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              MERCADO ABERTO
            </span>
            <span className="text-muted-foreground">
              {now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <button className="relative hover:text-foreground">
              <Bell className="size-5" />
              <span className="absolute -top-1 -right-1 size-4 rounded-full bg-danger text-[10px] text-danger-foreground flex items-center justify-center font-bold">3</span>
            </button>
            <button className="hover:text-foreground"><Settings className="size-5" /></button>
            <button className="hover:text-foreground"><Maximize2 className="size-5" /></button>
            <div className="flex items-center gap-2 panel px-3 py-1.5">
              <User className="size-4" />
              <div className="text-xs">
                <div className="font-semibold text-foreground">NEXOR TRADER</div>
                <div className="text-muted-foreground text-[10px]">Conta Real</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5 space-y-5">
          {/* Top metrics row */}
          <section className="grid grid-cols-12 gap-4">
            <BrokerCard />
            <Metric label="ATIVO OPERADO" value="EUR/USD" flag="🇪🇺" sub="" />
            <Metric label="TIMEFRAME" value="M1" sub="Expiração 1 min" />
            <Metric label="SCORE ATUAL" value="92" badge="PREMIUM" />
            <Metric label="PROBABILIDADE" value="87%" sub="Alta" accent />
            <Metric label="PAYOUT ATUAL" value="87%" accent />
            <Metric label="LUCRO DA SESSÃO" value="R$ 231,45" sub="+18,47%" accent />
            <Metric label="WINS / LOSS" value="19 / 7" sub="73%" accent />
            <Metric label="STATUS DO ROBÔ" value="OPERANDO" sub="Automático" status />
          </section>

          {/* Analysis row */}
          <section className="grid grid-cols-12 gap-4">
            <AnalysisPanel chartTab={chartTab} setChartTab={setChartTab} />
            <RankingPanel />
          </section>

          {/* Bottom row */}
          <section className="grid grid-cols-12 gap-4">
            <CalcPanel />
            <FinancePanel />
            <HistoryPanel />
          </section>

          {/* Status bar */}
          <section className="grid grid-cols-12 gap-4">
            <PerformancePanel />
          </section>
        </main>

        {/* Footer status */}
        <footer className="h-10 border-t border-border bg-panel flex items-center px-5 text-[11px] text-muted-foreground gap-6">
          <span className="flex items-center gap-2 text-success"><span className="size-2 rounded-full bg-success" /> ROBO ATIVO</span>
          <span>PRÓXIMA ANÁLISE: <span className="text-foreground font-mono">00:05</span></span>
          <span>MODO: <span className="text-foreground">AUTOMÁTICO</span></span>
          <span>GERENCIAMENTO: <span className="text-success">SOROSGALE ●</span></span>
          <span className="ml-auto">CONEXÃO: <span className="text-foreground">PUMA BROKER</span></span>
        </footer>
      </div>

      {/* Modal */}
      {modalOpen && (
        <OperationModal seconds={seconds} onClose={() => setModalOpen(false)} />
      )}
      {!modalOpen && (
        <button
          onClick={() => { setModalOpen(true); setSeconds(42); }}
          className="fixed bottom-14 right-5 bg-success text-success-foreground px-4 py-2 rounded-md text-xs font-semibold glow-success"
        >
          Abrir Operação
        </button>
      )}
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function BrokerCard() {
  return (
    <div className="panel col-span-3 p-4">
      <div className="text-[10px] tracking-widest text-muted-foreground mb-3">CONEXÃO PUMA BROKER</div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center text-warning font-bold">P</div>
          <div>
            <div className="text-sm font-bold">PUMA</div>
            <div className="text-[10px] text-muted-foreground">BROKER</div>
          </div>
        </div>
        <span className="text-[10px] text-success flex items-center gap-1 bg-success/10 px-2 py-1 rounded">
          <span className="size-1.5 rounded-full bg-success" /> CONECTADO
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row k="Conta" v="Conta Real" />
        <Row k="Usuário" v="nexor.trader" />
        <Row k="Saldo" v="R$ 1.251,93" />
        <Row k="Servidor" v="PumaPro-Demo" />
      </div>
      <button className="w-full mt-4 py-2 rounded-md border border-border text-xs font-semibold tracking-wide hover:bg-accent">
        DESCONECTAR
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Metric({
  label, value, sub, badge, flag, accent, status,
}: { label: string; value: string; sub?: string; badge?: string; flag?: string; accent?: boolean; status?: boolean }) {
  return (
    <div className="panel col-span-1 p-3 min-w-0" style={{ gridColumn: "span 1 / span 1" }}>
      <div className="text-[9px] tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className="flex items-baseline gap-1">
        {flag && <span className="text-base">{flag}</span>}
        {status && <span className="size-2 rounded-full bg-success animate-pulse mr-1" />}
        <span className={`text-base font-bold truncate ${accent || status ? "text-success" : ""}`}>{value}</span>
        {badge && <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded font-semibold ml-1">{badge}</span>}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function AnalysisPanel({ chartTab, setChartTab }: { chartTab: "grafico" | "estrutura"; setChartTab: (t: "grafico" | "estrutura") => void }) {
  const scoreItems = [
    { label: "Continuidade", value: "38/40" },
    { label: "Dominância", value: "22/25" },
    { label: "Força do Candle", value: "14/15" },
    { label: "Estrutura (S/R)", value: "8/10" },
    { label: "Histórico (Catálogo)", value: "10/10" },
  ];
  const filters = [
    { label: "Continuidade", ok: true },
    { label: "Força do Candle", ok: true },
    { label: "Distância de S/R", ok: true },
    { label: "Lateralização", ok: false },
    { label: "Rompimento", ok: true },
    { label: "Horário Favorável", ok: true },
  ];
  return (
    <div className="panel col-span-8 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="size-4 text-success" />
        <h3 className="text-sm font-semibold tracking-wide">ANÁLISE DO ROBÔ - FLUXO DE CONTINUIDADE PRO</h3>
      </div>
      <div className="grid grid-cols-12 gap-4">
        {/* Motor de Score */}
        <div className="col-span-4">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">MOTOR DE SCORE</div>
          <div className="space-y-2">
            {scoreItems.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2">
                <span className="flex items-center gap-2"><Check className="size-3 text-success" />{s.label}</span>
                <span className="font-mono text-success">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">SCORE FINAL</span>
              <span className="font-mono"><span className="text-success font-bold text-base">92</span> / 100</span>
            </div>
            <div className="flex justify-between items-center text-xs mt-3">
              <span className="text-muted-foreground">CLASSIFICAÇÃO</span>
              <span className="bg-success/15 text-success px-2 py-1 rounded text-[10px] font-bold tracking-wider">PREMIUM</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="col-span-5">
          <div className="flex gap-1 mb-3 border-b border-border">
            {(["grafico", "estrutura"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartTab(t)}
                className={`px-3 py-1.5 text-xs font-semibold tracking-wide border-b-2 -mb-px ${
                  chartTab === t ? "border-success text-success" : "border-transparent text-muted-foreground"
                }`}
              >
                {t === "grafico" ? "GRÁFICO" : "ESTRUTURA"}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mb-2">EUR/USD OTC · M1</div>
          <CandleChart />
        </div>

        {/* Filters */}
        <div className="col-span-3">
          <div className="text-[10px] tracking-widest text-muted-foreground mb-3">FILTROS ATIVOS</div>
          <div className="space-y-2">
            {filters.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-xs bg-secondary/40 rounded px-3 py-2">
                <span className="text-foreground/90">{f.label}</span>
                {f.ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-danger" />}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="text-[10px] tracking-widest text-muted-foreground mb-2">STATUS</div>
            <div className="text-xs font-semibold text-warning">Aguardando</div>
            <div className="text-[10px] text-muted-foreground mt-1">Confirmação da entrada</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CandleChart() {
  // Static-ish candle SVG
  const candles = Array.from({ length: 26 }).map((_, i) => {
    const seed = Math.sin(i * 1.7) * 0.5 + 0.5;
    const up = Math.sin(i * 0.9) > -0.1;
    const o = 40 + seed * 60;
    const c = up ? o + 8 + seed * 14 : o - 8 - seed * 14;
    const h = Math.min(o, c) - 4 - seed * 6;
    const l = Math.max(o, c) + 4 + seed * 6;
    return { x: 10 + i * 14, o, c, h, l, up };
  });
  return (
    <div className="relative bg-background/60 rounded border border-border h-[220px] overflow-hidden">
      <svg viewBox="0 0 380 200" className="w-full h-full">
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" x2="380" y1={y} y2={y} stroke="oklch(0.3 0.03 220)" strokeDasharray="2 4" />
        ))}
        {candles.map((c, i) => (
          <g key={i}>
            <line x1={c.x} x2={c.x} y1={c.h} y2={c.l} stroke={c.up ? "oklch(0.78 0.19 155)" : "oklch(0.65 0.24 22)"} strokeWidth="1" />
            <rect
              x={c.x - 4}
              y={Math.min(c.o, c.c)}
              width="8"
              height={Math.abs(c.c - c.o) || 2}
              fill={c.up ? "oklch(0.78 0.19 155)" : "oklch(0.65 0.24 22)"}
            />
          </g>
        ))}
        <text x="350" y="50" fill="oklch(0.78 0.19 155)" fontSize="9" fontFamily="monospace">1.09140</text>
        <text x="350" y="100" fill="oklch(0.65 0.02 220)" fontSize="9" fontFamily="monospace">1.09100</text>
        <text x="350" y="150" fill="oklch(0.65 0.02 220)" fontSize="9" fontFamily="monospace">1.09060</text>
      </svg>
      <div className="absolute top-3 left-3 bg-success/15 border border-success/40 text-success text-[10px] px-2 py-1 rounded font-semibold">
        COMPRA · Sinal Gerado
      </div>
    </div>
  );
}

function RankingPanel() {
  const rows = [
    { rank: 1, asset: "EUR/USD OTC", flag: "🇪🇺", score: 92, wr: "73%", ops: 26 },
    { rank: 2, asset: "GBP/USD OTC", flag: "🇬🇧", score: 89, wr: "69%", ops: 23 },
    { rank: 3, asset: "USD/JPY OTC", flag: "🇯🇵", score: 86, wr: "67%", ops: 21 },
    { rank: 4, asset: "AUD/USD OTC", flag: "🇦🇺", score: 83, wr: "62%", ops: 18 },
    { rank: 5, asset: "BTC/USDT OTC", flag: "₿", score: 81, wr: "65%", ops: 20 },
    { rank: 6, asset: "GOLD OTC", flag: "🥇", score: 79, wr: "61%", ops: 16 },
    { rank: 7, asset: "ETH/USDT OTC", flag: "Ξ", score: 76, wr: "58%", ops: 19 },
    { rank: 8, asset: "EUR/GBP OTC", flag: "🇪🇺", score: 74, wr: "57%", ops: 14 },
    { rank: 9, asset: "USD/CHF OTC", flag: "🇨🇭", score: 72, wr: "55%", ops: 12 },
    { rank: 10, asset: "NZD/USD OTC", flag: "🇳🇿", score: 70, wr: "53%", ops: 15 },
  ];
  return (
    <div className="panel col-span-4 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="size-4 text-success" />RANKING DE ATIVOS (M1)</h3>
        <span className="text-[10px] text-muted-foreground">Atualizado: 09:42:18</span>
      </div>
      <div className="text-[10px] text-muted-foreground grid grid-cols-12 gap-1 px-2 pb-2 border-b border-border tracking-wider">
        <span className="col-span-1">#</span>
        <span className="col-span-4">ATIVO</span>
        <span className="col-span-2 text-right">SCORE</span>
        <span className="col-span-2 text-right">WIN RATE</span>
        <span className="col-span-2 text-right">OPERAÇÕES</span>
        <span className="col-span-1 text-right">STATUS</span>
      </div>
      <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
        {rows.map((r) => (
          <div key={r.rank} className="grid grid-cols-12 gap-1 px-2 py-2 text-xs hover:bg-accent/30">
            <span className="col-span-1 text-success font-bold">{r.rank}</span>
            <span className="col-span-4 flex items-center gap-1.5"><span>{r.flag}</span>{r.asset}</span>
            <span className="col-span-2 text-right font-mono text-success">{r.score}</span>
            <span className="col-span-2 text-right">{r.wr}</span>
            <span className="col-span-2 text-right">{r.ops}</span>
            <span className="col-span-1 flex justify-end"><ArrowUp className="size-3 text-success" /></span>
          </div>
        ))}
      </div>
      <button className="w-full mt-3 py-2 text-xs border border-border rounded hover:bg-accent">VER TODOS OS ATIVOS</button>
    </div>
  );
}

function CalcPanel() {
  const levels = [
    { n: 0, e1: "R$ 4,57", e2: "R$ 8,45", v: "R$ 11,07", s: "R$ 11,07" },
    { n: 1, e1: "R$ 2,00", e2: "R$ 3,70", v: "R$ 4,84", s: "R$ 4,84" },
    { n: 2, e1: "R$ 2,72", e2: "R$ 5,03", v: "R$ 6,59", s: "R$ 6,59" },
    { n: 3, e1: "R$ 3,84", e2: "R$ 7,10", v: "R$ 9,30", s: "R$ 0,00", active: true },
    { n: 4, e1: "R$ 5,43", e2: "R$ 10,05", v: "R$ 13,16", s: "R$ 0,00" },
    { n: 5, e1: "R$ 7,67", e2: "R$ 14,19", v: "R$ 18,58", s: "R$ 0,00" },
    { n: 6, e1: "R$ 10,83", e2: "R$ 20,04", v: "R$ 26,24", s: "R$ 0,00" },
  ];
  return (
    <div className="panel col-span-5 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calculator className="size-4 text-success" />CALCULADORA SOROSGALE - NÍVEL ATUAL</h3>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-3 space-y-3">
          <Stat title="NÍVEL ATUAL" value="3" big />
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ESTRATÉGIA</div>
            <div className="text-xs font-semibold">Sorosgale Fracionado</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div className="text-xs text-success flex items-center gap-1"><span className="size-1.5 rounded-full bg-success" />OPERANDO</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">META / STOP</div>
            <div className="text-xs">R$ 100,00 / R$ 200,00</div>
          </div>
        </div>
        <div className="col-span-9 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground tracking-wider">
              <tr className="border-b border-border">
                <th className="text-left py-2">NÍVEL</th>
                <th className="text-left">1ª ENTRADA</th>
                <th className="text-left">2ª ENTRADA (SOROS)</th>
                <th className="text-left">VALOR POR TAXA</th>
                <th className="text-left">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l.n} className={`border-b border-border ${l.active ? "bg-success/10" : ""}`}>
                  <td className="py-2 font-bold">{l.n}</td>
                  <td className={l.active ? "text-success" : ""}>{l.e1}</td>
                  <td className={l.active ? "text-success" : ""}>{l.e2}</td>
                  <td className={l.active ? "text-success" : ""}>{l.v}</td>
                  <td className={l.s === "R$ 0,00" ? "text-muted-foreground" : "text-success"}>{l.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, big }: { title: string; value: string; big?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="text-[10px] text-muted-foreground tracking-widest">{title}</div>
      <div className={`font-bold text-success ${big ? "text-4xl" : "text-base"}`}>{value}</div>
    </div>
  );
}

function FinancePanel() {
  const rows = [
    { k: "BANCA INICIAL", v: "R$ 1.000,00" },
    { k: "BANCA ATUAL", v: "R$ 1.251,93", c: "text-success" },
    { k: "PREJUÍZO ACUMULADO", v: "R$ 15,30", c: "text-danger" },
    { k: "LUCRO DA SESSÃO", v: "R$ 231,45", c: "text-success" },
    { k: "WIN RATE", v: "73%" },
    { k: "NÚMERO DE OPERAÇÕES", v: "26" },
  ];
  return (
    <div className="panel col-span-3 p-4">
      <h3 className="text-sm font-semibold mb-3">RESUMO FINANCEIRO</h3>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.k} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{r.k}</span>
            <span className={`font-mono font-semibold ${r.c ?? ""}`}>{r.v}</span>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 py-2 rounded border border-border text-xs font-semibold hover:bg-accent">EDITAR ESTRATÉGIA</button>
    </div>
  );
}

function HistoryPanel() {
  const rows = [
    { t: "09:41", a: "EUR/USD OTC", d: "CALL", r: "WIN", v: "+R$ 7,10" },
    { t: "09:39", a: "GBP/USD OTC", d: "PUT", r: "WIN", v: "+R$ 3,70" },
    { t: "09:37", a: "BTC/USDT OTC", d: "CALL", r: "LOSS", v: "-R$ 3,84" },
    { t: "09:35", a: "EUR/USD OTC", d: "CALL", r: "WIN", v: "+R$ 5,43" },
    { t: "09:33", a: "AUD/USD OTC", d: "PUT", r: "LOSS", v: "-R$ 2,72" },
  ];
  return (
    <div className="panel col-span-4 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">HISTÓRICO RECENTE</h3>
        <button className="text-[10px] text-success hover:underline">VER TODAS</button>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 text-xs items-center bg-secondary/30 rounded px-3 py-2">
            <span className="text-muted-foreground font-mono">{r.t}</span>
            <span className="col-span-1 truncate">{r.a}</span>
            <span className={r.d === "CALL" ? "text-success font-semibold" : "text-danger font-semibold"}>{r.d}</span>
            <span className={r.r === "WIN" ? "text-success" : "text-danger"}>{r.r}</span>
            <span className={`text-right font-mono font-semibold ${r.v.startsWith("+") ? "text-success" : "text-danger"}`}>{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformancePanel() {
  // Simple area line
  const points = Array.from({ length: 25 }).map((_, i) => {
    const y = 120 - (Math.sin(i / 3) * 20 + i * 3);
    return `${i * 20},${Math.max(20, Math.min(140, y))}`;
  }).join(" ");
  return (
    <div className="panel col-span-12 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">DESEMPENHO DO DIA</h3>
        <div className="flex gap-6 text-xs">
          <div><span className="text-muted-foreground">Lucro </span><span className="text-success font-bold">R$ 231,45</span></div>
          <div><span className="text-muted-foreground">Operações </span><span className="font-bold">26</span></div>
          <div><span className="text-muted-foreground">Win Rate </span><span className="text-success font-bold">73%</span></div>
        </div>
      </div>
      <svg viewBox="0 0 500 160" className="w-full h-40">
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.19 155)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="oklch(0.78 0.19 155)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 70, 110].map((y) => (
          <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="oklch(0.3 0.03 220)" strokeDasharray="2 4" />
        ))}
        <polygon points={`0,160 ${points} 500,160`} fill="url(#grad)" />
        <polyline points={points} fill="none" stroke="oklch(0.78 0.19 155)" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
        <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>24:00</span>
      </div>
    </div>
  );
}

function OperationModal({ seconds, onClose }: { seconds: number; onClose: () => void }) {
  const pct = (seconds / 60) * 100;
  const r = 54;
  const C = 2 * Math.PI * r;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="panel w-[420px] p-5 shadow-2xl glow-success">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold tracking-wide">OPERAÇÃO EM TEMPO REAL</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">ATIVO</div>
            <div className="text-sm font-bold mt-1">🇪🇺 EUR/USD <span className="text-success text-[10px]">OTC</span></div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">STATUS</div>
            <div className="text-sm font-bold text-success mt-1">EXECUTANDO</div>
            <div className="flex gap-1 mt-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse" />
              <span className="size-1.5 rounded-full bg-success/60" />
              <span className="size-1.5 rounded-full bg-success/30" />
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground tracking-widest">VALOR DA ENTRADA</div>
            <div className="text-sm font-bold mt-1">R$ 3,84</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">DIREÇÃO</div>
              <div className="text-sm font-bold text-success flex items-center gap-1 mt-1"><ArrowUp className="size-4" />CALL</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">TIMEFRAME</div>
              <div className="text-sm font-bold mt-1">M1</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EXPIRAÇÃO</div>
              <div className="text-sm font-bold mt-1">1 MINUTO</div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative size-32">
              <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
                <circle cx="60" cy="60" r={r} stroke="oklch(0.3 0.03 220)" strokeWidth="6" fill="none" />
                <circle cx="60" cy="60" r={r} stroke="oklch(0.78 0.19 155)" strokeWidth="6" fill="none"
                  strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] text-muted-foreground tracking-widest">TEMPO RESTANTE</div>
                <div className="text-2xl font-bold font-mono text-success">00:{String(seconds).padStart(2, "0")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">PAYOUT</div>
            <div className="text-success font-bold">87%</div>
          </div>
          <div className="panel p-2 text-center">
            <div className="text-[10px] text-muted-foreground tracking-widest">RETORNO</div>
            <div className="text-success font-bold">R$ 7,18</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div><div className="text-[10px] text-muted-foreground tracking-widest">NÍVEL</div><div className="font-bold mt-1">3</div></div>
          <div><div className="text-[10px] text-muted-foreground tracking-widest">ENTRADA</div><div className="font-bold mt-1">1/2</div></div>
          <div><div className="text-[10px] text-muted-foreground tracking-widest">SCORE</div><div className="font-bold mt-1 text-success">92</div></div>
        </div>

        <button onClick={onClose} className="w-full py-2.5 rounded-md border border-danger/50 text-danger font-semibold text-xs tracking-widest hover:bg-danger/10">
          CANCELAR OPERAÇÃO
        </button>
      </div>
    </div>
  );
}
