/**
 * MarketClassifier — detects whether an asset belongs to FOREX or HYBRID.
 *
 * Used only in AUTO mode by the CoreLoader.
 * Classification is based on:
 *   1. Asset name pattern matching (EURUSD = FOREX, BTCUSD = HYBRID)
 *   2. Fallback: assume FOREX for unknown assets
 *
 * Updated with diagnostic logs and expanded patterns.
 */

import type { MarketType } from "../types/market-mode.types";

interface ClassificationResult {
  market: MarketType;
  confidence: number;
  reason: string;
  matchedPattern?: string;
}

// ══════════════════════════════════════════════════════════════════════════
// FOREX PATTERNS
// ══════════════════════════════════════════════════════════════════════════

const FOREX_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Major pairs
  { pattern: /^(EUR|GBP|USD|JPY|CHF|AUD|NZD|CAD)(EUR|GBP|USD|JPY|CHF|AUD|NZD|CAD)$/i, name: "major-pair" },
  // With separators
  { pattern: /^(EUR|GBP|USD|JPY|CHF|AUD|NZD|CAD)[\/._\-](EUR|GBP|USD|JPY|CHF|AUD|NZD|CAD)$/i, name: "major-pair-separator" },
  // Exotic pairs
  { pattern: /^(USD|EUR|GBP)(MXN|ZAR|TRY|SEK|NOK|DKK|PLN|HUF|CZK)$/i, name: "exotic-pair" },
];

// ══════════════════════════════════════════════════════════════════════════
// HYBRID PATTERNS
// ══════════════════════════════════════════════════════════════════════════

const HYBRID_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Simple crypto symbols
  { pattern: /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|MATIC|DOT|LINK|UNI|ATOM|LTC|BCH)$/i, name: "crypto-simple" },
  // Crypto pairs with separator
  { pattern: /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|MATIC|DOT|LINK|UNI|ATOM|LTC|BCH)[\/._\-](USD|USDT|USDC|BUSD)$/i, name: "crypto-pair-separator" },
  // Crypto pairs WITHOUT separator (BETHUSDT, WBTCUSDT, etc.)
  { pattern: /^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|MATIC|DOT|LINK|UNI|ATOM|LTC|BCH)(USD|USDT|USDC|BUSD)$/i, name: "crypto-pair-no-separator" },
  // Wrapped/prefixed crypto (BETH, WBTC, etc.)
  { pattern: /^(W|B|S|A|C)?(BTC|ETH|SOL|BNB|XRP)(USD|USDT|USDC|BUSD)$/i, name: "crypto-wrapped" },
  // Indices
  { pattern: /^(SPX|SP500|NAS100|US30|DAX|FTSE|NIKKEI|HSI)$/i, name: "index-simple" },
  { pattern: /^(SPX500|NASDAQ|DOWJONES|DAX40|FTSE100)$/i, name: "index-full" },
  // Commodities (synthetic)
  { pattern: /^(GOLD|SILVER|OIL|CRUDE|XAU|XAG|WTI|BRENT)$/i, name: "commodity-simple" },
  { pattern: /^(XAU|XAG)[\/._\-](USD)$/i, name: "commodity-pair" },
  // Synthetic indices (Deriv-style)
  { pattern: /^(BOOM|CRASH|BULL|BEAR|SPRINT|JUMP|HUSTLE|OVER)\d*$/i, name: "synthetic-index" },
  { pattern: /^(VOLATILITY|VOL)\d*$/i, name: "volatility-index" },
  { pattern: /^(STEP|DRIFT|RANGED)\d*$/i, name: "step-index" },
];

// ══════════════════════════════════════════════════════════════════════════
// CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Classify an asset as FOREX or HYBRID.
 * Includes diagnostic logging for debugging.
 */
export function classifyMarket(
  asset?: string,
  _candles?: number[],
): ClassificationResult {
  const timestamp = new Date().toLocaleTimeString("pt-BR");

  if (!asset) {
    console.log(`[MarketClassifier] ${timestamp} ⚠️ Ativo não especificado → assumindo FOREX`);
    return { market: "FOREX", confidence: 50, reason: "Ativo não especificado — assumindo FOREX" };
  }

  const normalized = asset.replace(/[\s\-\/\.]/g, "").toUpperCase();

  console.log(`[MarketClassifier] ${timestamp} 🔍 Classificando ativo: "${asset}" → normalizado: "${normalized}"`);

  // Check HYBRID patterns first (more specific)
  for (const { pattern, name } of HYBRID_PATTERNS) {
    if (pattern.test(normalized)) {
      console.log(`[MarketClassifier] ${timestamp} ✅ "${asset}" corresponde a padrão HYBRID: ${name}`);
      return {
        market: "HYBRID",
        confidence: 95,
        reason: `Ativo "${asset}" corresponde a padrão HYBRID (${name})`,
        matchedPattern: name,
      };
    }
  }

  // Check FOREX patterns
  for (const { pattern, name } of FOREX_PATTERNS) {
    if (pattern.test(normalized)) {
      console.log(`[MarketClassifier] ${timestamp} ✅ "${asset}" corresponde a padrão FOREX: ${name}`);
      return {
        market: "FOREX",
        confidence: 95,
        reason: `Ativo "${asset}" corresponde a padrão FOREX (${name})`,
        matchedPattern: name,
      };
    }
  }

  // Fallback: unknown asset → FOREX with lower confidence
  console.log(`[MarketClassifier] ${timestamp} ⚠️ "${asset}" não reconhecido → assumindo FOREX (fallback)`);
  return {
    market: "FOREX",
    confidence: 60,
    reason: `Ativo "${asset}" não reconhecido — assumindo FOREX`,
    matchedPattern: "fallback",
  };
}
