import type { AnalystEventType, AnalystMessageLevel } from "./AnalystTypes";

interface AnalystEventDef {
  level: AnalystMessageLevel;
  mode: "compact" | "explanatory" | "developer";
  text: string | ((meta?: Record<string, unknown>) => string);
  icon: string;
}

const CALL_PHRASES = [
  "Mercado continua saudável. Continuidade preservada.",
  "Compradores mantêm controle.",
  "Boa configuração encontrada. Entrada CALL preparada.",
  "Padrão comprador confirmado. Executando.",
  "Continuidade de alta válida. Entrando.",
  "Volume comprador sustentado.",
  "Corpo forte sem rejeição. CALL executado.",
  "Nova oportunidade surgindo. CALL preparado.",
];

const PUT_PHRASES = [
  "Vendedores perderam força. PUT executado.",
  "Padrão vendedor confirmado. Entrando.",
  "Continuidade de baixa válida. Executando PUT.",
  "Corpo vendedor sem rejeição. Entrada PUT.",
  "Volume vendedor sustentado. PUT preparado.",
  "Momentum de baixa preservado. Entrando.",
  "Nova oportunidade de baixa. PUT confirmado.",
  "Vendedores mantêm controle. Executando.",
];

const LOSS_PHRASES = [
  "Operação perdida. Aceitando o loss.",
  "LOSS registrado. Padrão quebrado. Resetando leitura.",
  "Resultado negativo. Quebra de continuidade. Aguardando novo padrão.",
  "Perda registrada. Reiniciando sequência.",
  "Loss confirmado. Nova leitura iniciada.",
];

const WIN_PHRASES = [
  "WIN confirmado! Lucro registrado. Mantendo leitura.",
  "Operação vencedora! Continuidade preservada. Próxima vela aguardada.",
  "Lucro obtido. Padrão intacto. Aguardando continuação.",
  "Sucesso! Sequência mantida. Próxima entrada preparada.",
  "Vitória! Vela vencedora conta como 1ª do próximo padrão.",
];

const NO_SIGNAL_PHRASES = [
  "Nenhum padrão confirmado. Aguardando próxima vela.",
  "Mercado desacelerando. Aguardando confirmação.",
  "Padrão incompleto. Continuando leitura.",
  "Sem sinal válido. Próxima vela pode confirmar.",
  "Aguardando continuidade de cor.",
];

const OBSERVING_PHRASES = [
  "Observando mercado. Aguardando padrão de 2 candles.",
  "Leitura ativa. Monitorando fechamento de velas.",
  "Scanner operacional. Procurando continuidade.",
  "Mercado emmonitoramento. Aguardando confirmação.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const ANALYST_EVENT_MAP: Record<AnalystEventType, AnalystEventDef> = {
  "scanner.started": {
    level: "info",
    mode: "developer",
    text: "Scanner de mercado iniciado.",
    icon: "🔍",
  },
  "scanner.completed": {
    level: "info",
    mode: "developer",
    text: "Scanner concluído.",
    icon: "✅",
  },
  "candle.new": {
    level: "info",
    mode: "compact",
    text: "Nova vela identificada.",
    icon: "🕯️",
  },
  "candle.closed": {
    level: "info",
    mode: "compact",
    text: (m) =>
      `Vela fechou ${m?.direction === "green" ? "comprador (verde)" : m?.direction === "red" ? "vendedor (vermelha)" : ""}.`,
    icon: "🕯️",
  },
  "candle.green": {
    level: "success",
    mode: "compact",
    text: "Candle fechou comprador (verde).",
    icon: "🟢",
  },
  "candle.red": {
    level: "warning",
    mode: "compact",
    text: "Candle fechou vendedor (vermelha).",
    icon: "🔴",
  },
  "candle.reading": {
    level: "info",
    mode: "compact",
    text: (m) => {
      const phase = String(m?.phase || "");
      const pct = Number(m?.progress || 0);
      if (pct <= 10) return "Nova vela nasceu. Primeiros 10% — lendo estrutura.";
      if (pct <= 25) return "25% — analisando corpo e pavios.";
      if (pct <= 50) return "50% — avaliando força e dominância.";
      if (pct <= 80) return "80% — confirmando padrão.";
      return "Vela confirmada. Leitura completa.";
    },
    icon: "📊",
  },
  "candle.reading.progress": {
    level: "info",
    mode: "developer",
    text: (m) =>
      `Progresso da vela: ${String(m?.progress || 0)}% — ${String(m?.phase || "analisando")}.`,
    icon: "📊",
  },
  "pattern.detected": {
    level: "info",
    mode: "explanatory",
    text: (m) => `Padrão detectado: ${String(m?.pattern || "desconhecido")}.`,
    icon: "📊",
  },
  "pattern.2greens": {
    level: "success",
    mode: "compact",
    text: () => pick(CALL_PHRASES),
    icon: "🟢",
  },
  "pattern.2reds": {
    level: "warning",
    mode: "compact",
    text: () => pick(PUT_PHRASES),
    icon: "🔴",
  },
  "pattern.doji": {
    level: "info",
    mode: "explanatory",
    text: "Padrão Doji identificado. Indecisão no mercado.",
    icon: "❓",
  },
  "pattern.insidebar": {
    level: "info",
    mode: "explanatory",
    text: "Inside Bar detectado. Aguardando ruptura.",
    icon: "📦",
  },
  "pattern.broken": {
    level: "warning",
    mode: "compact",
    text: () => pick(LOSS_PHRASES),
    icon: "💔",
  },
  "catalog.search": {
    level: "info",
    mode: "compact",
    text: "Consultando banco histórico.",
    icon: "📚",
  },
  "catalog.result": {
    level: "info",
    mode: "compact",
    text: (m) => `Foram encontradas ${String(m?.count || 0)} ocorrências.`,
    icon: "📚",
  },
  "score.calculated": {
    level: "info",
    mode: "compact",
    text: (m) => `Score calculado: ${String(m?.score || 0)} de 100.`,
    icon: "🎯",
  },
  "score.breakdown": {
    level: "info",
    mode: "explanatory",
    text: (m) => {
      const total = Number(m?.total || 0);
      const band = String(m?.bandLabel || "");
      const strategy = String(m?.strategy || "");
      return `Score Engine: ${total}/100 (${band}) — Estratégia: ${strategy}`;
    },
    icon: "📊",
  },
  "trade.call": {
    level: "success",
    mode: "compact",
    text: (m) => String(m?.phrase || pick(CALL_PHRASES)),
    icon: "📈",
  },
  "trade.put": {
    level: "success",
    mode: "compact",
    text: (m) => String(m?.phrase || pick(PUT_PHRASES)),
    icon: "📉",
  },
  "trade.executed": {
    level: "info",
    mode: "explanatory",
    text: (m) => `Ordem enviada. ID: ${String(m?.orderId || "N/A")}. Aguardando resultado.`,
    icon: "📤",
  },
  "trade.win": {
    level: "success",
    mode: "compact",
    text: (m) => {
      const profit = Number(m?.profit || 0);
      return `${pick(WIN_PHRASES)} Lucro: +R$ ${profit.toFixed(2)}.`;
    },
    icon: "💰",
  },
  "trade.loss": {
    level: "error",
    mode: "compact",
    text: () => pick(LOSS_PHRASES),
    icon: "❌",
  },
  "trade.draw": {
    level: "warning",
    mode: "compact",
    text: "Operação empatada. Valor retornado.",
    icon: "➖",
  },
  "recovery.started": {
    level: "warning",
    mode: "compact",
    text: (m) => `Smart Recovery ativado. Nível ${String(m?.step || 1)}.`,
    icon: "🔄",
  },
  "recovery.step": {
    level: "info",
    mode: "explanatory",
    text: (m) =>
      `Recuperação nível ${String(m?.step || 1)}. Entrada: R$ ${Number(m?.amount || 0).toFixed(2)}. Aguardando padrão.`,
    icon: "🔄",
  },
  "recovery.finished": {
    level: "success",
    mode: "compact",
    text: "Recovery concluído. Fluxo reiniciado.",
    icon: "✅",
  },
  "recovery.reset": {
    level: "success",
    mode: "compact",
    text: "FSM resetado. Voltando ao Nível 0.",
    icon: "🔄",
  },
  "risk.profit-target": {
    level: "success",
    mode: "compact",
    text: "Meta de lucro atingida! Robô pausado.",
    icon: "🎯",
  },
  "risk.stop-loss": {
    level: "error",
    mode: "compact",
    text: "Stop Loss atingido. Robô pausado.",
    icon: "🛑",
  },
  "risk.insufficient-balance": {
    level: "error",
    mode: "compact",
    text: "Saldo insuficiente para operar.",
    icon: "💸",
  },
  "risk.ai-pause": {
    level: "warning",
    mode: "compact",
    text: "IA pausando operações para proteção.",
    icon: "⏸️",
  },
  "risk.demo-limit": {
    level: "error",
    mode: "compact",
    text: (meta) =>
      `Limite diário da conta demo atingido (${meta?.tradesToday ?? "?"}/${meta?.limit ?? "?"})`,
    icon: "⛔",
  },
  "risk.demo-limit-warning": {
    level: "warning",
    mode: "compact",
    text: (meta) =>
      `Restam ${meta?.remaining ?? "?"} trades do limite diário da conta demo (${meta?.tradesToday ?? "?"}/${meta?.limit ?? "?"})`,
    icon: "⚠️",
  },
  "analysis.started": {
    level: "info",
    mode: "explanatory",
    text: () => pick(OBSERVING_PHRASES),
    icon: "🔍",
  },
  "analysis.completed": {
    level: "info",
    mode: "explanatory",
    text: "Análise concluída.",
    icon: "✅",
  },
  "analysis.no-signal": {
    level: "info",
    mode: "explanatory",
    text: () => pick(NO_SIGNAL_PHRASES),
    icon: "⏳",
  },
  "analysis.reasoning": {
    level: "info",
    mode: "explanatory",
    text: (m) => String(m?.text || "Processando raciocínio..."),
    icon: "🧠",
  },
  "analysis.decision": {
    level: "info",
    mode: "explanatory",
    text: (m) => String(m?.text || "Decisão tomada."),
    icon: "⚖️",
  },
  "trend.detected": {
    level: "info",
    mode: "developer",
    text: (m) => `Tendência ${String(m?.trend || "neutra")} detectada.`,
    icon: "📈",
  },
  "support.detected": {
    level: "info",
    mode: "developer",
    text: (m) => `Nível de suporte em ${Number(m?.price || 0).toFixed(2)}.`,
    icon: "📐",
  },
  "resistance.detected": {
    level: "info",
    mode: "developer",
    text: (m) => `Nível de resistência em ${Number(m?.price || 0).toFixed(2)}.`,
    icon: "📐",
  },
  "lateralization.detected": {
    level: "info",
    mode: "developer",
    text: "Mercado lateralizado. Sem tendência clara.",
    icon: "↔️",
  },
  "continuity.detected": {
    level: "info",
    mode: "developer",
    text: (m) => `Continuidade detectada: ${Number(m?.strength || 0).toFixed(0)}%.`,
    icon: "🔗",
  },
  "dominance.detected": {
    level: "info",
    mode: "developer",
    text: (m) => `Dominância: ${Number(m?.dominance || 0).toFixed(0)}% compradores.`,
    icon: "⚖️",
  },
  "filter.passed": {
    level: "success",
    mode: "developer",
    text: (m) => `Filtro "${String(m?.name || "N/A")}" aprovado.`,
    icon: "✅",
  },
  "filter.failed": {
    level: "warning",
    mode: "developer",
    text: (m) => `Filtro "${String(m?.name || "N/A")}" reprovado.`,
    icon: "❌",
  },
  "order.sent": {
    level: "info",
    mode: "explanatory",
    text: "Ordem enviada ao broker.",
    icon: "📤",
  },
  "order.confirmed": {
    level: "success",
    mode: "explanatory",
    text: "Ordem confirmada pelo broker.",
    icon: "✅",
  },
  "order.error": {
    level: "error",
    mode: "compact",
    text: (m) => `Erro na ordem: ${String(m?.error || "desconhecido")}.`,
    icon: "❌",
  },
  "robot.started": {
    level: "success",
    mode: "compact",
    text: "Robô iniciado. Observando mercado.",
    icon: "🚀",
  },
  "robot.paused": {
    level: "warning",
    mode: "compact",
    text: "Robô pausado.",
    icon: "⏸️",
  },
  "robot.resumed": {
    level: "success",
    mode: "compact",
    text: "Robô retomado. Leitura reiniciada.",
    icon: "▶️",
  },
  "robot.stopped": {
    level: "warning",
    mode: "compact",
    text: "Robô parado.",
    icon: "⏹️",
  },
  "robot.error": {
    level: "error",
    mode: "compact",
    text: (m) => `Erro no robô: ${String(m?.error || "desconhecido")}.`,
    icon: "⚠️",
  },
  "diary.entry": {
    level: "info",
    mode: "compact",
    text: (m) => String(m?.text || ""),
    icon: "📝",
  },
  "market.update": {
    level: "info",
    mode: "developer",
    text: "Informações de mercado atualizadas.",
    icon: "📊",
  },
  "scanLog.update": {
    level: "info",
    mode: "developer",
    text: (m) => {
      const log = m?.scanLog as { asset: string; blocked: boolean }[] | undefined;
      if (!log) return "Scan log atualizado.";
      const passed = log.filter((e) => !e.blocked).length;
      const blocked = log.filter((e) => e.blocked).length;
      return `Scan: ${passed} sinais, ${blocked} bloqueados.`;
    },
    icon: "📋",
  },
  "system.info": {
    level: "info",
    mode: "developer",
    text: (m) => String(m?.message || "Informação do sistema."),
    icon: "ℹ️",
  },
};

export function resolveAnalystMessage(
  type: AnalystEventType,
  meta?: Record<string, unknown>,
): {
  level: AnalystMessageLevel;
  text: string;
  icon: string;
  mode: "compact" | "explanatory" | "developer";
} {
  const def = ANALYST_EVENT_MAP[type];
  const text = typeof def.text === "function" ? def.text(meta) : def.text;
  return { level: def.level, text, icon: def.icon, mode: def.mode };
}
