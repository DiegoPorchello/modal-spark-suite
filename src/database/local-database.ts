/**
 * database/local-database.ts
 * Implementação local/em-memória de DatabaseClient — útil para desenvolvimento.
 */

import type {
  DatabaseClient,
  OperationRecord,
  SessionRecord,
  PatternStatsRecord,
  OperationFilter,
  DashboardData,
} from "./types";

export class LocalDatabaseClient implements DatabaseClient {
  private operations: OperationRecord[] = [];
  private sessions: SessionRecord[] = [];
  private patternStats: PatternStatsRecord[] = [];

  async saveOperation(data: OperationRecord): Promise<void> {
    this.operations.push({
      ...data,
      id: data.id ?? `local_${Date.now()}_${this.operations.length}`,
    });
  }

  async saveSession(data: SessionRecord): Promise<void> {
    this.sessions.push({ ...data, id: data.id ?? `session_${Date.now()}` });
  }

  async updateSession(sessionId: string, data: Partial<SessionRecord>): Promise<void> {
    const idx = this.sessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) {
      this.sessions[idx] = { ...this.sessions[idx], ...data, updated_at: new Date().toISOString() };
    }
  }

  async savePatternStats(data: PatternStatsRecord): Promise<void> {
    this.patternStats.push(data);
  }

  async getOperations(filter?: OperationFilter): Promise<OperationRecord[]> {
    let result = [...this.operations];
    if (filter?.asset) result = result.filter((o) => o.asset === filter.asset);
    if (filter?.timeframe) result = result.filter((o) => o.timeframe === filter.timeframe);
    if (filter?.result) result = result.filter((o) => o.result === filter.result);
    result.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    if (filter?.limit) result = result.slice(0, filter.limit);
    if (filter?.offset) result = result.slice(filter.offset);
    return result;
  }

  async getDashboard(): Promise<DashboardData> {
    const wins = this.operations.filter((o) => o.result === "WIN").length;
    const losses = this.operations.filter((o) => o.result === "LOSS").length;
    const total = this.operations.length;

    return {
      totalTrades: total,
      wins,
      losses,
      winrate: total > 0 ? (wins / total) * 100 : 0,
      netProfit: this.operations.reduce((s, o) => s + (o.profit ?? 0), 0),
      bestAsset: "",
      bestTimeframe: "",
      bestHour: 0,
      balance: this.sessions[this.sessions.length - 1]?.current_balance ?? 0,
    };
  }
}
