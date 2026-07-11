import { useEffect, useRef } from "react";
import type { AnalystMessage } from "./AnalystTypes";
import { AnalystMessageView } from "./AnalystMessage";

export function AnalystTimeline({ messages }: { messages: AnalystMessage[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="py-4 text-center">
        <div className="text-[10px] text-muted-foreground">Aguardando eventos...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-h-[180px] overflow-y-auto space-y-0">
      {messages.slice(0, 30).map((msg, i) => (
        <AnalystMessageView key={msg.id} message={msg} isLast={i === 0} />
      ))}
    </div>
  );
}
