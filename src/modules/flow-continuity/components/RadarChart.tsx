"use client";

import React from "react";

export interface RadarData {
  labels: string[];
  values: number[];
  maxValue: number;
}

interface RadarChartProps {
  data: RadarData;
  height?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  height = 400,
}) => {
  const centerX = 150;
  const centerY = 150;
  const radius = 120;
  const sides = data.labels.length;
  const angleStep = (2 * Math.PI) / sides;

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / data.maxValue) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const polygonPoints = data.values
    .map((v, i) => {
      const p = getPoint(i, v);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <svg viewBox="0 0 300 300" className="w-full max-w-[300px]">
        {gridLevels.map((level) => {
          const gridPoints = Array.from({ length: sides }, (_, i) => {
            const p = getPoint(i, data.maxValue * level);
            return `${p.x},${p.y}`;
          }).join(" ");
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="currentColor"
              className="text-muted-foreground/20"
              strokeWidth="1"
            />
          );
        })}

        {data.labels.map((_, i) => {
          const p = getPoint(i, data.maxValue);
          return (
            <line
              key={i}
              x1={centerX}
              y1={centerY}
              x2={p.x}
              y2={p.y}
              stroke="currentColor"
              className="text-muted-foreground/20"
              strokeWidth="1"
            />
          );
        })}

        <polygon
          points={polygonPoints}
          fill="currentColor"
          className="text-primary/20 stroke-primary"
          stroke="currentColor"
          strokeWidth="2"
        />

        {data.values.map((v, i) => {
          const p = getPoint(i, v);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="currentColor"
              className="text-primary"
            />
          );
        })}

        {data.labels.map((label, i) => {
          const p = getPoint(i, data.maxValue + 25);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] fill-muted-foreground"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
