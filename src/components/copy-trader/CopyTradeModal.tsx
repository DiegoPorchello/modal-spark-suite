import { useState, useEffect, useCallback, useRef } from "react";
import {
  Copy,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Check,
  X,
  RefreshCw,
  Users,
  Settings,
  Activity,
  FileText,
  Wifi,
  WifiOff,
  Clock,
  Zap,
} from "lucide-react";
import {
  useCopyTrade,
  type CopyAccount,
  type CopyStatus,
  type DaemonHealth,
  type CopyLogEntry,
} from "../../hooks/useCopyTrade";

type TabKey = "status" | "contas" | "log";

interface CopyTradeModalProps {
  open: boolean;
  onClose: () => void;
}

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "status", label: "Status", icon: Activity },
  { key: "contas", label: "Contas", icon: Users },
  { key: "log", label: "Log", icon: FileText },
];

const POLL_INTERVAL_MS = 5000;

export function CopyTradeModal({ open, onClose }: CopyTradeModalProps) {
  const api = useCopyTrade();
  const [activeTab, setActiveTab] = useState<TabKey>("status");
  const [status, setStatus] = useState<CopyStatus | null>(null);
  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [daemonOnline, setDaemonOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api.getStatus(), api.getHealth()]);
      setStatus(s);
      setHealth(h);
      setError(null);
      setDaemonOnline(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
      setDaemonOnline(false);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      load();
      intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleToggleEnabled = async () => {
    try {
      const enabled = await api.toggleEnabled();
      setStatus((prev) => (prev ? { ...prev, enabled } : prev));
      setHealth((prev) =>
        prev ? { ...prev, copy_enabled: enabled, copy_user_confirmed: enabled } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="w-[90vw] max-w-[1100px] h-[85vh] bg-card rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${status?.enabled ? "bg-warning/15 border border-warning/30" : "bg-muted"}`}
            >
              <Copy
                className={`size-5 ${status?.enabled ? "text-warning" : "text-muted-foreground"}`}
              />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wide">COPY TRADE</h2>
              <p className="text-xs text-muted-foreground">
                {status?.enabled ? "Replicacao ativa" : "Replicacao desativada"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground text-xs hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={handleToggleEnabled}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status?.enabled
                  ? "bg-warning/10 border border-warning/30 text-warning"
                  : "bg-success/10 border border-success/30 text-success"
              }`}
            >
              {status?.enabled ? (
                <>
                  <ToggleRight className="size-4" />
                  Desativar
                </>
              ) : (
                <>
                  <ToggleLeft className="size-4" />
                  Ativar
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent/40"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* System Status Bar */}
        <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-background/30 shrink-0">
          <StatusIndicator
            online={daemonOnline}
            label={daemonOnline ? "Daemon Online" : "Daemon Offline"}
          />
          <StatusIndicator
            online={health?.broker_connected ?? false}
            label={health?.broker_connected ? "Broker Conectado" : "Broker Desconectado"}
          />
          <StatusIndicator
            online={health?.ws_connected ?? false}
            label={health?.ws_connected ? "WebSocket Ativo" : "WebSocket Inativo"}
          />
          <StatusIndicator
            online={status?.enabled ?? false}
            label={status?.enabled ? "Copy Trade Ativo" : "Copy Trade Inativo"}
          />
          <div className="ml-auto text-[10px] text-muted-foreground">
            {health?.copy_active_accounts ?? 0}/{health?.copy_accounts ?? 0} contas ativas
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-success text-success"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
              <XCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : (
            <>
              {activeTab === "status" && <StatusTab status={status} health={health} />}
              {activeTab === "contas" && <ContasTab api={api} status={status} onRefresh={load} />}
              {activeTab === "log" && <LogTab api={api} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS INDICATOR
   ═══════════════════════════════════════════════════════════════ */
function StatusIndicator({ online, label }: { online: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`size-1.5 rounded-full ${online ? "bg-success" : "bg-danger"}`} />
      <span className={`text-[10px] ${online ? "text-success" : "text-danger"}`}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 1: STATUS
   ═══════════════════════════════════════════════════════════════ */
function StatusTab({ status, health }: { status: CopyStatus | null; health: DaemonHealth | null }) {
  const accounts = status?.accounts ?? [];
  const activeAccounts = accounts.filter((a) => a.active);
  const totalTrades = accounts.reduce((s, a) => s + (a.total_trades ?? 0), 0);
  const totalWins = accounts.reduce((s, a) => s + (a.total_wins ?? 0), 0);
  const totalLosses = accounts.reduce((s, a) => s + (a.total_losses ?? 0), 0);
  const totalProfit = accounts.reduce((s, a) => s + (a.total_profit ?? 0), 0);
  const lastSync = accounts
    .filter((a) => a.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at!).getTime() - new Date(a.last_sync_at!).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Master Status */}
      <div className="bg-background/50 rounded-xl border border-border p-5">
        <div className="text-[10px] text-muted-foreground tracking-widest mb-3">
          CONTA PRINCIPAL
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusBox
            label="Status"
            value={status?.enabled ? "ATIVO" : "INATIVO"}
            color={status?.enabled ? "text-success" : "text-muted-foreground"}
          />
          <StatusBox label="Contas Cadastradas" value={String(accounts.length)} />
          <StatusBox
            label="Contas Ativas"
            value={String(activeAccounts.length)}
            color={activeAccounts.length > 0 ? "text-success" : "text-muted-foreground"}
          />
          <StatusBox
            label="Ultima Replicacao"
            value={
              lastSync
                ? new Date(lastSync.last_sync_at!).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "--"
            }
          />
        </div>
      </div>

      {/* Accounts Summary */}
      <div className="bg-background/50 rounded-xl border border-border p-5">
        <div className="text-[10px] text-muted-foreground tracking-widest mb-3">
          CONTAS CADASTRADAS
        </div>
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Users className="size-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">Nenhuma conta cadastrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-2 rounded-full ${acc.active ? (acc.last_error ? "bg-warning" : "bg-success") : "bg-muted-foreground/30"}`}
                  />
                  <span className="text-sm font-medium">{acc.label}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${acc.is_demo ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}
                  >
                    {acc.is_demo ? "DEMO" : "REAL"}
                  </span>
                  {acc.last_error && (
                    <span className="text-[10px] text-danger flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      Erro
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Trades: {acc.total_trades ?? 0}</span>
                  <span>
                    W/L: {acc.total_wins ?? 0}/{acc.total_losses ?? 0}
                  </span>
                  <span className={acc.active ? "text-success" : ""}>
                    {acc.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aggregate Stats */}
      {accounts.length > 0 && (
        <div className="bg-background/50 rounded-xl border border-border p-5">
          <div className="text-[10px] text-muted-foreground tracking-widest mb-3">RESUMO GERAL</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusBox label="Total Trades" value={String(totalTrades)} />
            <StatusBox label="Wins" value={String(totalWins)} color="text-success" />
            <StatusBox label="Losses" value={String(totalLosses)} color="text-danger" />
            <StatusBox
              label="Lucro Total"
              value={`${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`}
              color={totalProfit > 0 ? "text-success" : totalProfit < 0 ? "text-danger" : ""}
            />
          </div>
        </div>
      )}

      {/* Daemon Info */}
      {health && (
        <div className="bg-background/50 rounded-xl border border-border p-5">
          <div className="text-[10px] text-muted-foreground tracking-widest mb-3">DAEMON</div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Zap className="size-4 text-warning" />
            <span>
              Copy trade executa em threads paralelas (fire-and-forget). Cada conta recebe a ordem
              via HTTP independente.
            </span>
          </div>
          {!health.copy_user_confirmed && health.copy_enabled && (
            <div className="flex items-center gap-3 text-sm text-warning mt-2">
              <AlertTriangle className="size-4" />
              <span>
                Copy Trade foi desativado por reinicio do daemon. Reative via toggle acima.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <div className="text-[10px] text-muted-foreground tracking-wider uppercase">{label}</div>
      <div className={`text-sm font-bold mt-1 ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2: CONTAS
   ═══════════════════════════════════════════════════════════════ */
function ContasTab({
  api,
  status,
  onRefresh,
}: {
  api: ReturnType<typeof useCopyTrade>;
  status: CopyStatus | null;
  onRefresh: () => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsDemo, setFormIsDemo] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!formLabel.trim() || !formEmail.trim() || !formPassword.trim()) {
      setAddError("Preencha todos os campos");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await api.addAccount(formLabel.trim(), formEmail.trim(), formPassword, formIsDemo);
      setFormLabel("");
      setFormEmail("");
      setFormPassword("");
      setShowAdd(false);
      await onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.removeAccount(id);
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleAccount(id);
      await onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {status?.accounts?.length ?? 0} conta(s) cadastrada(s)
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-lg text-success text-xs font-medium hover:bg-success/20 transition-colors"
        >
          <Plus className="size-3.5" />
          Adicionar Conta
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-background/50 rounded-xl border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="size-4 text-success" />
            Nova Conta Copy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nome</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Ex: Conta B"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-success focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-success focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Senha</label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-success focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <div className="flex gap-2 mt-1">
                {[
                  { key: true, label: "Demo" },
                  { key: false, label: "Real" },
                ].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setFormIsDemo(opt.key)}
                    className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                      formIsDemo === opt.key
                        ? "bg-success/20 border-success/50 text-success"
                        : "bg-background border-border text-muted-foreground hover:border-success/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {addError && (
            <div className="text-sm text-danger flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {addError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAdd(false);
                setAddError(null);
              }}
              className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-lg text-success text-xs hover:bg-success/20 disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {adding ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="space-y-3">
        {!status?.accounts || status.accounts.length === 0 ? (
          <div className="bg-background/50 rounded-xl border border-border p-8 text-center">
            <Users className="size-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma conta copy cadastrada.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Clique em "Adicionar Conta" para comecar.
            </p>
          </div>
        ) : (
          status.accounts.map((acc) => (
            <AccountRow
              key={acc.id}
              acc={acc}
              onToggle={handleToggle}
              onRemove={handleRemove}
              onEdit={api.editAccount}
              onRefresh={onRefresh}
              onTest={api.testAccount}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AccountRow({
  acc,
  onToggle,
  onRemove,
  onEdit,
  onRefresh,
  onTest,
}: {
  acc: CopyAccount;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, data: { label?: string; is_demo?: boolean }) => Promise<void>;
  onRefresh: () => Promise<void>;
  onTest: (id: string) => Promise<{ success: boolean; balance?: number; error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(acc.label);
  const [editIsDemo, setEditIsDemo] = useState(acc.is_demo);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    balance?: number;
    error?: string;
  } | null>(null);

  const handleSave = async () => {
    const labelChanged = editLabel.trim() && editLabel.trim() !== acc.label;
    const demoChanged = editIsDemo !== acc.is_demo;
    if (!labelChanged && !demoChanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onEdit(acc.id, {
        ...(labelChanged ? { label: editLabel.trim() } : {}),
        ...(demoChanged ? { is_demo: editIsDemo } : {}),
      });
      await onRefresh();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(acc.id);
      setTestResult(result);
      if (result.success) await onRefresh();
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const winRate =
    (acc.total_wins ?? 0) + (acc.total_losses ?? 0) > 0
      ? ((acc.total_wins ?? 0) / ((acc.total_wins ?? 0) + (acc.total_losses ?? 0))) * 100
      : 0;
  const profit = (acc.current_balance ?? 0) - (acc.initial_balance ?? 0);

  return (
    <div className="bg-background/50 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`size-2.5 rounded-full ${acc.active ? (acc.last_error ? "bg-warning" : "bg-success") : "bg-muted-foreground/30"}`}
          />
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:border-success focus:outline-none w-32"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex gap-1">
                {[
                  { key: true, label: "Demo" },
                  { key: false, label: "Real" },
                ].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setEditIsDemo(opt.key)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      editIsDemo === opt.key
                        ? opt.key
                          ? "bg-warning/10 text-warning border-warning/30"
                          : "bg-info/10 text-info border-info/30"
                        : "bg-background border-border text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1 text-success hover:bg-success/10 rounded"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1 text-muted-foreground hover:bg-accent/40 rounded"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{acc.label}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${acc.is_demo ? "bg-warning/10 text-warning border border-warning/30" : "bg-info/10 text-info border border-info/30"}`}
              >
                {acc.is_demo ? "DEMO" : "REAL"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => {
                setEditLabel(acc.label);
                setEditIsDemo(acc.is_demo);
                setEditing(true);
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
              title="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            className="p-1.5 rounded-md text-muted-foreground hover:text-info hover:bg-info/10 transition-colors disabled:opacity-50"
            title="Testar conexao"
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wifi className="size-3.5" />
            )}
          </button>
          <button
            onClick={() => onToggle(acc.id)}
            className={`p-1.5 rounded-md transition-colors ${acc.active ? "text-success hover:bg-success/10" : "text-muted-foreground hover:bg-accent/40"}`}
            title={acc.active ? "Desativar" : "Ativar"}
          >
            {acc.active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
          </button>
          <button
            onClick={() => onRemove(acc.id)}
            className="p-1.5 rounded-md text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors"
            title="Remover"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1 ml-6">{acc.email}</div>
      <div className="flex items-center gap-4 mt-2 ml-6 text-[10px] text-muted-foreground">
        <span>Trades: {acc.total_trades ?? 0}</span>
        <span>W: {acc.total_wins ?? 0}</span>
        <span>L: {acc.total_losses ?? 0}</span>
        <span>Win: {winRate.toFixed(1)}%</span>
        <span className={profit >= 0 ? "text-success" : "text-danger"}>
          Lucro: {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
        </span>
      </div>
      {testResult && (
        <div
          className={`text-[10px] flex items-center gap-1 mt-1 ml-6 ${testResult.success ? "text-success" : "text-danger"}`}
        >
          {testResult.success ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          {testResult.success
            ? `Conexao OK -- Saldo: $${testResult.balance?.toFixed(2)}`
            : `Erro: ${testResult.error}`}
        </div>
      )}
      {acc.last_error && !testResult && (
        <div className="text-[10px] text-danger flex items-center gap-1 mt-1 ml-6">
          <AlertTriangle className="size-3" />
          {acc.last_error}
        </div>
      )}
      {acc.last_sync_at && !acc.last_error && (
        <div className="text-[10px] text-success flex items-center gap-1 mt-1 ml-6">
          <CheckCircle2 className="size-3" />
          Ultima copia: {new Date(acc.last_sync_at).toLocaleTimeString("pt-BR")}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3: LOG (reais do daemon)
   ═══════════════════════════════════════════════════════════════ */
function LogTab({ api }: { api: ReturnType<typeof useCopyTrade> }) {
  const [logs, setLogs] = useState<CopyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const entries = await api.getCopyLogs(50);
      setLogs(entries);
    } catch {
      /* daemon may be offline */
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    loadLogs();
    intervalRef.current = setInterval(loadLogs, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadLogs]);

  const formatTime = (ts: number) => {
    if (!ts) return "--";
    return new Date(ts * 1000).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Historico de replicacoes (ultimas 50)</div>
        <button
          onClick={loadLogs}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className="size-3" />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-background/50 rounded-xl border border-border p-8 text-center">
          <FileText className="size-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma replicacao registrada.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Os logs aparecerao aqui quando o Copy Trade estiver ativo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="bg-background/50 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-sm font-medium">{log.asset}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${log.direction === "CALL" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
                  >
                    {log.direction}
                  </span>
                  <span className="text-xs text-muted-foreground">{log.timeframe}</span>
                </div>
                <CopyLogTypeBadge type={log.type} />
              </div>
              {log.account && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">Conta:</span>
                  <span className="text-[10px] font-medium">{log.account}</span>
                  {log.reason && (
                    <span className="text-[10px] text-muted-foreground">-- {log.reason}</span>
                  )}
                  {log.note && <span className="text-[10px] text-success">({log.note})</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CopyLogTypeBadge({ type }: { type: string }) {
  const config = {
    success: { label: "OK", className: "bg-success/10 text-success border-success/30" },
    error: { label: "ERRO", className: "bg-danger/10 text-danger border-danger/30" },
    skipped: { label: "SKIP", className: "bg-muted text-muted-foreground border-border" },
    blocked: { label: "BLOQUEADO", className: "bg-warning/10 text-warning border-warning/30" },
  }[type] ?? { label: type, className: "bg-muted text-muted-foreground border-border" };

  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}
