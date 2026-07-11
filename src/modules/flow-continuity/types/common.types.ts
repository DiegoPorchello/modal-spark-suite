/**
 * common.types.ts
 * Tipos compartilhados entre todos os submódulos do Fluxo de Continuidade PRO.
 * Define entidades base como ativos, timeframes, moedas e utilitários de paginação.
 */

/** Ativo financeiro negociável (par forex, crypto, commodity, etc.) */
export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  flag?: string;
  digits: number;
  pipValue: number;
  minLot: number;
  maxLot: number;
  sessionHours: TradingSession[];
}

export type AssetCategory =
  | "forex-major"
  | "forex-minor"
  | "forex-exotic"
  | "crypto"
  | "commodity"
  | "index"
  | "stock";

export interface TradingSession {
  exchange: string;
  open: string;
  close: string;
  timezone: string;
}

/** Timeframes suportados pelo robô */
export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

/** Paridade de moeda (ex: EUR/USD) */
export interface CurrencyPair {
  base: string;
  quote: string;
  display: string;
}

/** Intervalo de datas para consultas */
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

/** Paginação genérica para listas */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** Filtro genérico de ordenação */
export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

/** Resposta padrão da API */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}
