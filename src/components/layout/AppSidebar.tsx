import {
  Activity,
  LayoutDashboard,
  TrendingUp,
  History,
  Settings,
  Calculator,
  HelpCircle,
  Copy,
  Circle,
} from "lucide-react";

type NavKey =
  | "dashboard"
  | "mercado"
  | "historico"
  | "config"
  | "calculadora"
  | "copytrader"
  | "ajuda";

const NAV: {
  section: string;
  items: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    section: "PAINEL PRINCIPAL",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  { section: "MERCADO", items: [{ key: "mercado", label: "Visão de Mercado", icon: TrendingUp }] },
  { section: "OPERAÇÕES", items: [{ key: "historico", label: "Histórico", icon: History }] },
  { section: "CONFIGURAÇÕES", items: [{ key: "config", label: "Configurações", icon: Settings }] },
  {
    section: "SMART RECOVERY",
    items: [{ key: "calculadora", label: "Calculadora", icon: Calculator }],
  },
  {
    section: "COPY TRADER",
    items: [{ key: "copytrader", label: "Copiador", icon: Copy }],
  },
  { section: "AJUDA", items: [{ key: "ajuda", label: "Suporte", icon: HelpCircle }] },
];

interface AppSidebarProps {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  isOpen: boolean;
  robotState: {
    currentSession: string;
    config: { assets: string[] };
    sessionInfo: {
      dataSource?: string;
      nextTransition?: Date | null;
    } | null;
  };
}

export function AppSidebar({ active, onNavigate, isOpen, robotState }: AppSidebarProps) {
  return (
    <aside
      className={`shrink-0 bg-sidebar border-r border-border flex flex-col transition-all duration-300 ${
        isOpen ? "w-64" : "w-0 overflow-hidden border-r-0"
      }`}
    >
      <div className="px-5 py-5 border-b border-border flex items-center gap-3">
        <div className="size-9 rounded-lg bg-success/15 border border-success/40 flex items-center justify-center glow-success">
          <Activity className="size-5 text-success" />
        </div>
        <div>
          <div className="font-semibold tracking-wide text-success">NEXOR AI</div>
          <div className="text-[10px] text-muted-foreground tracking-widest">
            FLUXO DE CONTINUIDADE PRO
          </div>
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
                  onClick={() => onNavigate(it.key)}
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
      <div className="px-5 py-3 border-t border-border">
        <div className="text-[10px] tracking-widest text-muted-foreground mb-2">
          SESSÃO DO MERCADO
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`size-2.5 rounded-full ${robotState.currentSession === "open" ? "bg-success animate-pulse" : "bg-warning"}`}
          />
          <span
            className={`text-xs font-bold ${robotState.currentSession === "open" ? "text-success" : "text-warning"}`}
          >
            {robotState.currentSession === "open" ? "Mercado Aberto" : "Mercado Fechado"}
          </span>
        </div>
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Fonte de dados</span>
            <span className="text-foreground">
              {robotState.sessionInfo?.dataSource === "puma-hybrid"
                ? "Puma Socket.IO"
                : "Binance WS"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Ativos monitorados</span>
            <span className="text-foreground">{robotState.config.assets.length}</span>
          </div>
          {robotState.sessionInfo?.nextTransition && (
            <div className="flex justify-between">
              <span>Próxima mudança</span>
              <span className="text-foreground font-mono" suppressHydrationWarning>
                {robotState.sessionInfo.nextTransition instanceof Date
                  ? robotState.sessionInfo.nextTransition.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
        Nexor AI v1.0.0
      </div>
    </aside>
  );
}

export type { NavKey };
