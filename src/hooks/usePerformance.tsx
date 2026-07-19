import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useRobot } from "./useRobot";
import { buildPerformanceContext } from "../modules/performance/services/performance-engine";
import { performanceHistory } from "../modules/performance/services/performance-history";
import type { PerformanceContext } from "../modules/performance/types/performance-context.types";

interface PerformanceContextValue {
  performance: PerformanceContext | null;
  history: typeof performanceHistory;
}

const PerformanceReactContext = createContext<PerformanceContextValue>(null!);

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const { engine } = useRobot();
  const [performance, setPerformance] = useState<PerformanceContext | null>(null);

  useEffect(() => {
    if (!engine) return;

    const existing = engine.getLastPerformanceContext();
    if (existing) {
      setPerformance(existing);
    }

    const unsub = engine.on(() => {
      const ctx = engine.getLastPerformanceContext();
      if (ctx) {
        setPerformance(ctx);
      }
    });

    return () => unsub();
  }, [engine]);

  useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      const decisionHistory = engine.getDecisionHistory();
      const operationHistory = engine.getOperationHistory();
      const replayHistory = engine.getReplayHistory();
      if (replayHistory.length > 0) {
        const ctx = buildPerformanceContext(
          decisionHistory,
          operationHistory,
          replayHistory,
        );
        setPerformance(ctx);
        performanceHistory.record(ctx);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [engine]);

  return (
    <PerformanceReactContext.Provider
      value={{ performance, history: performanceHistory }}
    >
      {children}
    </PerformanceReactContext.Provider>
  );
}

export function usePerformance(): PerformanceContextValue {
  const ctx = useContext(PerformanceReactContext);
  if (!ctx) throw new Error("usePerformance must be used within a PerformanceProvider");
  return ctx;
}
