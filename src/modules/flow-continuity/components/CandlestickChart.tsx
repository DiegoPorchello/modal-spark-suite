"use client";

import React from "react";

export interface CandlestickData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: CandlestickData[];
  height?: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  height = 400,
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground border border-border rounded"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-lg mb-2">📊</div>
          <div className="text-xs">Aguardando dados de candlestick...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" style={{ height }}>
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-muted-foreground">
            <th className="p-1 text-left">Hora</th>
            <th className="p-1 text-right">Open</th>
            <th className="p-1 text-right">High</th>
            <th className="p-1 text-right">Low</th>
            <th className="p-1 text-right">Close</th>
            <th className="p-1 text-right">Vol</th>
          </tr>
        </thead>
        <tbody>
          {data.map((candle, i) => {
            const isBullish = candle.close >= candle.open;
            return (
              <tr
                key={i}
                className={isBullish ? "text-green-400" : "text-red-400"}
              >
                <td className="p-1 text-left text-muted-foreground">
                  {candle.time}
                </td>
                <td className="p-1 text-right">{candle.open.toFixed(5)}</td>
                <td className="p-1 text-right">{candle.high.toFixed(5)}</td>
                <td className="p-1 text-right">{candle.low.toFixed(5)}</td>
                <td className="p-1 text-right font-bold">
                  {candle.close.toFixed(5)}
                </td>
                <td className="p-1 text-right text-muted-foreground">
                  {candle.volume}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
