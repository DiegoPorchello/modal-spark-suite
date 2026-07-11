import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useCopyTrade, type CopyAccount, type CopyStatus } from "../../hooks/useCopyTrade";

export function CopyTradeView() {
  const api = useCopyTrade();
  const [status, setStatus] = useState<CopyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsDemo, setFormIsDemo] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.getStatus();
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await api.removeAccount(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleAccount(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar");
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const enabled = await api.toggleEnabled();
      setStatus((prev) => (prev ? { ...prev, enabled } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Copy className="size-6 text-info" />
          <div>
            <h2 className="text-lg font-bold">COPY TRADER</h2>
            <p className="text-xs text-muted-foreground">
              Replique suas operações em múltiplas contas automaticamente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-muted-foreground text-sm hover:text-foreground hover:border-info/30 transition-colors disabled:opacity-50"
            title="Atualizar contas"
          >
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-info/10 border border-info/30 rounded-lg text-info text-sm hover:bg-info/20 transition-colors"
          >
            <Plus className="size-4" />
            Adicionar Conta
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
          <XCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Master Toggle ── */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Copy Trading</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {status?.enabled
              ? "Operações serão replicadas para todas as contas ativas"
              : "Replicação de operações desativada"}
          </div>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            status?.enabled
              ? "bg-success/10 border border-success/30 text-success"
              : "bg-muted border border-border text-muted-foreground"
          }`}
        >
          {status?.enabled ? (
            <>
              <ToggleRight className="size-4" />
              Ativado
            </>
          ) : (
            <>
              <ToggleLeft className="size-4" />
              Desativado
            </>
          )}
        </button>
      </div>

      {/* ── Add Account Form ── */}
      {showAdd && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="size-4" />
            Nova Conta Copy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Identificador</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Ex: Conta B"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-info focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Email (broker)</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-info focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Senha</label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-info focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo de conta</label>
              <div className="flex gap-2 mt-1">
                {[{ key: true, label: "Demo" }, { key: false, label: "Real" }].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setFormIsDemo(opt.key)}
                    className={`px-4 py-2 rounded-md text-sm border transition-colors ${
                      formIsDemo === opt.key
                        ? "bg-info/20 border-info/50 text-info"
                        : "bg-background border-border text-muted-foreground hover:border-info/30"
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
              onClick={() => { setShowAdd(false); setAddError(null); }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-info/10 border border-info/30 rounded-lg text-info text-sm hover:bg-info/20 disabled:opacity-50"
            >
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {adding ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      {/* ── Accounts List ── */}
      <div className="space-y-3">
        {(!status?.accounts || status.accounts.length === 0) ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Copy className="size-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhuma conta copy cadastrada.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Clique em "Adicionar Conta" para começar.
            </p>
          </div>
        ) : (
          status.accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              acc={acc}
              onToggle={handleToggle}
              onRemove={handleRemove}
              onEdit={api.editAccount}
              onRefresh={load}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AccountCard({ acc, onToggle, onRemove, onEdit, onRefresh }: {
  acc: CopyAccount;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, data: { label?: string; is_demo?: boolean }) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(acc.label);
  const [editIsDemo, setEditIsDemo] = useState(acc.is_demo);
  const [saving, setSaving] = useState(false);

  const handleSaveLabel = async () => {
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
      // silent
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const total = acc.total_wins + acc.total_losses;
  const winRate = total > 0 ? (acc.total_wins / total * 100) : 0;
  const profit = (acc.current_balance ?? 0) - (acc.initial_balance ?? 0);
  const startedDate = acc.started_at
    ? new Date(acc.started_at).toLocaleDateString("pt-BR")
    : "-";

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`size-3 rounded-full shrink-0 ${
            acc.active
              ? acc.last_error ? "bg-warning" : "bg-success"
              : "bg-muted-foreground/30"
          }`} />
          {editing ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="bg-background border border-border rounded-md px-2 py-1 text-sm focus:border-info focus:outline-none w-32"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveLabel();
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <button onClick={handleSaveLabel} disabled={saving} className="p-1 text-success hover:bg-success/10 rounded">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                </button>
                <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:bg-accent/40 rounded">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Tipo:</span>
                <div className="flex gap-1">
                  {[{ key: true, label: "Demo" }, { key: false, label: "Real" }].map((opt) => (
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
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{acc.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                acc.is_demo
                  ? "bg-warning/10 text-warning border border-warning/30"
                  : "bg-info/10 text-info border border-info/30"
              }`}>
                {acc.is_demo ? "DEMO" : "REAL"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => { setEditLabel(acc.label); setEditIsDemo(acc.is_demo); setEditing(true); }}
              className="p-2 rounded-md text-muted-foreground hover:text-info hover:bg-info/10 transition-colors"
              title="Editar"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <button
            onClick={() => onToggle(acc.id)}
            className={`p-2 rounded-md transition-colors ${
              acc.active
                ? "text-success hover:bg-success/10"
                : "text-muted-foreground hover:bg-accent/40"
            }`}
            title={acc.active ? "Desativar" : "Ativar"}
          >
            {acc.active ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
          </button>
          <button
            onClick={() => onRemove(acc.id)}
            className="p-2 rounded-md text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors"
            title="Remover"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">{acc.email}</div>

      <div className="grid grid-cols-6 gap-2">
        <StatBox label="Saldo Inicial" value={`$${(acc.initial_balance ?? 0).toFixed(2)}`} />
        <StatBox label="Wins" value={String(acc.total_wins ?? 0)} color="text-success" />
        <StatBox label="Loss" value={String(acc.total_losses ?? 0)} color="text-danger" />
        <StatBox
          label="Assertividade"
          value={total > 0 ? `${winRate.toFixed(1)}%` : "-"}
          color={winRate >= 60 ? "text-success" : winRate >= 40 ? "text-warning" : "text-danger"}
        />
        <StatBox
          label="Lucro"
          value={`${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`}
          color={profit > 0 ? "text-success" : profit < 0 ? "text-danger" : ""}
        />
        <StatBox label="Início" value={startedDate} />
      </div>

      {acc.last_error && (
        <div className="text-xs text-danger flex items-center gap-1">
          <AlertTriangle className="size-3" />
          {acc.last_error}
        </div>
      )}
      {acc.last_sync_at && !acc.last_error && (
        <div className="text-xs text-success flex items-center gap-1">
          <CheckCircle2 className="size-3" />
          Última cópia: {new Date(acc.last_sync_at).toLocaleTimeString("pt-BR")}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-background/50 rounded-lg p-2 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
