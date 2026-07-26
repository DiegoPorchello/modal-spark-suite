/**
 * Forex Advisor Profile — text templates for FOREX recommendations.
 */

import type { AdvisorProfile } from "../../types/market-profile.types";

export const FOREX_ADVISOR: AdvisorProfile = {
  id: "forex-advisor",
  name: "Forex Advisor",
  templates: [
    {
      id: "trend-strong",
      condition: "Tendência forte confirmada por EMA e ADX",
      text: "Tendência forte confirmada por EMA 50 e BOS. Aguarde pullback até o Order Block para entrada.",
      priority: "LOW",
    },
    {
      id: "adx-confirmed",
      condition: "ADX > 25",
      text: "ADX confirma força da tendência. Operar na direção da tendência principal.",
      priority: "LOW",
    },
    {
      id: "pullback-zone",
      condition: "Pullback até zona de suporte/resistência",
      text: "Pullback detectado até zona de interesse. Monitore reação do preço para entrada.",
      priority: "MEDIUM",
    },
    {
      id: "rsi-reversal",
      condition: "RSI em zona de reversão",
      text: "RSI em zona extrema. Possível reversão — aguarde confirmação de estrutura.",
      priority: "MEDIUM",
    },
    {
      id: "order-block-detected",
      condition: "Order Block identificado",
      text: "Order Block detectado na direção da tendência. Zona de alta probabilidade para entrada.",
      priority: "MEDIUM",
    },
    {
      id: "fvg-confirmed",
      condition: "FVG na mesma direção",
      text: "Fair Value Gap confirma a direção. Aguarde preenchimento parcial para entrada.",
      priority: "LOW",
    },
    {
      id: "liquidity-sweep-detected",
      condition: "Varredura de liquidez detectada",
      text: "Liquidity Sweep identificado. Stop hunt institucional — reversão provável.",
      priority: "HIGH",
    },
    {
      id: "session-london-active",
      condition: "Sessão Londres ativa",
      text: "Sessão de Londres ativa. Alta liquidez e volatilidade — ideal para breakouts.",
      priority: "LOW",
    },
    {
      id: "session-ny-active",
      condition: "Sessão NY ativa",
      text: "Sessão de Nova York ativa. Cuidado com reversões no final da sessão.",
      priority: "MEDIUM",
    },
    {
      id: "breakout-confirmed",
      condition: "Breakout confirmado",
      text: "Breakout confirmado com volume. Entre na direção do breakout com stop no outro lado do range.",
      priority: "MEDIUM",
    },
    {
      id: "reversal-detected",
      condition: "Reversão detectada",
      text: "Possível reversão em andamento. Aguarde confirmação de CHoCH antes de entrar.",
      priority: "HIGH",
    },
    {
      id: "range-breakout",
      condition: "Breakout de range",
      text: "Mercado saindo de consolidação. Nova tendência formando — entre com confirmação.",
      priority: "MEDIUM",
    },
  ],
};
