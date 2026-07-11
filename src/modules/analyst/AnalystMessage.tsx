import { memo } from "react";
import type { AnalystMessage as AnalystMessageType } from "./AnalystTypes";

const LEVEL_DOT: Record<string, string> = {
  success: "bg-success",
  info: "bg-primary",
  warning: "bg-warning",
  error: "bg-danger",
};

function AnalystMessageComponent({
  message,
  isLast,
}: {
  message: AnalystMessageType;
  isLast?: boolean;
}) {
  const time = message.timestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex items-start gap-2 py-1.5 ${isLast ? "bg-success/5 -mx-1 px-1 rounded" : ""}`}
    >
      <span
        className={`size-1.5 rounded-full mt-1.5 shrink-0 ${LEVEL_DOT[message.level]} ${isLast ? "animate-pulse" : ""}`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] leading-relaxed text-foreground/80">{message.text}</div>
        <div className="text-[8px] font-mono text-muted-foreground/50 mt-0.5">{time}</div>
      </div>
    </div>
  );
}

export const AnalystMessageView = memo(AnalystMessageComponent);
