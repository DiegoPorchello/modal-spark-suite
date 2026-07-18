import type { SorosGaleReportData } from "./SmartRecoveryTypes";
import { SmartRecoveryCalculator } from "./SmartRecoveryCalculator";

export class SmartRecoveryReport {
  private calculator: SmartRecoveryCalculator;

  constructor() {
    this.calculator = new SmartRecoveryCalculator();
  }

  generateCSV(data: any): string {
    const lines: string[] = [];

    lines.push("NEXOR SMART RECOVERY™ - RELATÓRIO");
    lines.push(`Sessão: ${data.reportId ?? data.sessionId ?? "N/A"}`);
    lines.push(
      `Início: ${data.period?.start?.toISOString?.() ?? data.startTime?.toISOString?.() ?? ""}`,
    );
    lines.push(`Fim: ${data.period?.end?.toISOString?.() ?? data.endTime?.toISOString?.() ?? ""}`);
    lines.push(`Banca Inicial: R$ ${(data.config?.bankroll ?? 0).toFixed(2)}`);
    lines.push(`Stop Loss: R$ ${(data.config?.stopLoss ?? 0).toFixed(2)}`);
    lines.push(`Stop Win: R$ ${(data.config?.stopWin ?? 0).toFixed(2)}`);
    lines.push(`Payout: ${(data.config?.payout ?? 0.87) * 100}%`);
    lines.push("");

    lines.push("RESUMO");
    const summary = data.summary ?? data;
    lines.push(`Operações: ${summary.operations ?? data.operations?.length ?? 0}`);
    lines.push(`Wins: ${summary.totalWins ?? 0}`);
    lines.push(`Losses: ${summary.totalLosses ?? 0}`);
    lines.push(`Win Rate: ${summary.winRate ?? 0}%`);
    lines.push(`Banca Final: R$ ${(summary.finalBankroll ?? data.finalBankroll ?? 0).toFixed(2)}`);
    lines.push(`Drawdown: ${summary.drawdown ?? data.maxDrawdown ?? 0}%`);
    lines.push("");

    lines.push("BREAKDOWN DIÁRIO");
    lines.push("Data;Operações;Wins;Losses;Lucro");
    const breakdown = data.dailyBreakdown ?? [];
    for (const d of breakdown) {
      lines.push(
        `${d.date};${d.trades ?? d.operations ?? 0};${d.wins ?? 0};${d.losses ?? 0};R$ ${(d.profit ?? 0).toFixed(2)}`,
      );
    }
    lines.push("");

    lines.push("OPERAÇÕES");
    lines.push(
      "ID;Hora;Ativo;Direção;Stake;Payout;CPR Antes;CPR Depois;Resultado;Lucro;Entrada;Nível;Ciclo",
    );
    const ops = data.operations ?? [];
    for (const op of ops) {
      lines.push(
        `${op.id};${op.hour};${op.asset ?? ""};${(op.direction ?? "").toUpperCase()};R$ ${(op.stake ?? 0).toFixed(2)};${op.payout ?? 0};R$ ${(op.cprBefore ?? 0).toFixed(2)};R$ ${(op.cprAfter ?? 0).toFixed(2)};${op.result ?? ""};R$ ${(op.profit ?? 0).toFixed(2)};E${op.entryNumber ?? 1};N${op.level ?? 0};${op.sessionCycle ?? 0}`,
      );
    }

    return lines.join("\n");
  }

  generateJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  generateHTML(data: any): string {
    const ops = data.operations ?? [];
    const rows = ops
      .map(
        (op: any) => `
      <tr class="${op.result === "WIN" ? "win" : op.result === "LOSS" ? "loss" : "draw"}">
        <td>${op.hour ?? ""}</td>
        <td>${op.asset ?? ""}</td>
        <td>${(op.direction ?? "").toUpperCase()}</td>
        <td>R$ ${(op.stake ?? 0).toFixed(2)}</td>
        <td>${op.payout ?? 0}</td>
        <td>R$ ${(op.cprBefore ?? 0).toFixed(2)}</td>
        <td>R$ ${(op.cprAfter ?? 0).toFixed(2)}</td>
        <td class="${(op.result ?? "").toLowerCase()}">${op.result ?? ""}</td>
        <td>R$ ${(op.profit ?? 0).toFixed(2)}</td>
        <td>N${op.level ?? 0}-E${op.entryNumber ?? 1}</td>
        <td>${op.sessionCycle ?? 0}</td>
      </tr>`,
      )
      .join("");

    const breakdown = data.dailyBreakdown ?? [];
    const dailyRows = breakdown
      .map(
        (d: any) => `
      <tr>
        <td>${d.date}</td>
        <td>${d.trades ?? d.operations ?? 0}</td>
        <td>${d.wins ?? 0}</td>
        <td>${d.losses ?? 0}</td>
        <td>R$ ${(d.profit ?? 0).toFixed(2)}</td>
      </tr>`,
      )
      .join("");

    const reportId = data.reportId ?? data.sessionId ?? "N/A";
    const startStr =
      data.period?.start?.toLocaleString?.("pt-BR") ??
      data.startTime?.toLocaleString?.("pt-BR") ??
      "";
    const endStr =
      data.period?.end?.toLocaleString?.("pt-BR") ?? data.endTime?.toLocaleString?.("pt-BR") ?? "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>SOROSGALE - ${reportId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #0a0a0f; color: #e0e0e0; padding: 20px; }
  h1 { color: #00ff88; text-align: center; margin-bottom: 5px; font-size: 24px; }
  h2 { color: #00cc6a; margin: 20px 0 10px; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 5px; }
  .subtitle { text-align: center; color: #888; margin-bottom: 20px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .summary-card { background: #12121a; border: 1px solid #222; border-radius: 8px; padding: 12px; text-align: center; }
  .summary-card .label { color: #888; font-size: 11px; text-transform: uppercase; }
  .summary-card .value { color: #00ff88; font-size: 22px; font-weight: bold; margin-top: 4px; }
  .summary-card .value.negative { color: #ff4444; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1a1a2e; color: #00cc6a; padding: 8px; text-align: left; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #1a1a2e; font-size: 12px; }
  tr:hover { background: #12121a; }
  tr.win td { border-left: 3px solid #00ff88; }
  tr.loss td { border-left: 3px solid #ff4444; }
  .win { color: #00ff88; }
  .loss { color: #ff4444; }
  .draw { color: #ffaa00; }
  .config-table td { padding: 4px 15px; }
  .config-table td:first-child { color: #888; }
</style>
</head>
<body>
<h1>SOROSGALE</h1>
<p class="subtitle">Sessão: ${reportId} | ${startStr} → ${endStr}</p>

<h2>Configuração</h2>
<table class="config-table">
  <tr><td>Banca Inicial</td><td>R$ ${(data.config?.bankroll ?? 0).toFixed(2)}</td></tr>
  <tr><td>Stop Loss</td><td>R$ ${(data.config?.stopLoss ?? 0).toFixed(2)}</td></tr>
  <tr><td>Stop Win</td><td>R$ ${(data.config?.stopWin ?? 0).toFixed(2)}</td></tr>
  <tr><td>Payout</td><td>${(data.config?.payout ?? 0.87) * 100}%</td></tr>
</table>

<h2>Resumo</h2>
<div class="summary-grid">
  <div class="summary-card"><div class="label">Operações</div><div class="value">${ops.length}</div></div>
  <div class="summary-card"><div class="label">Banca Final</div><div class="value">R$ ${(data.finalBankroll ?? 0).toFixed(2)}</div></div>
  <div class="summary-card"><div class="label">Drawdown</div><div class="value">${(data.maxDrawdown ?? 0).toFixed(1)}%</div></div>
</div>

<h2>Breakdown Diário</h2>
<table>
  <tr><th>Data</th><th>Operações</th><th>Wins</th><th>Losses</th><th>Lucro</th></tr>
  ${dailyRows}
</table>

<h2>Operações (${ops.length})</h2>
<table>
  <tr><th>Hora</th><th>Ativo</th><th>Dir</th><th>Stake</th><th>Payout</th><th>CPR Antes</th><th>CPR Depois</th><th>Resultado</th><th>Lucro</th><th>Estado</th><th>Ciclo</th></tr>
  ${rows}
</table>

</body>
</html>`;
  }

  download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    a.click();
    // Clean up after a microtask to avoid DOM conflicts with React
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });
  }

  downloadCSV(data: any): void {
    const csv = this.generateCSV(data);
    const filename = `sorosgale-report-${Date.now()}.csv`;
    this.download(csv, filename, "text/csv;charset=utf-8");
  }

  downloadJSON(data: any): void {
    const json = this.generateJSON(data);
    const filename = `sorosgale-report-${Date.now()}.json`;
    this.download(json, filename, "application/json");
  }

  downloadHTML(data: any): void {
    const html = this.generateHTML(data);
    const filename = `sorosgale-report-${Date.now()}.html`;
    this.download(html, filename, "text/html;charset=utf-8");
  }
}
