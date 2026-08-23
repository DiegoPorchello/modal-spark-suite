import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useBroker } from "./useBroker";
import { FlowRobotEngine } from "../engine/flow-robot-engine";
import type {
  RobotState,
  RobotConfig,
  RobotOperation,
  RobotEvent,
} from "../engine/flow-robot-engine";
import type { Candle } from "../market/types";
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
  subscribeCandleClose: (onCandleClose: (candle: Candle) => void) => () => void;
  subscribeCandleUpdate: (onCandleUpdate: (candle: Candle) => void) => () => void;
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
    lastAnalysesByAsset: {},
  };
}

const RobotContext = createContext<RobotContextValue>(null!);

export function RobotProvider({ children }: { children: ReactNode }) {
  const { adapter } = useBroker();
  const engineRef = useRef<FlowRobotEngine | null>(null);
  const [engine, setEngine] = useState<FlowRobotEngine | null>(null);
  const [state, setState] = useState<RobotState>(createDefaultState());

  useEffect(() => {
    if (adapter && !engineRef.current) {
      engineRef.current = new FlowRobotEngine(adapter);
      setEngine(engineRef.current);
      const ts = new Date().toLocaleTimeString("pt-BR");
      console.log(`[useRobot] ${ts} 🏗️ Engine criado — config.asset: ${engineRef.current.state.config.asset}, marketMode: ${engineRef.current.state.config.marketMode}`);
      setState(engineRef.current.state);

      // Listening for the "operation-opened" event from the engine
      const unsub = engineRef.current.on((event) => {
        if (event.operation) {
          const op = event.operation;
          setState((prev) => {
            const exists = prev.operations.some((item) => item.orderId === op.orderId);
            if (exists) return prev;

            return {
              ...prev,
              activeOperation: op,
              status: "waiting-result",
              operations: [op, ...prev.operations],
            };
          });
        }
      });

      return () => unsub();
    }
  }, [adapter]);

  useEffect(() => {
    if (!engine) return;
    const unsub = engine.on((event: RobotEvent) => {
      const ts = new Date().toLocaleTimeString("pt-BR");
      const cfg = event.state.config;
      console.log(`[useRobot] ${ts} 🔧 State update — asset: ${cfg?.asset}, marketMode: ${cfg?.marketMode}`);
      setState({ ...event.state, operations: [...event.state.operations] });
    });
    return () => {
      unsub();
    };
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
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

  const subscribeCandleClose = useCallback((onCandleClose: (candle: Candle) => void) => {
    return engineRef.current?.subscribeCandleClose(onCandleClose) ?? (() => {});
  }, []);

  const subscribeCandleUpdate = useCallback((onCandleUpdate: (candle: Candle) => void) => {
    return engineRef.current?.subscribeCandleUpdate(onCandleUpdate) ?? (() => {});
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
        subscribeCandleClose,
        subscribeCandleUpdate,
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
