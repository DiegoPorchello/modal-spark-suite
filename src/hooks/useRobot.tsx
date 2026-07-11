import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useBroker } from "./useBroker";
import { FlowRobotEngine } from "../engine/flow-robot-engine";
import type {
  RobotState,
  RobotConfig,
  RobotOperation,
  RobotEvent,
} from "../engine/flow-robot-engine";
import { DEFAULT_ROBOT_CONFIG } from "../engine/flow-robot-engine";

interface RobotContextValue {
  engine: FlowRobotEngine | null;
  state: RobotState;
  start: (config?: Partial<RobotConfig>) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  updateConfig: (config: Partial<RobotConfig>) => void;
  updateCalculatorLevels: (_niveis: number[]) => void;
  updateCalculatorPayout: (payout: number) => void;
}

function createDefaultState(): RobotState {
  return {
    status: "stopped",
    config: { ...DEFAULT_ROBOT_CONFIG },
    currentRecoveryStep: 0,
    currentEntry: 1,
    entryNumber: 1,
    currentBankroll: DEFAULT_ROBOT_CONFIG.initialBankroll,
    initialBankroll: DEFAULT_ROBOT_CONFIG.initialBankroll,
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
    sessionProfit: 0,
    operations: [],
    activeOperation: null,
    lastError: null,
    startedAt: null,
    nextOperationIn: 0,
    lastAnalysis: null,
    lastScannedAsset: null,
    scanLog: [],
    currentSession: "open",
    sessionInfo: null,
    nextTrade: null,
    selectedTimeframe: null,
    lastEntryPrecision: 0,
    avgEntryPrecision: 0,
    bestEntryPrecision: 0,
    worstEntryPrecision: 0,
    executionPhase: "idle",
    totalDraws: 0,
    healthCheck: null,
  };
}

const RobotContext = createContext<RobotContextValue>(null!);

export function RobotProvider({ children }: { children: ReactNode }) {
  const { adapter } = useBroker();
  const engineRef = useRef<FlowRobotEngine | null>(null);

  if (!engineRef.current) {
    const engine = new FlowRobotEngine(adapter);
    engineRef.current = engine;
  }

  const engine = engineRef.current;
  const [state, setState] = useState<RobotState>(engine.state);

  useEffect(() => {
    const unsub = engine.on((event: RobotEvent) => {
      setState({ ...event.state, operations: [...event.state.operations] });
    });
    return () => {
      unsub();
    };
  }, [engine]);

  useEffect(() => {
    engine.loadPersistedOps();
  }, [engine]);

  const start = useCallback((config?: Partial<RobotConfig>) => {
    engineRef.current?.start(config);
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.resume();
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const updateConfig = useCallback((config: Partial<RobotConfig>) => {
    engineRef.current?.updateConfig(config);
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const updateCalculatorLevels = useCallback((niveis: number[]) => {
    engineRef.current?.updateCalculatorLevels(niveis);
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  const updateCalculatorPayout = useCallback((payout: number) => {
    engineRef.current?.updateCalculatorPayout(payout);
    if (engineRef.current) setState(engineRef.current.state);
  }, []);

  return (
    <RobotContext.Provider
      value={{
        engine: engineRef.current,
        state,
        start,
        stop,
        pause,
        resume,
        reset,
        updateConfig,
        updateCalculatorLevels,
        updateCalculatorPayout,
      }}
    >
      {children}
    </RobotContext.Provider>
  );
}

export function useRobot(): RobotContextValue {
  const ctx = useContext(RobotContext);
  if (!ctx) throw new Error("useRobot must be used within a RobotProvider");
  return ctx;
}
