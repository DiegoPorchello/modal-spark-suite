/**
 * Hybrid Advisor Profile — text templates for HYBRID recommendations.
 */

import type { AdvisorProfile } from "../../types/market-profile.types";

export const HYBRID_ADVISOR: AdvisorProfile = {
  id: "hybrid-advisor",
  name: "Hybrid Advisor",
  templates: [
    {
      id: "flow-strong",
      condition: "Fluxo comprador/vendedor forte",
      text: "Fluxo comprador dominante. Candle de força acima da média. Timing favorável.",
      priority: "LOW",
    },
    {
      id: "dominance-confirmed",
      condition: "Dominância > 60%",
      text: "Dominância confirmada. Corpo do candle domina o range — momentum sustentado.",
      priority: "LOW",
    },
    {
      id: "continuation-confirmed",
      condition: "Continuidade retomada",
      text: "Continuidade retomada após pullback. Micro BOS confirma entrada.",
      priority: "MEDIUM",
    },
    {
      id: "pullback-ema",
      condition: "Pullback até EMA curta",
      text: "Pullback até EMA 9/21. Zona de compra — aguarde confirmação de micro BOS.",
      priority: "MEDIUM",
    },
    {
      id: "momentum-strong",
      condition: "Momentum forte com EMA",
      text: "Momentum forte — EMA 9 acima da EMA 21. Candle com força sustentada.",
      priority: "LOW",
    },
    {
      id: "volatility-ideal",
      condition: "ATR dentro da faixa ideal",
      text: "Volatilidade adequada para operação. ATR dentro da faixa histórica.",
      priority: "LOW",
    },
    {
      id: "liquidity-high",
      condition: "Liquidez sintética alta",
      text: "Liquidez sintética elevada. Volume e pressão de preço confirmam a direção.",
      priority: "MEDIUM",
    },
    {
      id: "flow-confirmed",
      condition: "Fluxo confirmado por micro estrutura",
      text: "Fluxo confirmado por micro BOS. Entrada com alta probabilidade.",
      priority: "MEDIUM",
    },
    {
      id: "reversal-detected",
      condition: "Micro CHoCH detectado",
      text: "Reversão em andamento — micro CHoCH identificado. Aguarde dominância confirmar.",
      priority: "HIGH",
    },
    {
      id: "dominance-shift",
      condition: "Mudança de dominância",
      text: "Dominância mudou de direção. Possível início de novo fluxo — monitore candle de confirmação.",
      priority: "HIGH",
    },
  ],
};
