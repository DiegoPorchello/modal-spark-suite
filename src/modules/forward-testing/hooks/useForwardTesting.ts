/**
 * useForwardTesting.ts
 * Hook principal do Forward Testing — conecta a UI ao engine e aos serviços.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { forwardTestingEngine } from "../engine/forward-testing-engine";
import { SessionService } from "../services/session.service";
import { OperationService } from "../services/operation.service";
import { DashboardService } from "../services/dashboard.service";
import { PatternStatsService } from "../services/pattern-stats.service";
import type {
  TestSession,
  Operation,
  CreateSessionInput,
  DailyReport,
  AssetRanking,
  DashboardSummary,
  PatternStats,
} from "../types";
import type { EngineState, EngineStatus } from "../engine/forward-testing-engine";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useForwardTesting() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [activeSession, setActiveSession] = useState<TestSession | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [engineState, setEngineState] = useState<EngineState>(forwardTestingEngine.getState());
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [assetRanking, setAssetRanking] = useState<AssetRanking[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [topPatterns, setTopPatterns] = useState<PatternStats[]>([]);
  const [dailyReportText, setDailyReportText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Registra callbacks do engine
  useEffect(() => {
    forwardTestingEngine.onCallbacks({
      onStatusChange: (status) => {
        setEngineState((prev) => ({ ...prev, status }));
      },
      onError: (err) => setError(err),
      onOperationResult: () => loadOperations(activeSession?.id ?? ""),
    });
  }, [activeSession?.id]);

  // Carrega dados iniciais
  useEffect(() => {
    loadSessions();
    loadDashboard();
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    };
  }, []);

  // Auto-refresh do dashboard a cada 10s
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval.current) clearInterval(refreshInterval.current);
    refreshInterval.current = setInterval(() => {
      loadDashboard();
      if (activeSession) loadOperations(activeSession.id);
    }, 10000);
  }, [activeSession]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await SessionService.list();
      setSessions(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadOperations = useCallback(async (sessionId: string) => {
    try {
      const data = await OperationService.listBySession(sessionId);
      setOperations(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [reports, ranking, summary] = await Promise.all([
        DashboardService.getDailyReports(),
        DashboardService.getAssetRanking(),
        DashboardService.getSummary(),
      ]);
      setDailyReports(reports);
      setAssetRanking(ranking);
      setDashboardSummary(summary);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }, []);

  const loadTopPatterns = useCallback(async () => {
    try {
      const data = await PatternStatsService.getTopPatterns();
      setTopPatterns(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    }
  }, []);

  // ── Ações ─────────────────────────────────────────────────────────────────

  const createSession = useCallback(
    async (input: CreateSessionInput) => {
      setLoading(true);
      setError(null);
      try {
        const session = await forwardTestingEngine.startSession(input);
        setActiveSession(session);
        setEngineState(forwardTestingEngine.getState());
        await loadSessions();
        startAutoRefresh();
        return session;
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadSessions, startAutoRefresh],
  );

  const selectSession = useCallback(
    async (session: TestSession) => {
      setActiveSession(session);
      setEngineState((prev) => ({ ...prev, session }));
      await loadOperations(session.id);
    },
    [loadOperations],
  );

  const stopSession = useCallback(async () => {
    setLoading(true);
    try {
      await forwardTestingEngine.stopSession();
      setEngineState(forwardTestingEngine.getState());
      setActiveSession(null);
      await loadSessions();
      if (refreshInterval.current) clearInterval(refreshInterval.current);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadSessions]);

  const generateDailyReport = useCallback(async () => {
    try {
      const text = await DashboardService.getDailyReportFile();
      setDailyReportText(text);
      return text;
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      return "";
    }
  }, []);

  return {
    sessions,
    activeSession,
    operations,
    engineState,
    dailyReports,
    assetRanking,
    dashboardSummary,
    topPatterns,
    dailyReportText,
    loading,
    error,
    createSession,
    selectSession,
    stopSession,
    loadOperations,
    loadDashboard,
    loadTopPatterns,
    generateDailyReport,
    setError,
  };
}
