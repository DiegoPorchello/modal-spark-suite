/**
 * FOREX Structure Indicators
 *
 * BOS, CHoCH, HH/HL/LH/LL
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_STRUCTURE_INDICATORS: CoreIndicator[] = [
  {
    id: "bos",
    name: "BOS",
    category: "structure",
    description: "Break of Structure — confirmação de mudança de estrutura",
    maxPoints: 15,
    defaultParams: {},
  },
  {
    id: "choch",
    name: "CHoCH",
    category: "structure",
    description: "Change of Character — reversão de caráter do mercado",
    maxPoints: 14,
    defaultParams: {},
  },
  {
    id: "hh-hl-lh-ll",
    name: "HH / HL / LH / LL",
    category: "structure",
    description: "Higher Highs, Higher Lows, Lower Highs, Lower Lows — estrutura de tendência",
    maxPoints: 12,
    defaultParams: {},
  },
];
