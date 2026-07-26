"use client";

import React from "react";

interface StructureAnalysisProps {
  data?: {
    trend: {
      value: number;
      status: "bullish" | "bearish" | "neutral";
    };
    momentum: {
      value: number;
      status: "strong" | "moderate" | "weak";
    };
    volume: {
      value: number;
      status: "high" | "normal" | "low";
    };
    volatility: {
      value: number;
      status: "high" | "medium" | "low";
    };
    liquidity: {
      value: number;
      status: "good" | "fair" | "poor";
    };
  };
  className?: string;
  animated?: boolean;
}

export const StructureAnalysis: React.FC<StructureAnalysisProps> = ({
  data,
  className = "",
  animated = false,
}) => {
  const defaultData = {
    trend: { value: 0.75, status: "bullish" as const },
    momentum: { value: 0.62, status: "strong" as const },
    volume: { value: 0.48, status: "high" as const },
    volatility: { value: 0.32, status: "medium" as const },
    liquidity: { value: 0.88, status: "good" as const },
  };

  const analysis = data || defaultData;

  const getTrendColor = (status: string) => {
    switch (status) {
      case "bullish": return "bg-success/20 text-success border-success/40";
      case "bearish": return "bg-danger/20 text-danger border-danger/40";
      default: return "bg-info/20 text-info border-info/40";
    }
  };

  const getTrendIcon = (status: string) => {
    switch (status) {
      case "bullish": return "📈";
      case "bearish": return "📉";
      default: return "➡️";
    }
  };

  const getMomentumColor = (status: string) => {
    switch (status) {
      case "strong": return "bg-success/20 text-success border-success/40";
      case "moderate": return "bg-warning/20 text-warning border-warning/40";
      default: return "bg-warning/20 text-warning border-warning/40";
    }
  };

  const getVolumeColor = (status: string) => {
    switch (status) {
      case "high": return "bg-primary/20 text-primary border-primary/40";
      case "normal": return "bg-info/20 text-info border-info/40";
      default: return "bg-info/20 text-info border-info/40";
    }
  };

  const getVolatilityColor = (status: string) => {
    switch (status) {
      case "high": return "bg-danger/20 text-danger border-danger/40";
      case "medium": return "bg-warning/20 text-warning border-warning/40";
      default: return "bg-success/20 text-success border-success/40";
    }
  };

  const getLiquidityColor = (status: string) => {
    switch (status) {
      case "good": return "bg-success/20 text-success border-success/40";
      case "fair": return "bg-warning/20 text-warning border-warning/40";
      default: return "bg-warning/20 text-warning border-warning/40";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "bullish": return "ALTA"; case "bearish": return "BAIXA"; default: return "NEUTRA";
    }
  };

  const getTrendBarWidth = (value: number) => `${Math.max(5, value * 100)}%`;

  const analysisItems = [
    {
      label: "Tendência",
      value: analysis.trend.value,
      status: analysis.trend.status,
      color: getTrendColor(analysis.trend.status),
      icon: getTrendIcon(analysis.trend.status),
      description: "Direção geral do mercado",
    },
    {
      label: "Momentum",
      value: analysis.momentum.value,
      status: analysis.momentum.status,
      color: getMomentumColor(analysis.momentum.status),
      description: "Força do movimento",
    },
    {
      label: "Volume",
      value: analysis.volume.value,
      status: analysis.volume.status,
      color: getVolumeColor(analysis.volume.status),
      description: "Atividade de negociação",
    },
    {
      label: "Volatilidade",
      value: analysis.volatility.value,
      status: analysis.volatility.status,
      color: getVolatilityColor(analysis.volatility.status),
      description: "Oscilação de preços",
    },
    {
      label: "Liquidez",
      value: analysis.liquidity.value,
      status: analysis.liquidity.status,
      color: getLiquidityColor(analysis.liquidity.status),
      description: "Profundidade do mercado",
    },
  ];

  return (
    <div className={`relative space-y-4 ${className}` }>
      <div className="panel p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="text-lg">🧠</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground">ANÁLISE ESTRUTURAL INTELIGENTE</h3>
            <p className="text-[10px] text-muted-foreground">Análise avançada de múltiplos fatores de mercado</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {analysisItems.map((item, index) => (
            <div
              key={index}
              className="relative group"
              style={{ animationDelay: animated ? `${index * 100}ms` : '0ms' }}
            >
              <div
                className={
                  "panel p-4 rounded-lg border transition-all duration-300 hover:scale-105 hover:shadow-lg " +
                  item.color +
                  " " +
                  (animated ? "animate-pulse-subtle" : "")
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-2xl">{item.icon}</div>
                  <div className="text-xs font-mono font-bold bg-current/10 px-2 py-1 rounded">
                    {(item.value * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold tracking-wider">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed">
                    {item.description}
                  </div>

                  <div className="w-full bg-muted/20 rounded-full h-1.5 mt-3">
                    <div
                      className="bg-current h-1.5 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: getTrendBarWidth(item.value) }}
                    />
                  </div>

                  <div className="text-[9px] font-mono font-bold text-center mt-2">
                    {getStatusLabel(item.status)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/10 rounded-lg border border-border">
          <div className="text-xs text-muted-foreground mb-2 font-semibold">INTERPRETAÇÃO ESTRUTURAL</div>
          <div className="text-xs text-foreground leading-relaxed">
            {analysis.trend.status === "bullish" && analysis.momentum.status === "strong" && (
              <span className="text-success font-semibold">📈 Mercado em forte tendência de alta com momentum significativo. Configure apostas CALL com controle de risco.</span>
            )}
            {analysis.trend.status === "bearish" && analysis.momentum.status === "strong" && (
              <span className="text-danger font-semibold">📉 Mercado em forte tendência de baixa com momentum significativo. Configure apostas PUT com controle de risco.</span>
            )}
            {analysis.trend.status === "neutral" && analysis.momentum.status === "moderate" && (
              <span className="text-warning font-semibold">⚠️ Mercado lateralizado com momentum moderado. Considere aguardar melhores oportunidades de sinal.</span>
            )}
            {!(analysis.trend.status === "bullish" && analysis.momentum.status === "strong") &&
              !(analysis.trend.status === "bearish" && analysis.momentum.status === "strong") &&
              !(analysis.trend.status === "neutral" && analysis.momentum.status === "moderate") && (
                <span className="text-info font-semibold">📊 Padrão misto detectado. Considere análise adicional antes de entrar em posições.</span>
              )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
      ` }} />
    </div>
  );
};