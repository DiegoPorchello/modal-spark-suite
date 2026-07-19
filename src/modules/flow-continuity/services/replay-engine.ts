import type { DecisionContext } from "../types/decision-context.types";
import type { OperationContext } from "../types/operation-context.types";
import type {
  ReplayContext,
  ReplayTimelineEvent,
  ReplayTimelineStep,
} from "../types/replay-context.types";

let replayCounter = 0;

function generateReplayId(): string {
  replayCounter += 1;
  return `replay-${Date.now()}-${replayCounter}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildTimeline(
  decision: DecisionContext,
  operation: OperationContext,
): ReplayTimelineEvent[] {
  const events: ReplayTimelineEvent[] = [];
  let idx = 0;

  // 1. Market classified
  events.push({
    stepIndex: idx++,
    step: "market.classified" as ReplayTimelineStep,
    label: `Mercado classificado como ${decision.trend}`,
    timestamp: decision.timestamp,
    payload: {
      asset: decision.asset,
      timeframe: decision.timeframe,
      marketType: decision.marketType,
      trend: decision.trend,
      volatility: decision.volatility,
      bias: decision.bias,
    },
  });

  // 2. Strategy selected
  events.push({
    stepIndex: idx++,
    step: "strategy.selected" as ReplayTimelineStep,
    label: `Estratégia selecionada: ${decision.strategyName}`,
    timestamp: decision.timestamp + 1,
    payload: {
      strategyId: decision.strategyId,
      strategyName: decision.strategyName,
    },
  });

  // 3. Score calculated
  events.push({
    stepIndex: idx++,
    step: "score.calculated" as ReplayTimelineStep,
    label: `Score calculado: ${decision.finalScore} pts (mínimo: ${decision.minimumScore})`,
    timestamp: decision.timestamp + 2,
    payload: {
      finalScore: decision.finalScore,
      minimumScore: decision.minimumScore,
      passed: decision.finalScore >= decision.minimumScore,
    },
  });

  // 4. Filters approved
  if (decision.approvedFilters.length > 0) {
    events.push({
      stepIndex: idx++,
      step: "filters.approved" as ReplayTimelineStep,
      label: `${decision.approvedFilters.length} filtros aprovados: ${decision.approvedFilters.map((f) => f.name).join(", ")}`,
      timestamp: decision.timestamp + 3,
      payload: {
        approvedCount: decision.approvedFilters.length,
        rejectedCount: decision.rejectedFilters.length,
        pendingCount: decision.pendingFilters.length,
        filters: decision.approvedFilters.map((f) => ({
          name: f.name,
          contribution: f.contribution,
          approved: f.approved,
        })),
      },
    });
  }

  // 5. Decision made
  events.push({
    stepIndex: idx++,
    step: "decision.made" as ReplayTimelineStep,
    label: `Decisão: ${decision.decision} — ${decision.decisionReason}`,
    timestamp: decision.timestamp + 4,
    payload: {
      decision: decision.decision,
      decisionReason: decision.decisionReason,
      confidence: decision.confidence,
      executionTrigger: decision.executionTrigger,
    },
  });

  // 6. Order sent
  events.push({
    stepIndex: idx++,
    step: "order.sent" as ReplayTimelineStep,
    label: `Ordem enviada ao broker (${operation.broker})`,
    timestamp: operation.timestamp,
    payload: {
      broker: operation.broker,
      direction: operation.direction,
      amount: operation.amount,
      entryPrice: operation.entryPrice,
      expiration: operation.expiration,
      executionLatency: operation.executionLatency,
    },
  });

  // 7. Broker confirmed
  if (operation.brokerTradeId) {
    events.push({
      stepIndex: idx++,
      step: "broker.confirmed" as ReplayTimelineStep,
      label: `Broker confirmou execução em ${formatMs(operation.brokerResponseTime)}`,
      timestamp: operation.timestamp + operation.brokerResponseTime,
      payload: {
        brokerTradeId: operation.brokerTradeId,
        brokerResponseTime: operation.brokerResponseTime,
        executionTime: operation.executionTime,
      },
    });
  }

  // 8. Trade opened
  events.push({
    stepIndex: idx++,
    step: "trade.opened" as ReplayTimelineStep,
    label: `Operação aberta: ${operation.direction} @ ${operation.entryPrice}`,
    timestamp: operation.timestamp + operation.executionTime,
    payload: {
      direction: operation.direction,
      entryPrice: operation.entryPrice,
      payout: operation.payout,
      amount: operation.amount,
    },
  });

  // 9. Trade closed
  if (operation.status === "WIN" || operation.status === "LOSS" || operation.status === "DRAW") {
    const closeTimestamp = operation.timestamp + operation.executionTime + operation.expiration * 1000;
    const resultLabel =
      operation.status === "WIN"
        ? `WIN — Lucro: R$ ${operation.profit.toFixed(2)}`
        : operation.status === "LOSS"
          ? `LOSS — Prejuízo: R$ ${Math.abs(operation.profit).toFixed(2)}`
          : "DRAW — Empate";
    events.push({
      stepIndex: idx++,
      step: "trade.closed" as ReplayTimelineStep,
      label: `Operação encerrada: ${resultLabel}`,
      timestamp: closeTimestamp,
      payload: {
        status: operation.status,
        exitPrice: operation.exitPrice,
        profit: operation.profit,
      },
    });
  }

  return events;
}

/**
 * Pure utility — builds a ReplayContext from OperationContext + DecisionContext.
 *
 * Does NOT recalculate Score, Strategy, or Decision.
 * Only reconstructs the full story from stored contexts.
 *
 * Every explanation the AI produces MUST come from this object.
 */
export function buildReplayContext(
  operation: OperationContext,
  decision: DecisionContext,
): ReplayContext {
  const timeline = buildTimeline(decision, operation);

  const result =
    operation.status === "WIN"
      ? "WIN"
      : operation.status === "LOSS"
        ? "LOSS"
        : operation.status === "DRAW"
          ? "BREAKEVEN"
          : "TIMEOUT";

  const operationStartTime = decision.timestamp;
  const operationEndTime =
    operation.status !== "PENDING" && operation.status !== "OPEN"
      ? operation.timestamp + operation.executionTime + operation.expiration * 1000
      : Date.now();

  return {
    replayId: generateReplayId(),
    operationStartTime,
    operationEndTime,
    durationMs: Math.max(0, operationEndTime - operationStartTime),
    decisionContext: decision,
    operationContext: operation,
    timeline,
    timelineLength: timeline.length,
    executionSource: operation.executionSource,
    result,
    profit: operation.profit,
    createdAt: Date.now(),
  };
}

/**
 * Pure utility — generates a human-readable narrative from a ReplayContext.
 * Uses ONLY data from the context. Never invents information.
 */
export function buildReplayNarrative(ctx: ReplayContext): string {
  const d = ctx.decisionContext;
  const o = ctx.operationContext;
  const lines: string[] = [];

  const timeStr = new Date(d.timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  lines.push(
    `Às ${timeStr} o mercado foi classificado como ${d.trend}.`,
    `A estratégia selecionada foi ${d.strategyName}.`,
    `O ScoreEngine calculou ${d.finalScore} pontos.`,
    `A estratégia aprovou ${d.approvedFilters.length} filtros.`,
    `A decisão foi ${d.decision}.`,
    `A ordem foi enviada ao broker.`,
  );

  if (o.brokerResponseTime > 0) {
    lines.push(`O broker confirmou a execução em ${o.brokerResponseTime} ms.`);
  }

  if (ctx.result === "WIN") {
    lines.push(`Após ${Math.round(ctx.durationMs / 1000)} segundos a operação foi encerrada como WIN.`);
    lines.push(`Lucro obtido: R$ ${o.profit.toFixed(2)}.`);
  } else if (ctx.result === "LOSS") {
    lines.push(`Após ${Math.round(ctx.durationMs / 1000)} segundos a operação foi encerrada como LOSS.`);
    lines.push(`Prejuízo: R$ ${Math.abs(o.profit).toFixed(2)}.`);
  } else if (ctx.result === "BREAKEVEN") {
    lines.push(`A operação foi encerrada como empate.`);
  } else {
    lines.push(`A operação ainda está em aberto.`);
  }

  return lines.join("\n");
}
