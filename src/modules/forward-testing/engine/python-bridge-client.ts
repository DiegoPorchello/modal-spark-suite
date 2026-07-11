/**
 * python-bridge-client.ts
 * Cliente HTTP para comunicação com o bridge Python.
 * O ForwardTestingEngine usa este cliente para:
 *   - Iniciar/parar o bot Python
 *   - Consultar status
 *   - Enviar sinais para execução
 *
 * O bridge Python (forward_testing_bridge.py) roda como um serviço
 * HTTP local ou serverless function.
 */

const BRIDGE_URL = import.meta.env.VITE_PYTHON_BRIDGE_URL ?? "http://localhost:8000";

export interface BridgeStatus {
  running: boolean;
  session_id: string | null;
  open_trades: number;
  latest_candles: Record<string, number | null>;
}

export interface BridgeStartConfig {
  symbol: string;
  timeframe: string;
  amount: number;
  wallet?: string;
}

export interface BridgeExecuteSignalInput {
  symbol: string;
  direction: "CALL" | "PUT";
  amount: number;
  timeframe: string;
  entry_price?: number;
  payout?: number;
  session_id?: string;
}

export interface BridgeSignalResult {
  status: string;
  order_id?: string;
  message?: string;
}

export const PythonBridgeClient = {
  async start(sessionId: string, config: BridgeStartConfig): Promise<{ status: string }> {
    const res = await fetch(`${BRIDGE_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, config }),
    });
    if (!res.ok) throw new Error(`Bridge error: ${await res.text()}`);
    return res.json();
  },

  async stop(): Promise<{ status: string }> {
    const res = await fetch(`${BRIDGE_URL}/stop`, { method: "POST" });
    if (!res.ok) throw new Error(`Bridge error: ${await res.text()}`);
    return res.json();
  },

  async getStatus(): Promise<BridgeStatus> {
    const res = await fetch(`${BRIDGE_URL}/status`);
    if (!res.ok) throw new Error(`Bridge error: ${await res.text()}`);
    return res.json();
  },

  async executeSignal(input: BridgeExecuteSignalInput): Promise<BridgeSignalResult> {
    const res = await fetch(`${BRIDGE_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Bridge error: ${await res.text()}`);
    return res.json();
  },
};
