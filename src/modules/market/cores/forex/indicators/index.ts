/**
 * FOREX Indicators — barrel export
 */

export { FOREX_TREND_INDICATORS } from "./trend.indicators";
export { FOREX_STRUCTURE_INDICATORS } from "./structure.indicators";
export { FOREX_SMARTMONEY_INDICATORS } from "./smartmoney.indicators";
export { FOREX_SUPPLYDEMAND_INDICATORS } from "./supplydemand.indicators";
export { FOREX_MOMENTUM_INDICATORS } from "./momentum.indicators";
export { FOREX_SESSION_INDICATORS } from "./session.indicators";

import type { CoreIndicator } from "../../../types/market-profile.types";
import { FOREX_TREND_INDICATORS } from "./trend.indicators";
import { FOREX_STRUCTURE_INDICATORS } from "./structure.indicators";
import { FOREX_SMARTMONEY_INDICATORS } from "./smartmoney.indicators";
import { FOREX_SUPPLYDEMAND_INDICATORS } from "./supplydemand.indicators";
import { FOREX_MOMENTUM_INDICATORS } from "./momentum.indicators";
import { FOREX_SESSION_INDICATORS } from "./session.indicators";

export const ALL_FOREX_INDICATORS: CoreIndicator[] = [
  ...FOREX_TREND_INDICATORS,
  ...FOREX_STRUCTURE_INDICATORS,
  ...FOREX_SMARTMONEY_INDICATORS,
  ...FOREX_SUPPLYDEMAND_INDICATORS,
  ...FOREX_MOMENTUM_INDICATORS,
  ...FOREX_SESSION_INDICATORS,
];
