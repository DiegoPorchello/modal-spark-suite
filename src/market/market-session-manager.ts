/**
 * market/market-session-manager.ts
 * Gerenciador de sessão de mercado — detecta automaticamente se o mercado
 * está ABERTO (forex/crypto tradicional) ou FECHADO (somente híbridos).
 *
 * Cronograma Puma (GMT-3 / Brasília):
 *   Seg–Sex: 00:00–18:00  → MERCADO ABERTO (Forex + Crypto + XAUUSD)
 *   Seg–Sex: 18:00–22:00  → MERCADO FECHADO (somente híbridos)
 *   Seg–Sex: 22:00–23:59  → MERCADO ABERTO
 *   Sábado:  00:00–23:59  → MERCADO FECHADO (o dia todo)
 *   Domingo: 00:00–22:00  → MERCADO FECHADO
 *   Domingo: 22:00–23:59  → MERCADO ABERTO
 *
 * HÍBRIDOS (BETHUSDT, BTSOLUSDT, MAPEUSDT, XRDOGUSDT, XRPSOLUSDT):
 *   Disponíveis 24/7 — sempre ativos, em qualquer sessão.
 *
 * O gerenciador detecta mudanças automaticamente a cada 30 segundos
 * e emite eventos quando a sessão muda.
 */

import { engineLogger } from "../engine/logger";

// ── Tipos ──

export type MarketSession = "open" | "closed";

export interface MarketSessionInfo {
  currentSession: MarketSession;
  dataSource: "binance" | "puma-hybrid";
  activeAssets: string[];
  nextTransition: Date | null;
  sessionLabel: string;
  assetsCount: number;
}

export type SessionChangeListener = (
  from: MarketSession,
  to: MarketSession,
  info: MarketSessionInfo,
) => void;

// ── Listas de Ativos ──

/** Ativos operados durante MERCADO ABERTO (Forex + Crypto + Ouro) */
export const OPEN_MARKET_ASSETS: string[] = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "BTCUSD",
  "ETHUSD",
  "XAUUSD",
];

/** Ativos híbridos Puma — disponíveis 24/7 */
export const HYBRID_ASSETS: string[] = [
  "BETHUSDT",
  "BTSOLUSDT",
  "MAPEUSDT",
  "XRDOGUSDT",
  "XRPSOLUSDT",
];

/** Ativos operados durante MERCADO FECHADO (somente híbridos) */
export const CLOSED_MARKET_ASSETS: string[] = [...HYBRID_ASSETS];

// ── Constantes ──
const CHECK_INTERVAL_MS = 30_000; // 30 segundos

// ── MarketSessionManager ──

export class MarketSessionManager {
  private _currentSession: MarketSession = "open";
  private _listeners: Set<SessionChangeListener> = new Set();
  private _checkTimer: ReturnType<typeof setInterval> | null = null;
  private _started = false;

  constructor() {
    this._currentSession = this._detectSession();
  }

  // ── Públicos ──

  /** Retorna a sessão atual completa */
  getCurrentSession(): MarketSessionInfo {
    const session = this._detectSession();
    // Híbridos sempre estão ativos; Forex/Crypto só quando aberto
    const activeAssets =
      session === "open" ? [...OPEN_MARKET_ASSETS, ...HYBRID_ASSETS] : [...HYBRID_ASSETS];
    return {
      currentSession: session,
      dataSource: session === "closed" ? "puma-hybrid" : "binance",
      activeAssets,
      nextTransition: this._getNextTransition(),
      sessionLabel: session === "open" ? "Mercado Aberto" : "Mercado Fechado",
      assetsCount: activeAssets.length,
    };
  }

  /** Retorna apenas a lista de ativos da sessão ativa */
  getActiveAssets(): string[] {
    // Híbridos sempre estão ativos; Forex/Crypto só quando aberto
    return this._currentSession === "open"
      ? [...OPEN_MARKET_ASSETS, ...HYBRID_ASSETS]
      : [...HYBRID_ASSETS];
  }

  /** Retorna a sessão atual (open/closed) */
  getSession(): MarketSession {
    return this._detectSession();
  }

  /** Retorna a fonte de dados recomendada */
  getDataSource(): "binance" | "puma-hybrid" {
    return this._currentSession === "closed" ? "puma-hybrid" : "binance";
  }

  /** Verifica se um ativo pertence à sessão atual */
  isActiveAsset(asset: string): boolean {
    const assets = this.getActiveAssets();
    return assets.includes(asset);
  }

  /** Registra listener para mudanças de sessão */
  onSessionChange(listener: SessionChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /** Inicia detecção automática (chamado uma vez) */
  startAutoDetection(): void {
    if (this._started) return;
    this._started = true;
    this._currentSession = this._detectSession();

    engineLogger.info("MarketSession", "Detecção automática iniciada", {
      currentSession: this._currentSession,
      sessionLabel: this._currentSession === "open" ? "Mercado Aberto" : "Mercado Fechado",
      assetsCount: this.getActiveAssets().length,
    });

    this._checkTimer = setInterval(() => this._checkAndSwitch(), CHECK_INTERVAL_MS);
  }

  /** Para detecção automática */
  stopAutoDetection(): void {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
    this._started = false;
    engineLogger.info("MarketSession", "Detecção automática parada");
  }

  // ── Privados ──

  /**
   * Retorna o horário atual em Brasília (UTC-3).
   */
  private _getBrtNow(): { date: Date; hour: number; minute: number; day: number } {
    const now = new Date();
    const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return {
      date: brt,
      hour: brt.getHours(),
      minute: brt.getMinutes(),
      day: brt.getDay(), // 0=Dom, 1=Seg, ..., 6=Sab
    };
  }

  /**
   * Detecta sessão atual baseada no cronograma real da Puma (GMT-3).
   *
   * Seg–Sex: Aberto 00:00–18:00 | Fechado 18:00–22:00 | Aberto 22:00–23:59
   * Sábado:  Fechado o dia todo
   * Domingo: Fechado 00:00–22:00 | Aberto 22:00–23:59
   *
   * NOTA: Híbridos ficam 24/7 — "fechado" significa apenas que Forex/Crypto
   * não estão disponíveis (somente híbridos operam).
   */
  private _detectSession(): MarketSession {
    const { hour, minute, day } = this._getBrtNow();
    const timeMinutes = hour * 60 + minute; // minutos desde 00:00

    // Domingo (0): Aberto só a partir das 22:00
    if (day === 0) {
      return timeMinutes >= 22 * 60 ? "open" : "closed";
    }

    // Sábado (6): Fechado o dia todo
    if (day === 6) {
      return "closed";
    }

    // Segunda a Sexta (1–5):
    // Aberto: 00:00–18:00 (até 18:00 = 1080 min)
    // Fechado: 18:00–22:00 (1080–1320 min)
    // Aberto: 22:00–23:59 (1320–1439 min)
    const closedStart = 18 * 60;      // 18:00 = 1080
    const closedEnd = 22 * 60;        // 22:00 = 1320

    if (timeMinutes >= closedStart && timeMinutes < closedEnd) {
      return "closed";
    }
    return "open";
  }

  /**
   * Calcula próxima transição de sessão baseada no cronograma real da Puma.
   */
  private _getNextTransition(): Date {
    const now = new Date();
    const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = brt.getHours();
    const minute = brt.getMinutes();
    const day = brt.getDay();
    const timeMinutes = hour * 60 + minute;

    const next = new Date(now);

    // Domingo (0)
    if (day === 0) {
      if (timeMinutes < 22 * 60) {
        // Fechado → Próxima transição: hoje às 22:00 (mercado abre)
        next.setHours(22, 0, 0, 0);
      } else {
        // Aberto → Próxima transição: segunda às 18:00 (mercado fecha)
        next.setDate(next.getDate() + (1 - 0 + 7) % 7); // próxima segunda
        next.setHours(18, 0, 0, 0);
      }
      return next;
    }

    // Sábado (6)
    if (day === 6) {
      // Fechado o dia todo → Próxima transição: domingo às 22:00 (mercado abre)
      next.setDate(next.getDate() + 1);
      next.setHours(22, 0, 0, 0);
      return next;
    }

    // Segunda a Sexta (1–5)
    const closedStart = 18 * 60;      // 18:00
    const closedEnd = 22 * 60;        // 22:00

    if (timeMinutes < closedStart) {
      // Aberto (manhã/tarde) → Próxima transição: hoje às 18:00 (mercado fecha)
      next.setHours(18, 0, 0, 0);
    } else if (timeMinutes < closedEnd) {
      // Fechado → Próxima transição: hoje às 22:00 (mercado abre)
      next.setHours(22, 0, 0, 0);
    } else {
      // Aberto (noite) → Próxima transição depende do dia
      if (day === 5) {
        // Sexta à noite → Próxima transição: sábado 00:00 (mercado fecha)
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
      } else {
        // Seg–Qui à noite → Próxima transição: amanhã às 18:00 (mercado fecha)
        next.setDate(next.getDate() + 1);
        next.setHours(18, 0, 0, 0);
      }
    }

    return next;
  }

  /** Verifica se houve mudança de sessão e emite evento */
  private _checkAndSwitch(): void {
    const newSession = this._detectSession();
    if (newSession !== this._currentSession) {
      const oldSession = this._currentSession;
      this._currentSession = newSession;
      const info = this.getCurrentSession();

      engineLogger.info("MarketSession", `═══ SESSÃO ALTERADA ═══`, {
        from: oldSession === "open" ? "Mercado Aberto" : "Mercado Fechado",
        to: newSession === "open" ? "Mercado Aberto" : "Mercado Fechado",
        dataSource: info.dataSource,
        assetsCount: info.assetsCount,
        assets: info.activeAssets.join(", "),
      });

      this._listeners.forEach((listener) => {
        try {
          listener(oldSession, newSession, info);
        } catch (err) {
          engineLogger.error("MarketSession", "Listener de sessão falhou", {
            error: String(err),
          });
        }
      });
    }
  }
}
