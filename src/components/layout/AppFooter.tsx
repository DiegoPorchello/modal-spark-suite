interface AppFooterProps {
  robotState: {
    status: string;
    nextOperationIn: number;
    config: {
      autoDirection: boolean;
      assets: string[];
      scanMode: string;
    };
    currentSession: string;
    lastScannedAsset: string | null;
  };
  connected: boolean;
}

export function AppFooter({ robotState, connected }: AppFooterProps) {
  return (
    <footer className="h-10 border-t border-border bg-panel flex items-center px-5 text-[11px] text-muted-foreground gap-6">
      <span
        className={`flex items-center gap-2 ${robotState.status === "running" ? "text-success" : "text-muted-foreground"}`}
      >
        <span
          className={`size-2 rounded-full ${robotState.status === "running" ? "bg-success" : "bg-muted-foreground"}`}
        />
        {robotState.status === "running" ? "ROBO ATIVO" : "ROBO INATIVO"}
      </span>
      <span>
        PRÓXIMA ANÁLISE:{" "}
        <span className="text-foreground font-mono">
          {robotState.nextOperationIn > 0
            ? `00:${String(Math.min(robotState.nextOperationIn, 59)).padStart(2, "0")}`
            : "—"}
        </span>
      </span>
      <span>
        MODO:{" "}
        <span className="text-foreground">
          {robotState.config.autoDirection ? "AUTOMÁTICO" : "MANUAL"}
        </span>
      </span>
      <span>
        GERENCIAMENTO: <span className="text-success">SOROSGALE ●</span>
      </span>
      <span>
        SESSÃO:{" "}
        <span className={robotState.currentSession === "open" ? "text-success" : "text-warning"}>
          {robotState.currentSession === "open" ? "ABERTO" : "FECHADO"} (
          {robotState.config.assets.length})
        </span>
      </span>
      <span>
        SCAN:{" "}
        <span
          className={robotState.config.scanMode === "multi" ? "text-success" : "text-foreground"}
        >
          {robotState.config.scanMode === "multi"
            ? `MULTI (${robotState.config.assets.length})`
            : "SINGLE"}
        </span>
      </span>
      {robotState.config.scanMode === "multi" && robotState.lastScannedAsset && (
        <span>
          ATIVO: <span className="text-success font-bold">{robotState.lastScannedAsset}</span>
        </span>
      )}
      <span className="ml-auto">
        CONEXÃO:{" "}
        <span className={connected ? "text-success" : "text-danger"}>
          {connected ? "PUMA BROKER" : "DESCONECTADO"}
        </span>
      </span>
    </footer>
  );
}
