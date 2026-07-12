import type { Candle } from "./types";

const TIMEFRAME_MINUTES: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
};

function normalizeTime(time: number, minuteInterval: number): number {
  const msInterval = minuteInterval * 60 * 1000;
  return Math.floor(time / msInterval) * msInterval;
}

export function aggregateCandles(m1Candles: Candle[], targetTimeframe: string): Candle[] {
  const intervalMinutes = TIMEFRAME_MINUTES[targetTimeframe];
  if (!intervalMinutes || intervalMinutes <= 1) {
    return m1Candles;
  }

  const grouped = new Map<number, Candle[]>();

  for (const c of m1Candles) {
    const bucket = normalizeTime(c.time, intervalMinutes);
    if (!grouped.has(bucket)) {
      grouped.set(bucket, []);
    }
    grouped.get(bucket)!.push(c);
  }

  const result: Candle[] = [];
  const sortedBuckets = Array.from(grouped.keys()).sort((a, b) => a - b);

  for (const bucket of sortedBuckets) {
    const candles = grouped.get(bucket)!;
    if (candles.length === 0) continue;

    const open = candles[0].open;
    let high = -Infinity;
    let low = Infinity;
    const close = candles[candles.length - 1].close;
    let volume = 0;
    const asset = candles[0].asset;
    const verify = candles[candles.length - 1].verify;

    for (const c of candles) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }

    result.push({
      time: bucket,
      open,
      high,
      low,
      close,
      volume,
      asset,
      verify,
    });
  }

  return result;
}
