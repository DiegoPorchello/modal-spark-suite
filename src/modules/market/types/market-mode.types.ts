/**
 * MarketMode — the operator's choice for which market to trade.
 *
 * AUTO:  NEXOR detects the market automatically via MarketClassifier.
 * FOREX: Load Forex Core (EMA, ADX, BOS, CHoCH, Order Block, FVG, RSI, ATR).
 * HYBRID: Load Hybrid Core (Continuidade, Dominância, Candle Strength, EMA 9/21, ATR).
 */

export type MarketMode = "AUTO" | "FOREX" | "HYBRID";

export type OperationProfile = "AUTO" | "FOREX" | "HYBRID_FLOW" | "HYBRID_PROBABILITY";

export type MarketType = "FOREX" | "HYBRID" | "HYBRID_PROBABILITY";

export type CoreId = "forex-core" | "hybrid-core" | "hybrid-probability-core";
