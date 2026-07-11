import { useMemo } from "react";

const DAEMON_URL = "http://127.0.0.1:3001";

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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(sem corpo)");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export function useCopyTrade() {
  return useMemo(() => ({
    getStatus: async (): Promise<CopyStatus> => {
      const data = await apiFetch<{ enabled: boolean; accounts: CopyAccount[] }>("/copy/status");
      return data;
    },
    getAccounts: async (): Promise<CopyAccount[]> => {
      const data = await apiFetch<{ accounts: CopyAccount[] }>("/copy/accounts");
      return data.accounts;
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
      const data = await apiFetch<{ enabled: boolean }>("/copy/accounts/toggle", { method: "PATCH" });
      return data.enabled;
    },
    editAccount: async (id: string, data: { label?: string; active?: boolean; is_demo?: boolean }): Promise<void> => {
      await apiFetch(`/copy/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
  }), []);
}
