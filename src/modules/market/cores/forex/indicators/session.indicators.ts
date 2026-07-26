/**
 * FOREX Session Indicators
 *
 * Ásia, Londres, Nova York
 */

import type { CoreIndicator } from "../../../types/market-profile.types";

export const FOREX_SESSION_INDICATORS: CoreIndicator[] = [
  {
    id: "session-asia",
    name: "Sessão Ásia",
    category: "session",
    description: "Sessão asiática (00:00-09:00 GMT) — geralmente lateral",
    maxPoints: 6,
    defaultParams: { start: 0, end: 9 },
  },
  {
    id: "session-london",
    name: "Sessão Londres",
    category: "session",
    description: "Sessão londrina (08:00-17:00 GMT) — maior liquidez",
    maxPoints: 10,
    defaultParams: { start: 8, end: 17 },
  },
  {
    id: "session-newyork",
    name: "Sessão Nova York",
    category: "session",
    description: "Sessão nova-iorquina (13:00-22:00 GMT) — sobreposição com Londres",
    maxPoints: 9,
    defaultParams: { start: 13, end: 22 },
  },
];
