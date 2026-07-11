/**
 * engine/support-resistance.ts
 * Detecção de Suporte e Resistência.
 *
 * Algoritmo:
 * - Varre candles para encontrar topos (high) e fundos (low) locais
 * - Agrupa níveis próximos (dentro de 0.1% do preço)
 * - Níveis com mais toques têm maior relevância
 *
 * Bloqueios:
 * - CALL perto de resistência
 * - PUT perto de suporte
 */

export interface SRLevel {
  type: "support" | "resistance";
  price: number;
  strength: number;
  touches: number;
}

export interface SRAnalysis {
  supports: SRLevel[];
  resistances: SRLevel[];
  blockCall: boolean;
  blockPut: boolean;
  proximityPercent: number;
}

export function detectSupportResistance(prices: number[], lookback = 20): SRAnalysis {
  if (prices.length < 10) {
    return {
      supports: [],
      resistances: [],
      blockCall: false,
      blockPut: false,
      proximityPercent: 0,
    };
  }

  const recent = prices.slice(-lookback);
  const levels = findSRLevels(recent);

  // Último preço
  const lastPrice = recent[recent.length - 1];

  // Proximidade
  let blockCall = false;
  let blockPut = false;
  let proximityPercent = 0;

  // Bloqueia CALL se estiver perto de resistência
  for (const res of levels.resistances) {
    const proximity = Math.abs(lastPrice - res.price) / res.price;
    if (lastPrice <= res.price && proximity < 0.003 && !blockCall) {
      blockCall = true;
      proximityPercent = proximity * 100;
    }
  }

  // Bloqueia PUT se estiver perto de suporte
  for (const sup of levels.supports) {
    const proximity = Math.abs(lastPrice - sup.price) / sup.price;
    if (lastPrice >= sup.price && proximity < 0.003 && !blockPut) {
      blockPut = true;
      proximityPercent = proximity * 100;
    }
  }

  return {
    supports: levels.supports,
    resistances: levels.resistances,
    blockCall,
    blockPut,
    proximityPercent,
  };
}

function findSRLevels(prices: number[]): { supports: SRLevel[]; resistances: SRLevel[] } {
  const supports: SRLevel[] = [];
  const resistances: SRLevel[] = [];

  // Encontra topos e fundos locais
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = 2; i < prices.length - 2; i++) {
    const center = prices[i];
    // Topo local
    if (
      center > prices[i - 1] &&
      center > prices[i - 2] &&
      center >= prices[i + 1] &&
      center >= prices[i + 2]
    ) {
      peaks.push(center);
    }
    // Fundo local
    if (
      center < prices[i - 1] &&
      center < prices[i - 2] &&
      center <= prices[i + 1] &&
      center <= prices[i + 2]
    ) {
      troughs.push(center);
    }
  }

  // Agrupa níveis próximos
  const groupedPeaks = groupLevels(peaks);
  const groupedTroughs = groupLevels(troughs);

  for (const gp of groupedPeaks) {
    resistances.push({
      type: "resistance",
      price: gp.price,
      strength: gp.strength,
      touches: gp.count,
    });
  }
  for (const gt of groupedTroughs) {
    supports.push({ type: "support", price: gt.price, strength: gt.strength, touches: gt.count });
  }

  // Ordena por força
  supports.sort((a, b) => b.strength - a.strength);
  resistances.sort((a, b) => b.strength - a.strength);

  return { supports: supports.slice(0, 5), resistances: resistances.slice(0, 5) };
}

interface GroupedLevel {
  price: number;
  count: number;
  strength: number;
}

function groupLevels(levels: number[], thresholdPercent = 0.001): GroupedLevel[] {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a - b);
  const groups: GroupedLevel[] = [];
  let currentGroup: number[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const avg = currentGroup.reduce((s, v) => s + v, 0) / currentGroup.length;
    if (Math.abs(sorted[i] - avg) / avg <= thresholdPercent) {
      currentGroup.push(sorted[i]);
    } else {
      const avgPrice = currentGroup.reduce((s, v) => s + v, 0) / currentGroup.length;
      groups.push({
        price: avgPrice,
        count: currentGroup.length,
        strength: Math.min(100, currentGroup.length * 20),
      });
      currentGroup = [sorted[i]];
    }
  }
  const avgPrice = currentGroup.reduce((s, v) => s + v, 0) / currentGroup.length;
  groups.push({
    price: avgPrice,
    count: currentGroup.length,
    strength: Math.min(100, currentGroup.length * 20),
  });

  return groups;
}
