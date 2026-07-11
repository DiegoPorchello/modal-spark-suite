/**
 * hooks/useBroker.tsx
 * Contexto React para o Puma Broker.
 *
 * SEGURANÇA: NENHUM token ou credencial é persistido em localStorage.
 * O token JWT é obtido exclusivamente do login atual (accessToken).
 * NUNCA utiliza tokens antigos.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { PumaBrokerAdapter } from "../broker/puma-broker-adapter";
import type { AccountBalance } from "../broker/types";

export interface BrokerCredentials {
  serverUrl: string;
  username: string;
  password: string;
  accountType: "real" | "demo";
  keepConnected: boolean;
}

interface BrokerContextValue {
  adapter: PumaBrokerAdapter;
  connected: boolean;
  connecting: boolean;
  credentials: BrokerCredentials | null;
  balance: AccountBalance | null;
  error: string | null;
  userName: string | null;
  login: (creds: BrokerCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => void;
  clearError: () => void;
}

const BrokerContext = createContext<BrokerContextValue | null>(null);

export function BrokerProvider({ children }: { children: ReactNode }) {
  const adapterRef = useRef<PumaBrokerAdapter>(null!);
  if (!adapterRef.current) {
    adapterRef.current = new PumaBrokerAdapter();
  }
  const adapter = adapterRef.current;
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [credentials, setCredentials] = useState<BrokerCredentials | null>(null);
  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  // NENHUMA restauração automática de credenciais.
  // Token JWT é obtido EXCLUSIVAMENTE do login atual.

  const login = useCallback(
    async (creds: BrokerCredentials) => {
      setConnecting(true);
      setError(null);

      try {
        await adapter.connectWithCredentials(creds.username, creds.password, creds.accountType);

        const bal = await adapter.getBalance();
        setBalance(bal);
        setConnected(true);
        setCredentials(creds);
        setUserName(adapter.userName);

        // NUNCA persistir credenciais — token vem exclusivamente do login
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha na conexão";
        setError(msg);
        setConnected(false);
      } finally {
        setConnecting(false);
      }
    },
    [adapter],
  );

  const logout = useCallback(async () => {
    try {
      await adapter.disconnect();
    } catch {
      // Desconexão pode falhar — continuar com limpeza local
    }
    setConnected(false);
    setBalance(null);
    setError(null);
    setCredentials(null);
    setUserName(null);
    // NENHUMA limpeza de localStorage necessária — nada é persistido
  }, [adapter]);

  const updateServerUrl = useCallback((_url: string) => {
    // Server URL management is not applicable for direct API connection
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      adapter.disconnect().catch(() => {});
    };
  }, [adapter]);

  return (
    <BrokerContext.Provider
      value={{
        adapter,
        connected,
        connecting,
        credentials,
        balance,
        error,
        userName,
        login,
        logout,
        updateServerUrl,
        clearError,
      }}
    >
      {children}
    </BrokerContext.Provider>
  );
}

export function useBroker(): BrokerContextValue {
  const ctx = useContext(BrokerContext);
  if (!ctx) throw new Error("useBroker must be used within a BrokerProvider");
  return ctx;
}
