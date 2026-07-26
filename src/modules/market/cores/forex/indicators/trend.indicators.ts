/**
 * FOREX Trend Indicators
 *
 * EMA 20, EMA 50, EMA 200, ADX
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_TREND_INDICATORS: CoreIndicator[] = [
  {
    id: "ema-20",
    name: "EMA 20",
    category: "trend",
    description: "Média móvel exponencial de 20 períodos — direção de curto prazo",
    maxPoints: 8,
    defaultParams: { period: 20 },
  },
  {
    id: "ema-50",
    name: "EMA 50",
    category: "trend",
    description: "Média móvel exponencial de 50 períodos — direção de médio prazo",
    maxPoints: 7,
    defaultParams: { period: 50 },
  },
  {
    id: "ema-200",
    name: "EMA 200",
    category: "trend",
    description: "Média móvel exponencial de 200 períodos — direção de longo prazo",
    maxPoints: 6,
    defaultParams: { period: 200 },
  },
  {
    id: "adx",
    name: "ADX",
    category: "trend",
    description: "Average Directional Index — força da tendência (acima de 25 = forte)",
    maxPoints: 10,
    defaultParams: { period: 14, threshold: 25 },
  },
];
