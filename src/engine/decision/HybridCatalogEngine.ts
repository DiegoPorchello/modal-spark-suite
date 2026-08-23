// ==========================================================================
// HybridCatalogEngine.ts
// Motor de catalogação dos 5 híbridos — seleção automática do melhor ativo
// Baseado em: horário mais cheio (1h antes do quadrante atual),
// maior assertividade, e ciclo de 5 velas.
// ==========================================================================

import type { Candle } from "../../market/types";
import { engineLogger } from "../logger";

// ── Ativos híbridos PUMA ──
export const HYBRID_ASSETS = ["BETHUSDT", "BTSOLUSDT", "MAPEUSDT", "XRDOGUSDT", "XRPSOLUSDT"] as const;
export type HybridAsset = (typeof HYBRID_ASSETS)[number];

// ── Etapas do ciclo de 5 velas ──
export type CandleStep = "INICIO" | "CONTINUIDADE" | "PREPARANDO" | "ENTRADA" | "RESULTADO";

// ── Resultado da catalogação de um ativo ──
export interface AssetCatalogResult {
  asset: string;
  totalOperations: number;
  wins: number;
  losses: number;
  winRate: number;
  assertiveness: number;
  consecutiveWins: number;
  maxConsecutiveWins: number;
  quadrant: string;
  lastHourActivity: number;
}

// ── Estado do ciclo de entrada ──
export interface EntryCycle {
  asset: string;
  step: CandleStep;
  stepCount: number;
  candleIndex: number;
  color: "GREEN" | "RED" | null;
  direction: "CALL" | "PUT" | null;
  lastResult?: "WIN" | "LOSS";
  cycleStartIndex: number;
}

// ── Estado global da catalogação ──
export interface HybridCatalogState {
  selectedAsset: string | null;
  assertiveness: number;
  winRate: number;
  consecutiveWins: number;
  totalOperations: number;
  wins: number;
  losses: number;
  assetResults: AssetCatalogResult[];
  currentCycle: EntryCycle | null;
  isReady: boolean;
}

// ── Helper: cor da vela ──
function candleColor(c: Candle): "GREEN" | "RED" {
  return c.close >= c.open ? "GREEN" : "RED";
}

// ── Helper: corpo da vela ──
function candleBody(c: Candle): number {
  return Math.abs(c.close - c.open);
}

/**
 * HybridCatalogEngine
 *
 * Responsável por:
 * 1. Catalogar os 5 ativos híbridos no startup
 * 2. Encontrar o horário mais cheio (1h antes do quadrante atual)
 * 3. Selecionar o ativo com maior assertividade
 * 4. Gerenciar o ciclo de 5 velas para entrada
 */
export class HybridCatalogEngine {
  private state: HybridCatalogState;
  private listeners: Array<(state: HybridCatalogState) => void> = [];

  constructor() {
    this.state = {
      selectedAsset: null,
      assertiveness: 0,
      winRate: 0,
      consecutiveWins: 0,
      totalOperations: 0,
      wins: 0,
      losses: 0,
      assetResults: [],
      currentCycle: null,
      isReady: false,
    };
  }

  /**
   * Registra listener para mudanças de estado
   */
  onStateChange(listener: (state: HybridCatalogState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  /**
   * Retorna o estado atual da catalogação
   */
  getState(): HybridCatalogState {
    return { ...this.state };
  }

  /**
   * Retorna o quadrante atual baseado no horário
   * Quadrante = período de 1h (0-59 = Q1, 60-119 = Q2, etc.)
   */
  getCurrentQuadrant(): { label: string; hour: number } {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const quadrantNum = Math.floor((hour * 60 + minute) / 60) + 1;
    return {
      label: `Q${quadrantNum}`,
      hour,
    };
  }

  /**
   * Retorna o horário de 1h antes do quadrante atual
   * (horário "mais cheio" para iniciar catalogação)
   */
  getCatalogStartTime(): Date {
    const now = new Date();
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(now.getHours() - 1);
    oneHourAgo.setMinutes(0, 0, 0);
    return oneHourAgo;
  }

  /**
   * Analisa um ativo híbrido com base nos candles disponíveis
   * e retorna métricas de assertividade
   */
  analyzeAsset(asset: string, candles: Candle[]): AssetCatalogResult {
    const catalogStartTime = this.getCatalogStartTime();
    const catalogTimestamp = catalogStartTime.getTime();

    // Filtra candles a partir de 1h atrás
    const recentCandles = candles.filter((c) => c.time >= catalogTimestamp);

    // Calcula métricas baseadas no padrão de 2 candles iguais
    let totalOps = 0;
    let wins = 0;
    let losses = 0;
    let consecutiveWins = 0;
    let maxConsecutiveWins = 0;

    for (let i = 0; i < recentCandles.length - 2; i++) {
      const c1 = candleColor(recentCandles[i]);
      const c2 = candleColor(recentCandles[i + 1]);
      const c3 = candleColor(recentCandles[i + 2]);

      // Padrão: 2 candles iguais → entrada no 3º na mesma direção
      if (c1 === c2) {
        totalOps++;
        const win = c3 === c1;
        if (win) {
          wins++;
          consecutiveWins++;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        } else {
          losses++;
          consecutiveWins = 0;
        }
      }
    }

    const winRate = totalOps > 0 ? (wins / totalOps) * 100 : 0;

    // Assertividade = winRate ponderado pela quantidade de operações
    const assertiveness = totalOps > 0
      ? winRate * Math.min(totalOps / 10, 1) // Penaliza ativos com poucos dados
      : 0;

    // Detecta quadrante atual
    const { label: quadrant } = this.getCurrentQuadrant();

    return {
      asset,
      totalOperations: totalOps,
      wins,
      losses,
      winRate,
      assertiveness,
      consecutiveWins,
      maxConsecutiveWins,
      quadrant,
      lastHourActivity: recentCandles.length,
    };
  }

  /**
   * Cataloga todos os 5 ativos híbridos e seleciona o melhor
   */
  async catalogAllAssets(
    getCandles: (asset: string) => Promise<Candle[]>,
  ): Promise<HybridCatalogState> {
    console.log("[HybridCatalog] Iniciando catalogação dos 5 ativos híbridos...");

    const results: AssetCatalogResult[] = [];

    for (const asset of HYBRID_ASSETS) {
      try {
        const candles = await getCandles(asset);
        const result = this.analyzeAsset(asset, candles);
        results.push(result);

        console.log(
          `[HybridCatalog] ${asset}: WR=${result.winRate.toFixed(1)}% | Ops=${result.totalOperations} | Assert=${result.assertiveness.toFixed(1)} | Atividade=${result.lastHourActivity}`,
        );
      } catch (e) {
        console.warn(`[HybridCatalog] Erro ao analisar ${asset}:`, e);
        results.push({
          asset,
          totalOperations: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          assertiveness: 0,
          consecutiveWins: 0,
          maxConsecutiveWins: 0,
          quadrant: "Q1",
          lastHourActivity: 0,
        });
      }
    }

    // Ordena por assertividade (maior primeiro)
    results.sort((a, b) => b.assertiveness - a.assertiveness);

    // Seleciona o melhor ativo
    const bestAsset = results[0];

    this.state = {
      selectedAsset: bestAsset.asset,
      assertiveness: bestAsset.assertiveness,
      winRate: bestAsset.winRate,
      consecutiveWins: bestAsset.consecutiveWins,
      totalOperations: bestAsset.totalOperations,
      wins: bestAsset.wins,
      losses: bestAsset.losses,
      assetResults: results,
      currentCycle: null,
      isReady: true,
    };

    engineLogger.info("HybridCatalog", "═══ CATALOGAÇÃO COMPLETA ═══", {
      selectedAsset: bestAsset.asset,
      assertiveness: bestAsset.assertiveness.toFixed(1),
      winRate: bestAsset.winRate.toFixed(1),
      totalAssets: results.length,
    });

    this.emit();
    return this.getState();
  }

  /**
   * Retorna o ativo selecionado
   */
  getSelectedAsset(): string | null {
    return this.state.selectedAsset;
  }

  /**
   * Processa uma nova vela para o ciclo de entrada
   * Implementa a lógica de 5 velas:
   * 1ª: INICIO (marca início do quadrante)
   * 2ª: CONTINUIDADE
   * 3ª: PREPARANDO (aguardando entrada)
   * 4ª: ENTRADA
   * 5ª: RESULTADO (WIN/LOSS) → reinicia ciclo
   */
  processCandle(candle: Candle, candleIndex: number): EntryCycle | null {
    if (!this.state.selectedAsset) return null;

    const color = candleColor(candle);
    let cycle = this.state.currentCycle;

    if (!cycle) {
      // Inicia novo ciclo
      cycle = {
        asset: this.state.selectedAsset,
        step: "INICIO",
        stepCount: 1,
        candleIndex,
        color,
        direction: color === "GREEN" ? "CALL" : "PUT",
        cycleStartIndex: candleIndex,
      };
    } else {
      // Avança o ciclo
      cycle.stepCount++;
      cycle.candleIndex = candleIndex;
      cycle.color = color;

      if (cycle.stepCount === 2) {
        cycle.step = "CONTINUIDADE";
      } else if (cycle.stepCount === 3) {
        cycle.step = "PREPARANDO";
      } else if (cycle.stepCount === 4) {
        cycle.step = "ENTRADA";
      } else if (cycle.stepCount >= 5) {
        cycle.step = "RESULTADO";

        // Verifica WIN/LOSS baseado na direção
        const isWin = cycle.direction === "CALL"
          ? color === "GREEN"
          : color === "RED";

        cycle.lastResult = isWin ? "WIN" : "LOSS";

        // Atualiza métricas
        if (isWin) {
          this.state.wins++;
          this.state.consecutiveWins++;
        } else {
          this.state.losses++;
          this.state.consecutiveWins = 0;
        }
        this.state.totalOperations++;
        this.state.winRate = this.state.totalOperations > 0
          ? (this.state.wins / this.state.totalOperations) * 100
          : 0;

        // Reinicia ciclo a partir desta vela (5ª vela vira nova 1ª)
        this.state.currentCycle = {
          asset: this.state.selectedAsset,
          step: "INICIO",
          stepCount: 1,
          candleIndex,
          color,
          direction: color === "GREEN" ? "CALL" : "PUT",
          cycleStartIndex: candleIndex,
        };

        this.emit();
        return this.state.currentCycle;
      }
    }

    this.state.currentCycle = cycle;
    this.emit();
    return cycle;
  }

  /**
   * Registra operação externa (WIN/LOSS) para atualizar métricas
   */
  recordOperation(result: "WIN" | "LOSS"): void {
    if (result === "WIN") {
      this.state.wins++;
      this.state.consecutiveWins++;
    } else {
      this.state.losses++;
      this.state.consecutiveWins = 0;
    }
    this.state.totalOperations++;
    this.state.winRate = this.state.totalOperations > 0
      ? (this.state.wins / this.state.totalOperations) * 100
      : 0;

    this.emit();
  }

  /**
   * Força seleção de um ativo específico
   */
  selectAsset(asset: string): void {
    if (HYBRID_ASSETS.includes(asset as HybridAsset)) {
      this.state.selectedAsset = asset;
      this.state.currentCycle = null;
      this.emit();
    }
  }

  /**
   * Reseta a catalogação
   */
  reset(): void {
    this.state = {
      selectedAsset: null,
      assertiveness: 0,
      winRate: 0,
      consecutiveWins: 0,
      totalOperations: 0,
      wins: 0,
      losses: 0,
      assetResults: [],
      currentCycle: null,
      isReady: false,
    };
    this.emit();
  }
}
