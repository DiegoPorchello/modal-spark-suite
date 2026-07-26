/**
 * FOREX Supply & Demand Indicators
 *
 * Supply Zone, Demand Zone
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_SUPPLYDEMAND_INDICATORS: CoreIndicator[] = [
  {
    id: "supply-zone",
    name: "Supply Zone",
    category: "structure",
    description: "Zona de oferta — área onde vendedores entraram fortemente",
    maxPoints: 14,
    defaultParams: {},
  },
  {
    id: "demand-zone",
    name: "Demand Zone",
    category: "structure",
    description: "Zona de demanda — área onde compradores entraram fortemente",
    maxPoints: 14,
    defaultParams: {},
  },
];
