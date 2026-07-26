/**
 * FOREX Momentum Indicators
 *
 * RSI, ATR
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_MOMENTUM_INDICATORS: CoreIndicator[] = [
  {
    id: "rsi",
    name: "RSI",
    category: "momentum",
    description: "Relative Strength Index — momentum e zonas de sobrecompra/sobrevenda",
    maxPoints: 12,
    defaultParams: { period: 14, overbought: 70, oversold: 30 },
  },
  {
    id: "atr",
    name: "ATR",
    category: "momentum",
    description: "Average True Range — volatilidade e distância de stop/target",
    maxPoints: 10,
    defaultParams: { period: 14 },
  },
];
