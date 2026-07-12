import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AnalystEventType,
  AnalystMessage,
  AnalystMode,
  AnalystAIState,
  AnalystReasoningItem,
  AnalystNextAction,
  AnalystStats,
  MarketInfo,
  CandleReading,
  DiaryEntry,
  AnalystMessageLevel,
  DiagnosticState,
  DiagnosticStep,
  DiagnosticStatus,
  ScoreBreakdownDisplay,
  ScoreEvolutionEntry,
  ScoreFilterDisplay,
  ScoreBand,
  ScanLogEntry,
} from "./AnalystTypes";
import { resolveAnalystMessage } from "./AnalystEvents";
import { DEFAULT_DIAGNOSTIC } from "./AnalystTypes";

let _idCounter = 0;
function nextId(): string {
  return `a-${Date.now()}-${++_idCounter}`;
}

export interface AnalystStore {
  messages: AnalystMessage[];
  currentStatus: AnalystAIState;
  mode: AnalystMode;
  isOpen: boolean;
  reasoning: AnalystReasoningItem[];
  nextAction: AnalystNextAction | null;
  confidence: number;
  score: number;
  stats: AnalystStats;
  lastExplanation: string;
  market: MarketInfo;
  candleReading: CandleReading;
  diary: DiaryEntry[];
  diagnostic: DiagnosticState;
  // ── Score Engine ──
  scoreBreakdown: ScoreBreakdownDisplay | null;
  scoreEvolution: ScoreEvolutionEntry[];
  // ── Scan Log ──
  scanLog: ScanLogEntry[];
  setScanLog: (entries: ScanLogEntry[]) => void;
  addMessage: (type: AnalystEventType, meta?: Record<string, unknown>) => void;
  setStatus: (status: AnalystAIState) => void;
  setMode: (mode: AnalystMode) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setConfidence: (value: number) => void;
  setScore: (value: number) => void;
  setNextAction: (action: AnalystNextAction | null) => void;
  setReasoning: (items: AnalystReasoningItem[]) => void;
  addReasoning: (text: string, checked: boolean) => void;
  clearReasoning: () => void;
  updateStats: (partial: Partial<AnalystStats>) => void;
  setLastExplanation: (text: string) => void;
  updateMarket: (partial: Partial<MarketInfo>) => void;
  updateCandleReading: (partial: Partial<CandleReading>) => void;
  addDiaryEntry: (text: string, icon: string, level?: AnalystMessageLevel) => void;
  clearDiary: () => void;
  updateDiagnostic: (step: DiagnosticStep, status: DiagnosticStatus, message: string) => void;
  setScoreBreakdown: (breakdown: ScoreBreakdownDisplay) => void;
  clear: () => void;
  getFilteredMessages: () => AnalystMessage[];
}

const MAX_MESSAGES = 200;
const MAX_DIARY = 200;
const MAX_SCORE_EVOLUTION = 50;

const DEFAULT_STATS: AnalystStats = {
  patternsAnalyzed: 0,
  entries: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  bestPattern: "—",
  worstPattern: "—",
};

const DEFAULT_MARKET: MarketInfo = {
  asset: "—",
  timeframe: "—",
  trend: null,
  volatility: "media",
  strength: 0,
  score: 0,
  confidence: 0,
};

const DEFAULT_CANDLE: CandleReading = {
  isGreen: null,
  bodyPercent: 0,
  wickTopPercent: 0,
  wickBottomPercent: 0,
  dominance: "neutra",
  pressure: "baixa",
  volumeAboveAverage: false,
  colorLabel: "Aguardando",
  icon: "⏳",
  progress: 0,
  phase: "idle",
};

export function useAnalystStore(): AnalystStore {
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AnalystAIState>("idle");
  const [mode, setModeState] = useState<AnalystMode>("compact");
  const [isOpen, setIsOpen] = useState(false);
  const [reasoning, setReasoningState] = useState<AnalystReasoningItem[]>([]);
  const [nextAction, setNextActionState] = useState<AnalystNextAction | null>(null);
  const [confidence, setConfidenceState] = useState(0);
  const [score, setScoreState] = useState(0);
  const [stats, setStats] = useState<AnalystStats>(DEFAULT_STATS);
  const [lastExplanation, setLastExplanationState] = useState("");
  const [market, setMarket] = useState<MarketInfo>(DEFAULT_MARKET);
  const [candleReading, setCandleReading] = useState<CandleReading>(DEFAULT_CANDLE);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>(DEFAULT_DIAGNOSTIC);
  const [scoreBreakdown, setScoreBreakdownState] = useState<ScoreBreakdownDisplay | null>(null);
  const [scoreEvolution, setScoreEvolution] = useState<ScoreEvolutionEntry[]>([]);
  const [scanLog, setScanLogState] = useState<ScanLogEntry[]>([]);
  const messagesRef = useRef<AnalystMessage[]>([]);
  const reasoningRef = useRef<AnalystReasoningItem[]>([]);
  const diaryRef = useRef<DiaryEntry[]>([]);

  const addMessage = useCallback((type: AnalystEventType, meta?: Record<string, unknown>) => {
    const resolved = resolveAnalystMessage(type, meta);
    const msg: AnalystMessage = {
      id: nextId(),
      type,
      level: resolved.level,
      text: resolved.text,
      timestamp: new Date(),
      meta,
    };
    messagesRef.current = [msg, ...messagesRef.current].slice(0, MAX_MESSAGES);
    setMessages([...messagesRef.current]);
  }, []);

  const setStatus = useCallback((status: AnalystAIState) => {
    setCurrentStatus(status);
  }, []);

  const setMode = useCallback((mode: AnalystMode) => {
    setModeState(mode);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const setOpenFn = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const setConfidence = useCallback((value: number) => {
    setConfidenceState(Math.min(100, Math.max(0, value)));
  }, []);

  const setScore = useCallback((value: number) => {
    setScoreState(Math.min(100, Math.max(0, value)));
  }, []);

  const setNextAction = useCallback((action: AnalystNextAction | null) => {
    setNextActionState(action);
  }, []);

  const setReasoning = useCallback((items: AnalystReasoningItem[]) => {
    reasoningRef.current = items;
    setReasoningState([...items]);
  }, []);

  const addReasoning = useCallback((text: string, checked: boolean) => {
    const item: AnalystReasoningItem = {
      id: nextId(),
      text,
      checked,
      timestamp: new Date(),
    };
    reasoningRef.current = [item, ...reasoningRef.current].slice(0, 20);
    setReasoningState([...reasoningRef.current]);
  }, []);

  const clearReasoning = useCallback(() => {
    reasoningRef.current = [];
    setReasoningState([]);
  }, []);

  const setScanLog = useCallback((entries: ScanLogEntry[]) => {
    setScanLogState([...entries]);
  }, []);

  const updateStats = useCallback((partial: Partial<AnalystStats>) => {
    setStats((prev) => {
      const next = { ...prev, ...partial };
      if (next.entries > 0) {
        next.winRate = Math.round((next.wins / next.entries) * 100);
      }
      return next;
    });
  }, []);

  const setLastExplanation = useCallback((text: string) => {
    setLastExplanationState(text);
  }, []);

  const updateMarket = useCallback((partial: Partial<MarketInfo>) => {
    setMarket((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateCandleReading = useCallback((partial: Partial<CandleReading>) => {
    setCandleReading((prev) => ({ ...prev, ...partial }));
  }, []);

  const addDiaryEntry = useCallback(
    (text: string, icon: string, level: AnalystMessageLevel = "info") => {
      const entry: DiaryEntry = {
        id: nextId(),
        timestamp: new Date(),
        text,
        icon,
        level,
      };
      diaryRef.current = [entry, ...diaryRef.current].slice(0, MAX_DIARY);
      setDiary([...diaryRef.current]);
    },
    [],
  );

  const clearDiary = useCallback(() => {
    diaryRef.current = [];
    setDiary([]);
  }, []);

  const updateDiagnostic = useCallback(
    (step: DiagnosticStep, status: DiagnosticStatus, message: string) => {
      setDiagnostic((prev) => ({
        ...prev,
        [step]: { status, message, timestamp: Date.now() },
      }));
    },
    [],
  );

  const setScoreBreakdown = useCallback((breakdown: ScoreBreakdownDisplay) => {
    setScoreBreakdownState(breakdown);
    setScoreState(Math.min(100, Math.max(0, breakdown.total)));
    setScoreEvolution((prev) => {
      const entry: ScoreEvolutionEntry = {
        timestamp: new Date(),
        score: breakdown.total,
        band: breakdown.band,
      };
      return [entry, ...prev].slice(0, MAX_SCORE_EVOLUTION);
    });
  }, []);

  const clear = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    reasoningRef.current = [];
    setReasoningState([]);
    setNextActionState(null);
    setConfidenceState(0);
    setScoreState(0);
    setLastExplanationState("");
    setMarket(DEFAULT_MARKET);
    setCandleReading(DEFAULT_CANDLE);
    diaryRef.current = [];
    setDiary([]);
    setDiagnostic(DEFAULT_DIAGNOSTIC);
    setScoreBreakdownState(null);
    setScoreEvolution([]);
  }, []);

  const getFilteredMessages = useCallback(() => {
    if (mode === "developer") return messages;
    return messages.filter((m) => {
      const def = resolveAnalystMessage(m.type);
      if (mode === "compact") return def.mode === "compact";
      if (mode === "explanatory") return def.mode === "compact" || def.mode === "explanatory";
      return true;
    });
  }, [messages, mode]);

  return useMemo(
    () => ({
      messages,
      currentStatus,
      mode,
      isOpen,
      reasoning,
      nextAction,
      confidence,
      score,
      stats,
      lastExplanation,
      market,
      candleReading,
      diary,
      diagnostic,
      scoreBreakdown,
      scoreEvolution,
      scanLog,
      setScanLog,
      addMessage,
      setStatus,
      setMode,
      toggleOpen,
      setOpen: setOpenFn,
      setConfidence,
      setScore,
      setNextAction,
      setReasoning,
      addReasoning,
      clearReasoning,
      updateStats,
      setLastExplanation,
      updateMarket,
      updateCandleReading,
      addDiaryEntry,
      clearDiary,
      updateDiagnostic,
      setScoreBreakdown,
      clear,
      getFilteredMessages,
    }),
    [
      messages,
      currentStatus,
      mode,
      isOpen,
      reasoning,
      nextAction,
      confidence,
      score,
      stats,
      lastExplanation,
      market,
      candleReading,
      diary,
      diagnostic,
      scoreBreakdown,
      scoreEvolution,
      scanLog,
    ],
  );
}
