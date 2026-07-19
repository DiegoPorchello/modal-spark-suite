"use client";

import React from "react";

interface ScoreMeterProps {
  score: number; // 0-100
  classification?: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "POOR" | "CRITICAL";
  label?: string;
  animated?: boolean;
  size?: "small" | "medium" | "large";
}

export const ScoreMeter: React.FC<ScoreMeterProps> = ({
  score = 0,
  classification = score >= 90
    ? "EXCELLENT"
    : score >= 80
      ? "GOOD"
      : score >= 70
        ? "FAIR"
        : score >= 60
          ? "POOR"
          : "CRITICAL",
  label = "SCORE FINAL",
  animated = false,
  size = "medium",
}) => {
  const sizeClasses = {
    small: { container: "w-32 h-32", text: "text-lg", label: "text-xs" },
    medium: { container: "w-48 h-48", text: "text-xl", label: "text-xs" },
    large: { container: "w-64 h-64", text: "text-2xl", label: "text-sm" },
  };

  const getColorClass = (score: number): string => {
    if (score >= 90) return "bg-green-500/20 border-green-500/40 text-green-400";
    if (score >= 80) return "bg-emerald-500/20 border-emerald-500/40 text-emerald-400";
    if (score >= 70) return "bg-yellow-500/20 border-yellow-500/40 text-yellow-400";
    if (score >= 60) return "bg-orange-500/20 border-orange-500/40 text-orange-400";
    return "bg-red-500/20 border-red-500/40 text-red-400";
  };

  const getBorderColorClass = (score: number): string => {
    if (score >= 90) return "stroke-green-500";
    if (score >= 80) return "stroke-emerald-500";
    if (score >= 70) return "stroke-yellow-500";
    if (score >= 60) return "stroke-orange-500";
    return "stroke-red-500";
  };

  const radius = sizeClasses[size].container.includes("w-64") ? 32 : sizeClasses[size].container.includes("w-48") ? 24 : 16;
  const strokeWidth = sizeClasses[size].container.includes("w-64") ? 4 : sizeClasses[size].container.includes("w-48") ? 3 : 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getStatusIcon = () => {
    if (score >= 90) return "✅";
    if (score >= 80) return "🟢";
    if (score >= 70) return "🟡";
    if (score >= 60) return "🟠";
    return "🔴";
  };

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={radius * 2 + strokeWidth * 2} height={radius * 2 + strokeWidth * 2} className="transform -rotate-90">
        <circle cx={radius + strokeWidth} cy={radius + strokeWidth} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="none" className="text-muted-foreground/20" />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${getBorderColorClass(percentage)} transition-all duration-1000 ease-in-out ${animated ? "animate-pulse" : ""}`}
          style={{ animation: animated ? "dashOffsetAnim 1s ease-in-out forwards" : "none" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={sizeClasses[size].text + " font-bold font-mono " + getColorClass(percentage)}>
          {Math.round(percentage)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 font-semibold tracking-wider uppercase">
          {label}
        </div>
      </div>

      <div className="mt-3 text-center">
        <div
          className={
            "px-2 py-1 rounded text-[10px] font-bold tracking-wider border " +
            getColorClass(percentage)
          }
        >
          {classification}
        </div>
        <div className="text-2xl mt-1">{getStatusIcon()}</div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dashOffsetAnim {
          from { stroke-dashoffset: ${circumference} }
          to { stroke-dashoffset: ${circumference - (percentage / 100) * circumference} }
        }
      ` }} />
    </div>
  );
};