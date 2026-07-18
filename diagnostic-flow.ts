/**
 * DIAGNÓSTICO DE FLUXO: Calculadora SorosGale → Robô
 *
 * Simula o fluxo EXATO que o robô usa para cada operação e verifica
 * se a calculadora está respondendo corretamente.
 *
 * Uso: npx tsx diagnostic-flow.ts
 */

import { SmartRecoveryEngine } from "./src/modules/smart-recovery/SmartRecoveryEngine";

function divider(label: string) {
  console.log("\n" + "═".repeat(72));
  console.log(`  ${label}`);
  console.log("═".repeat(72));
}

function printEntry(engine: SmartRecoveryEngine, label: string) {
  const e = engine.getEntry();
  const s = engine.getState();
  const ai = engine.evaluateAIDecision();
  console.log(`  ${label}`);
  console.log(`    getEntry() → valor=R$${e.valor.toFixed(2)}  level=${e.level}  entry=${e.entry}  soros=${e.isSoros}`);
  console.log(`    Estado → phase=${s.phase}  level=${s.currentLevel}  entryNum=${s.entryNumber}`);
  console.log(`    CPR=R$${s.capitalPending.toFixed(2)}  Session=R$${s.sessionProfit.toFixed(2)}`);
  console.log(`    Consecutive: Wins=${s.consecutiveWins}  Losses=${s.consecutiveLosses}`);
  console.log(`    AI Decision: ${ai.action} (${ai.confidence}%) — ${ai.reason}`);
}

function showLevelTable(engine: SmartRecoveryEngine, rows: number = 6) {
  const table = engine.getDashboard().levelTable;
  console.log(`\n  TABELA DE NÍVEIS (primeiras ${rows} linhas):`);
  console.log(`  ${"Nível".padStart(5)} | ${"Entry1".padStart(8)} | ${"Entry2".padStart(8)} | ${"acumulado".padStart(9)} | Recupera?`);
  console.log(`  ${"-".repeat(5)}-|-${"-".repeat(8)}-|-${"-".repeat(8)}-|-${"-".repeat(9)}-|----------`);
  for (const row of table.slice(0, rows)) {
    console.log(`  ${String(row.level).padStart(5)} | ${`R$ ${row.entry1.toFixed(2)}`.padStart(8)} | ${`R$ ${row.entry2.toFixed(2)}`.padStart(8)} | ${`R$ ${row.accLossAfter.toFixed(2)}`.padStart(9)} | ${row.canRecover ? "✅" : "❌"}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTE PRINCIPAL: SIMULA O FLUXO DO ROBÔ
// ═══════════════════════════════════════════════════════════════
divider("DIAGNÓSTICO: Fluxo Robô → Calculadora");

const engine = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 200,
  stopWin: 100,
  maxLevel: 15,
});

console.log("\nCONFIGURAÇÃO:");
console.log(`  initialStake=R$${engine.getConfig().initialStake}`);
console.log(`  payout=${engine.getConfig().payout}`);
console.log(`  customLevels=${engine.getConfig().customLevels?.join(", ") ?? "nenhum"}`);

showLevelTable(engine, 8);

// ═══════════════════════════════════════════════════════════════
// CENÁRIO: 2 LOSSES + 1 WIN
// ═══════════════════════════════════════════════════════════════
divider("CENÁRIO: 2 LOSSES + 1 WIN (como seu histórico)");

engine.startSession();
console.log("\n--- Sessão iniciada ---");

// Estado inicial
printEntry(engine, "ANTES do Trade #1:");
console.log("  [ROBÔ] Consultou calculadora → vai usar R$ " + engine.getEntry().valor.toFixed(2));

// Trade #1: LOSS
console.log("\n--- TRADE #1: LOSS ---");
console.log("  [ROBÔ] Executou ordem no broker");
console.log("  [BROKER] Retornou: LOSS");
console.log("  [ROBÔ] Chamando registerLoss()...");
const op1 = engine.registerLoss("call");
console.log(`  [SR] registerLoss executou! level: ${op1.level} → ${engine.getState().currentLevel}`);
console.log("  [ROBÔ] Próxima consulta → getEntry()");
printEntry(engine, "APÓS Trade #1 (deve ser level 1):");
console.log("  [STAKE] Próximo trade usará: R$ " + engine.getEntry().valor.toFixed(2));

// Trade #2: LOSS
console.log("\n--- TRADE #2: LOSS ---");
console.log("  [ROBÔ] Chamando registerLoss()...");
const op2 = engine.registerLoss("call");
console.log(`  [SR] registerLoss executou! level: ${op2.level} → ${engine.getState().currentLevel}`);
printEntry(engine, "APÓS Trade #2 (deve ser level 2):");
console.log("  [STAKE] Próximo trade usará: R$ " + engine.getEntry().valor.toFixed(2));

// Trade #3: WIN
console.log("\n--- TRADE #3: WIN ---");
console.log("  [ROBÔ] Chamando registerWin()...");
const op3 = engine.registerWin("call", 0.86);
console.log(`  [SR] registerWin executou! entry=${op3.entryNumber} level=${op3.level}`);
printEntry(engine, "APÓS Trade #3 (Entry 1 WIN → deve ir pra SOROS):");
console.log("  [STAKE] Próximo trade usará: R$ " + engine.getEntry().valor.toFixed(2) + " (SOROS)");
console.log("  [SOROS?] " + (engine.getEntry().isSoros ? "✅ Vai operar SOROS" : "❌ Não está em SOROS"));

// Trade #4: SOROS WIN (completa ciclo)
console.log("\n--- TRADE #4: SOROS WIN (recuperação) ---");
console.log("  [ROBÔ] Chamando registerWin() em SOROS...");
const op4 = engine.registerWin("call", 0.86);
console.log(`  [SR] registerWin SOROS executou! level: ${op4.level}`);
printEntry(engine, "APÓS Trade #4 (SOROS WIN → reset L0-E1):");
console.log("  [STAKE] Próximo trade: R$ " + engine.getEntry().valor.toFixed(2));
console.log("  [RESET?] " + (engine.getState().currentLevel === 0 && engine.getState().entryNumber === 1 ? "✅ Resetou corretamente L0-E1" : "❌ Não resetou"));

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 2: 4 LOSSES CONSECUTIVOS
// ═══════════════════════════════════════════════════════════════
divider("CENÁRIO 2: 4 LOSSES CONSECUTIVOS (simula seu problema)");

const engine2 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 200,
  stopWin: 100,
  maxLevel: 15,
});
engine2.startSession();

const losses = [1, 2, 3, 4];
for (const i of losses) {
  console.log(`\n--- LOSS #${i} ---`);
  const antes = engine2.getEntry();
  console.log(`  ANTES: level=${antes.level} stake=R$${antes.valor.toFixed(2)}`);
  engine2.registerLoss("call");
  const depois = engine2.getEntry();
  console.log(`  DEPOIS: level=${depois.level} entry=${depois.entry} stake=R$${depois.valor.toFixed(2)}`);

  if (depois.valor > antes.valor) {
    console.log(`  ✅ STAKE AUMENTOU: R$${antes.valor.toFixed(2)} → R$${depois.valor.toFixed(2)}`);
  } else if (depois.valor === antes.valor) {
    console.log(`  ⚠️ STAKE IGUAL: R$${antes.valor.toFixed(2)} (não aumentou!)`);
  } else {
    console.log(`  ❌ STAKE DIMINUIU: R$${antes.valor.toFixed(2)} → R$${depois.valor.toFixed(2)}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 3: COM NÍVEIS CUSTOMIZADOS
// ═══════════════════════════════════════════════════════════════
divider("CENÁRIO 3: Níveis Customizados [2, 2, 2, 2] (teste de travamento)");

const engine3 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 200,
  stopWin: 100,
  maxLevel: 15,
  customLevels: [2, 2, 2, 2],
});
engine3.startSession();

console.log("\n  ⚠️ customLevels = [2, 2, 2, 2] — TODOS os níveis em R$ 2.00!");
showLevelTable(engine3, 6);

for (let i = 1; i <= 4; i++) {
  const antes = engine3.getEntry();
  engine3.registerLoss("call");
  const depois = engine3.getEntry();
  console.log(`  LOSS #${i}: level=${antes.level} → ${depois.level}  stake=R$${depois.valor.toFixed(2)} ${depois.valor > antes.valor ? "✅" : "⚠️ travado"}`);
}

// ═══════════════════════════════════════════════════════════════
// RESUMO
// ═══════════════════════════════════════════════════════════════
divider("RESUMO DO DIAGNÓSTICO");

console.log(`
  No CONSOLE DO NAVEGADOR, cole o script abaixo para inspecionar o robô AO VIVO:

    // Ver estado atual da calculadora
    if (window.__robotEngine) {
      const sr = window.__smartRecovery;
      console.table({
        level: sr.getState().currentLevel,
        entry: sr.getState().entryNumber,
        stake: sr.getCurrentStake(),
        fase: sr.getState().phase,
        cpr: sr.getState().capitalPending,
        consecLosses: sr.getState().consecutiveLosses,
        consecWins: sr.getState().consecutiveWins,
      });
      console.table(sr.getDashboard().levelTable.slice(0, 8));
    }

    // Simular uma perda manualmente (para testar se o nível sobe)
    if (window.__smartRecovery) {
      const antes = window.__smartRecovery.getEntry();
      window.__smartRecovery.registerLoss("call");
      const depois = window.__smartRecovery.getEntry();
      console.log(\`Antes: R$\${antes.valor} (level \${antes.level})
      Depois: R$\${depois.valor} (level \${depois.level})
      Subiu? \${depois.valor > antes.valor ? "✅ SIM" : "❌ NÃO"}\`);
    }

  Se o nível NÃO subir após registerLoss manual, o problema é na calculadora.
  Se o nível SUBIR manualmente, o problema é que registerLoss NÃO está sendo chamado pelo robô.
`);
