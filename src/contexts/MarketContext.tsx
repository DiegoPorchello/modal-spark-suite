"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
export interface PriceTick {
  price: number;
  timestamp: number;
}

export interface MarketCharacteristics {
  // Core market identification
  marketType: "FOREX" | "CRYPTO" | "HYBRID" | "COMMODITIES";
  asset: string;
  timeframe: string;
  
  // Technical analysis
  trend: {
    direction: "up" | "down" | "sideways";
    strength: number; // 0-1
    lastUpdated: number;
    confidence: number; // 0-1
  };
  volatility: {
    value: number; // 0-1 (0 = low, 1 = high)
    lastUpdated: number;
    confidence: number;
  };
  liquidity: {
    depth: number; // 0-1 (depth of market)
    spread: number; // in pips
    lastUpdated: number;
    confidence: number;
  };
  momentum: {
    value: number; // 0-1 (current momentum)
    trend: "positive" | "negative" | "neutral";
    strength: number;
    lastUpdated: number;
    confidence: number;
  };
  structure: {
    supportLevels: PriceTick[];
    resistanceLevels: PriceTick[];
    trendLines: {
      type: "uptrend" | "downtrend" | "range";
      confidence: number;
    };
    lastUpdated: number;
    confidence: number;
  };
  
  // Composite indicators
  overallConfidence: number;
  analysisTimestamp: number;
  dataAge: number; // how old is the data in seconds
  
  // Historical context
  dailyChange: number;
  weeklyChange: number;
  
  // Market-specific factors
  session: "asian" | "european" | "american";
  correlation: Record<string, number>;
}

export interface MarketContextValue {
  current: MarketCharacteristics | null;
  update: (characteristics: Partial<MarketCharacteristics>) => void;
  isAnalyzing: boolean;
  lastUpdateTime: number;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export const MarketContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<MarketCharacteristics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  const update = (characteristics: Partial<MarketCharacteristics>) => {
    setCurrent(prev => {
      if (!prev) {
        return {
          marketType: characteristics.marketType || "FOREX",
          asset: characteristics.asset || "",
          timeframe: characteristics.timeframe || "M1",
          trend: {
            direction: "sideways",
            strength: 0,
            lastUpdated: Date.now(),
            confidence: 0,
            ...characteristics.trend
          },
          volatility: {
            value: 0,
            lastUpdated: Date.now(),
            confidence: 0,
            ...characteristics.volatility
          },
          liquidity: {
            depth: 0,
            spread: 0,
            lastUpdated: Date.now(),
            confidence: 0,
            ...characteristics.liquidity
          },
          momentum: {
            value: 0,
            trend: "neutral",
            strength: 0,
            lastUpdated: Date.now(),
            confidence: 0,
            ...characteristics.momentum
          },
          structure: {
            supportLevels: [],
            resistanceLevels: [],
            trendLines: {
              type: "range",
              confidence: 0,
            },
            lastUpdated: Date.now(),
            confidence: 0,
            ...characteristics.structure
          },
          overallConfidence: 0,
          analysisTimestamp: Date.now(),
          dataAge: 0,
          dailyChange: 0,
          weeklyChange: 0,
          session: "asian",
          correlation: {},
          ...characteristics,
        };
      }
      
      const updated: MarketCharacteristics = {
        ...prev,
        ...characteristics,
        trend: {
          ...prev.trend,
          ...characteristics.trend
        },
        volatility: {
          ...prev.volatility,
          ...characteristics.volatility
        },
        liquidity: {
          ...prev.liquidity,
          ...characteristics.liquidity
        },
        momentum: {
          ...prev.momentum,
          ...characteristics.momentum
        },
        structure: {
          ...prev.structure,
          ...characteristics.structure
        },
        analysisTimestamp: Date.now(),
        dataAge: characteristics.dataAge !== undefined ? characteristics.dataAge : prev.dataAge + 1,
        overallConfidence: characteristics.overallConfidence !== undefined ? characteristics.overallConfidence : prev.overallConfidence,
        correlation: {
          ...prev.correlation,
          ...characteristics.correlation
        },
      };
      
      return updated;
    });
    
    setLastUpdateTime(Date.now());
  };
  
  return (
    <MarketContext.Provider value={{ current, update, isAnalyzing, lastUpdateTime }}>
      {children}
    </MarketContext.Provider>
  );
};

export const useMarketContext = () => {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error("useMarketContext must be used within a MarketContextProvider");
  }
  return context;
};