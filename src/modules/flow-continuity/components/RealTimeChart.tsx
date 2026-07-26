"use client";

import React, { useState, useEffect, useRef } from "react";
import { CandlestickChart, CandlestickData } from "./CandlestickChart";
import { AutoRefreshPanel } from "./AutoRefreshPanel";
import { RadarChart, RadarData } from "./RadarChart";
import { useRobot } from "../../../hooks/useRobot";

interface RealTimeChartProps {
  className?: string;
  height?: number;
  autoRefreshInterval?: number;
}

export const RealTimeChart: React.FC<RealTimeChartProps> = ({
  className = "",
  height = 400,
  autoRefreshInterval = 5000,
}) => {
  const { engine, state } = useRobot();
  const [candlestickData, setCandlestickData] = useState<CandlestickData[]>([]);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRealData = async () => {
    if (!engine?.state.lastScannedAsset) return;

    try {
      const asset = engine.state.lastScannedAsset;
      const timeframe = engine.state.selectedTimeframe || "M1";

      const marketDataService = engine as any;
      const marketModule = (window as any).marketDataService || marketDataService.broker?.marketDataService;

      if (marketModule?.getCandles) {
        const candles = await marketModule.getCandles(asset, timeframe, 50);
        if (candles && candles.length > 0) {
          const formattedCandles: CandlestickData[] = candles.slice(-20).map((candle: any) => ({
            time: new Date(candle.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: candle.volume || 0,
          }));
          setCandlestickData(formattedCandles);
        }
      }

      if (engine.state.lastAnalysis?.score) {
        const score = engine.state.lastAnalysis?.score;
        const radar: RadarData = {
          labels: ["Continuidade", "Dominância", "Força", "Estrutura", "Histórico"],
          values: [
            score.continuityScore || 0,
            score.dominanceScore || 0,
            score.strengthScore || 0,
            score.structureScore || 0,
            score.historyScore || 0,
          ],
          maxValue: 100,
        };
        setRadarData(radar);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching real data:", error);
    }
  };

  useEffect(() => {
    fetchRealData();

    if (isAutoRefresh && autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(fetchRealData, autoRefreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isAutoRefresh, autoRefreshInterval]);

  const getStatusColor = () => {
    switch (engine?.state.status) {
      case "running": return "bg-success/20 text-success border-success/40";
      case "paused": return "bg-warning/20 text-warning border-warning/40";
      case "stopped": return "bg-gray-500/20 text-gray-400 border-gray-500/40";
      default: return "bg-info/20 text-info border-info/40";
    }
  };

  const getStatusLabel = () => {
    switch (engine?.state.status) {
      case "running": return "ROBO EM ANDAMENTO";
      case "paused": return "ROBO PAUSADO";
      case "stopped": return "ROBO PARADO";
      default: return "INDISPONÍVEL";
    }
  };

  return (
    <div className={`relative space-y-4 ${className}`}>
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-wide text-foreground">GRÁFICO - VELOCIDADE DO MERCADO</h3>
              <p className="text-[10px] text-muted-foreground">Visualização em tempo real dos preços e análise técnica</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AutoRefreshPanel
              isAutoRefresh={isAutoRefresh}
              onToggle={setIsAutoRefresh}
              lastUpdate={lastUpdate}
              interval={autoRefreshInterval}
            />

            <div
              className={`px-3 py-1 rounded-full text-[10px] font-semibold border ${getStatusColor()} flex items-center gap-1.5`}
            >
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              {getStatusLabel()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-[10px] tracking-widest text-muted-foreground mb-3 uppercase">
              Velas Candlestick {engine?.state.lastScannedAsset && `(${engine.state.lastScannedAsset})`}
            </h4>
            <CandlestickChart data={candlestickData} height={height} />
          </div>

          <div>
            <h4 className="text-[10px] tracking-widest text-muted-foreground mb-3 uppercase">Radar de Análise</h4>
            {radarData && <RadarChart data={radarData} height={height} />}
            {!radarData && (
              <div className="h-full flex items-center justify-center text-muted-foreground border border-border rounded">
                <div className="text-center">
                  <div className="text-lg mb-2">🔍</div>
                  <div className="text-xs">Aguardando dados de análise...</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};