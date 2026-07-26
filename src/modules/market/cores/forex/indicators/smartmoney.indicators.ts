/**
 * FOREX Smart Money Indicators
 *
 * Order Blocks, Fair Value Gap, Liquidity Sweep, Breaker Blocks
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_SMARTMONEY_INDICATORS: CoreIndicator[] = [
  {
    id: "order-block",
    name: "Order Block",
    category: "structure",
    description: "Zona de acumulação institucional — última candle antes do movimento",
    maxPoints: 18,
    defaultParams: {},
  },
  {
    id: "fvg",
    name: "Fair Value Gap",
    category: "structure",
    description: "Gap de valor justo — desequilíbrio de preços",
    maxPoints: 16,
    defaultParams: {},
  },
  {
    id: "liquidity-sweep",
    name: "Liquidity Sweep",
    category: "structure",
    description: "Varredura de liquidez — busca de stops acima/abaixo de suportes/resistências",
    maxPoints: 17,
    defaultParams: {},
  },
  {
    id: "breaker-block",
    name: "Breaker Block",
    category: "structure",
    description: "Order Block que foi rompido — zona de reversão (opcional)",
    maxPoints: 10,
    defaultParams: {},
  },
];
