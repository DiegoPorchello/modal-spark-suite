import type { AnalystEventType } from "./AnalystTypes";

type AnalystListener = (type: AnalystEventType, meta?: Record<string, unknown>) => void;

class AnalystEventBus {
  private listeners: AnalystListener[] = [];

  subscribe(listener: AnalystListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(type: AnalystEventType, meta?: Record<string, unknown>): void {
    for (const listener of this.listeners) {
      try {
        listener(type, meta);
      } catch {
        // Silently ignore listener errors
      }
    }
  }
}

export const analystBus = new AnalystEventBus();
