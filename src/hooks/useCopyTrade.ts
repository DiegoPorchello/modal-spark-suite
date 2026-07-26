import { useMemo } from "react";

const DAEMON_URL = "http://127.0.0.1:3001";
const FETCH_TIMEOUT_MS = 8000;

export interface CopyAccount {
  id: string;
  label: string;
  email: string;
  is_demo: boolean;
  active: boolean;
  last_error: string | null;
  last_sync_at: string | null;
  initial_balance: number;
  current_balance: number;
  total_trades: number;
  total_wins: number;
  total_losses: number;
  total_profit: number;
  started_at: string | null;
}

export interface CopyStatus {
  enabled: boolean;
  accounts: CopyAccount[];
}

export interface DaemonHealth {
  status: string;
  broker_connected: boolean;
  ws_connected: boolean;
  copy_enabled: boolean;
  copy_user_confirmed: boolean;
  copy_accounts: number;
  copy_active_accounts: number;
}

export interface CopyLogEntry {
  type: "success" | "error" | "skipped" | "blocked";
  asset: string;
  direction: string;
  timeframe: string;
  account?: string;
  reason?: string;
  note?: string;
  timestamp: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${DAEMON_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(sem corpo)");
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function useCopyTrade() {
  return useMemo(
    () => ({
      getHealth: async (): Promise<DaemonHealth> => {
        return apiFetch<DaemonHealth>("/health");
      },
      getStatus: async (): Promise<CopyStatus> => {
        const data = await apiFetch<{ enabled: boolean; accounts: CopyAccount[] }>("/copy/status");
        return data;
      },
      getAccounts: async (): Promise<CopyAccount[]> => {
        const data = await apiFetch<{ accounts: CopyAccount[] }>("/copy/accounts");
        return data.accounts;
      },
      getCopyLogs: async (limit = 50): Promise<CopyLogEntry[]> => {
        const data = await apiFetch<{ logs: CopyLogEntry[] }>(`/copy/logs?limit=${limit}`);
        return data.logs;
      },
      addAccount: async (
        label: string,
        email: string,
        password: string,
        isDemo: boolean,
      ): Promise<CopyAccount> => {
        return apiFetch<CopyAccount>("/copy/accounts", {
          method: "POST",
          body: JSON.stringify({ label, email, password, is_demo: isDemo }),
        });
      },
      removeAccount: async (id: string): Promise<void> => {
        await apiFetch(`/copy/accounts/${id}`, { method: "DELETE" });
      },
      toggleAccount: async (id: string): Promise<void> => {
        await apiFetch(`/copy/accounts/${id}`, { method: "PATCH" });
      },
      toggleEnabled: async (): Promise<boolean> => {
        const data = await apiFetch<{ enabled: boolean }>("/copy/accounts/toggle", {
          method: "PATCH",
        });
        return data.enabled;
      },
      editAccount: async (
        id: string,
        data: { label?: string; active?: boolean; is_demo?: boolean },
      ): Promise<void> => {
        await apiFetch(`/copy/accounts/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      },
      testAccount: async (
        id: string,
      ): Promise<{ success: boolean; balance?: number; error?: string }> => {
        try {
          return await apiFetch<{ success: boolean; balance?: number; error?: string }>(
            "/copy/accounts/test",
            {
              method: "POST",
              body: JSON.stringify({ account_id: id }),
            },
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { success: false, error: msg };
        }
      },
    }),
    [],
  );
}
