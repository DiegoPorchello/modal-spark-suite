/**
 * Learning Engine
 *
 * Orchestrates analysis of Market Memory data.
 * 100% observational — never modifies strategies.
 * Produces analytics, insights, and recommendations.
 */

import type { MarketMemoryRecord } from "@/modules/market-memory/types/memory-types";
import type {
  LearningAnalytics,
  LearningInsight,
  OptimizerRecommendation,
  LearningContext,
  LearningEvent,
} from "./types/learning-types";
import { LearningAnalyzer } from "./learning-analyzer";
import { StrategyOptimizer } from "./optimizer";

type LearningEventHandler = (event: LearningEvent) => void;

export class LearningEngine {
  private analyzer: LearningAnalyzer;
  private optimizer: StrategyOptimizer;
  private handlers: Set<LearningEventHandler> = new Set();
  private lastAnalytics: LearningAnalytics | null = null;
  private lastInsights: LearningInsight[] = [];
  private lastRecommendations: OptimizerRecommendation[] = [];

  constructor() {
    this.analyzer = new LearningAnalyzer();
    this.optimizer = new StrategyOptimizer();
  }

  subscribe(handler: LearningEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  private emit(event: LearningEvent): void {
    for (const h of this.handlers) {
      try { h(event); } catch { /* swallow */ }
    }
  }

  /**
   * Run full analysis on records.
   * Returns analytics, insights, and recommendations.
   */
  analyze(records: MarketMemoryRecord[]): {
    analytics: LearningAnalytics;
    insights: LearningInsight[];
    recommendations: OptimizerRecommendation[];
  } {
    const analytics = this.analyzer.analyze(records);
    const insights = this.analyzer.generateInsights(analytics);
    const recommendations = this.optimizer.optimize(analytics);

    this.lastAnalytics = analytics;
    this.lastInsights = insights;
    this.lastRecommendations = recommendations;

    this.emit({
      type: "learning.analysis.completed",
      timestamp: Date.now(),
      data: {
        totalOperations: analytics.totalOperations,
        winRate: analytics.overallWinRate,
        insightCount: insights.length,
        recommendationCount: recommendations.length,
      },
    });

    for (const insight of insights) {
      this.emit({
        type: "learning.insight.created",
        timestamp: Date.now(),
        data: { insightId: insight.id, title: insight.title, category: insight.category },
      });
    }

    for (const rec of recommendations) {
      this.emit({
        type: "optimizer.recommendation.created",
        timestamp: Date.now(),
        data: { recId: rec.id, title: rec.title, category: rec.category },
      });
    }

    return { analytics, insights, recommendations };
  }

  /**
   * Build LearningContext for Copilot and Advisor.
   */
  buildContext(records: MarketMemoryRecord[]): LearningContext {
    const { analytics, insights, recommendations } = this.analyze(records);

    return {
      analytics,
      insights,
      recommendations,
      topStrategy: analytics.strategyRanking[0] ?? null,
      topCore: analytics.coreRanking[0] ?? null,
      topSession: analytics.sessionRanking[0] ?? null,
      topIndicator: analytics.indicatorContributions[0] ?? null,
      topFilter: analytics.filterEffectiveness[0] ?? null,
    };
  }

  /**
   * Get last analytics without re-running.
   */
  getLastAnalytics(): LearningAnalytics | null {
    return this.lastAnalytics;
  }

  getLastInsights(): LearningInsight[] {
    return this.lastInsights;
  }

  getLastRecommendations(): OptimizerRecommendation[] {
    return this.lastRecommendations;
  }
}

/** Singleton */
let globalLearningEngine: LearningEngine | null = null;

export function getGlobalLearningEngine(): LearningEngine {
  if (!globalLearningEngine) {
    globalLearningEngine = new LearningEngine();
  }
  return globalLearningEngine;
}
