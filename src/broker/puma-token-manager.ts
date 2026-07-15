import { engineLogger } from "../engine/logger";
import type { LoginResponse } from "./puma-broker-adapter";

// Extract the interface from puma-broker-adapter since it wasn't exported in types.ts
export interface TokenLoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    balance: number;
    demoBalance: number;
    bonus: number;
    isDemo: boolean;
    isVip: boolean;
    verified: boolean;
    country: string;
  };
  token: string;
  ws2Session?: string;
}

const STORAGE_KEY = "puma_token_data";

export class PumaTokenManager {
  private _data: TokenLoginResponse | null = null;

  constructor() {
    this._load();
  }

  private _getTokenInfo(token: string) {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const decoded = JSON.parse(jsonPayload);
      const exp = typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
      return { exp };
    } catch {
      return null;
    }
  }

  private _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.token) {
          const info = this._getTokenInfo(data.token);
          if (info?.exp && Date.now() < info.exp - 300000) {
            this._data = data as TokenLoginResponse;
            engineLogger.info("PumaTokenManager", "Token carregado do cache", {});
          } else {
            engineLogger.info("PumaTokenManager", "Token em cache expirado", {});
            this.clear();
          }
        }
      }
    } catch (e) {
      engineLogger.error("PumaTokenManager", "Erro ao carregar token do cache", { error: String(e) });
    }
  }

  public save(data: TokenLoginResponse) {
    this._data = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
      engineLogger.info("PumaTokenManager", "Token salvo no cache", {});
    } catch (e) {
      engineLogger.error("PumaTokenManager", "Erro ao salvar token no cache", { error: String(e) });
    }
  }

  public get(): TokenLoginResponse | null {
    if (!this._data) return null;
    const info = this._getTokenInfo(this._data.token);
    if (info?.exp && Date.now() < info.exp - 60000) {
      return this._data;
    }
    return null;
  }

  public clear() {
    this._data = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const pumaTokenManager = new PumaTokenManager();
