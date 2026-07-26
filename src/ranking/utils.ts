/**
 * ranking/utils.ts
 * Utilitários compartilhados de ranking.
 *
 * Única fonte de verdade para selecionar a melhor entrada por ativo.
 * Todos os componentes devem consumir getBestEntryPerAsset() em vez de
 * implementar lógica própria de deduplicação.
 */

import type { ScanLogEntry } from "../modules/analyst/AnalystTypes";

/**
 * Seleciona a melhor entrada por ativo a partir de um array de scanLog.
 *
 * Regra: Highest Score Wins.
 * Empate: ganha quem tiver direction definida.
 *
 * @param entries - Array bruto do scanLog (pode conter múltiplos timeframes por ativo)
 * @returns Map<asset, bestEntry> com exatamente 1 entrada por ativo
 */
export function getBestEntryPerAsset(entries: ScanLogEntry[]): Map<string, ScanLogEntry> {
  const bestByAsset = new Map<string, ScanLogEntry>();
  for (const e of entries) {
    const existing = bestByAsset.get(e.asset);
    if (
      !existing ||
      e.score > existing.score ||
      (e.score === existing.score && !existing.direction && e.direction)
    ) {
      bestByAsset.set(e.asset, e);
    }
  }
  return bestByAsset;
}

/**
 * Versão simplificada que retorna apenas o array ordenado por score desc.
 */
export function getBestEntriesSorted(entries: ScanLogEntry[]): ScanLogEntry[] {
  return Array.from(getBestEntryPerAsset(entries).values()).sort((a, b) => b.score - a.score);
}
