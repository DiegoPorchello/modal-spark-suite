export interface NextTrade {
  traceId: string;
  decisionId: number;
  symbol: string;
  direction: "call" | "put";
  score: number;
  amount: number;
  expiration: number;
  entryPrice: number;
  payout: number;
  timeframe: string;
  valid: boolean;
  decidedAt: number;
  signalCandleTime: number;
  signalCandleOpen: number;
  signalCandleClose: number;
  candleId: string;
}

export interface EntryRecord {
  traceId: string;
  tradeId: string;
  decisionId: number;
  symbol: string;
  timeframe: string;
  candleOpenTime: number;
  decisionTime: number;
  sendTime: number;
  confirmationTime: number;
  decisionDelay: number;
  executionDelay: number;
  brokerDelay: number;
  totalLatency: number;
  result: "WIN" | "LOSS" | "DRAW";
  signalCandleTime: number;
  signalCandleOpen: number;
  signalCandleClose: number;
  expectedEntryCandle: number;
  actualEntryTime: number;
  expectedExpiration: number;
  actualExpiration: string;
  candleId: string;
  durationReceived: number;
  durationPropagated: number;
  durationEffective: number;
  tsDateNow: number;
  tsClockNow: number;
  tsPerfNow: number;
}

export interface EntryPrecisionStats {
  last: number;
  average: number;
  best: number;
  worst: number;
  count: number;
  color: "green" | "yellow" | "orange" | "red";
}

export function getPrecisionColor(ms: number): "green" | "yellow" | "orange" | "red" {
  if (ms <= 100) return "green";
  if (ms <= 250) return "yellow";
  if (ms <= 500) return "orange";
  return "red";
}

export function getPrecisionColorClass(ms: number): string {
  if (ms <= 100) return "text-success";
  if (ms <= 250) return "text-warning";
  if (ms <= 500) return "text-orange";
  return "text-danger";
}
