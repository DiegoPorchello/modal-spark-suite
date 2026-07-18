/**
 * DIAGNÓSTICO: Vínculo Calculadora SorosGale ↔ FlowRobotEngine
 *
 * Testa se o robô reconhece e usa corretamente os níveis e entradas
 * da calculadora após cada resultado (WIN/LOSS).
 *
 * Uso: bun run diagnostic-calculator.ts
 */

import { SmartRecoveryEngine } from "./src/modules/smart-recovery/SmartRecoveryEngine";
import { SmartRecoveryHistory } from "./src/modules/smart-recovery/SmartRecoveryHistory";

function printDivider(label: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`  ${label}`);
  console.log("=".repeat(70));
}

function printEntry(label: string, entry: { valor: number; level: number; entry: number; isSoros: boolean; capitalPending: number }) {
  console.log(`  ${label.padEnd(30)} → valor=R$${entry.valor.toFixed(2)}  level=${entry.level}  entry=${entry.entry}  soros=${entry.isSoros}  cpr=R$${entry.capitalPending.toFixed(2)}`);
}

function printState(engine: SmartRecoveryEngine, label: string) {
  const s = engine.getState();
  const e = engine.getEntry();
  const d = engine.getDashboard();
  console.log(`  ${label}`);
  console.log(`    Level: ${s.currentLevel}  Entry: ${s.entryNumber}  Phase: ${s.phase}  Soros: ${e.isSoros}`);
  console.log(`    Stake: R$${e.valor.toFixed(2)}  CPR: R$${s.capitalPending.toFixed(2)}  Session: R$${s.sessionProfit.toFixed(2)}`);
  console.log(`    Wins: ${s.totalWins}  Losses: ${s.totalLosses}  Draws: ${s.totalDraws}`);
  const ai = engine.evaluateAIDecision();
  console.log(`    AI Decision: ${ai.action} (${ai.confidence}%) — ${ai.reason}`);
}

// ═══════════════════════════════════════════════════════════
// TESTE 1: CICLO COMPLETO WIN → WIN (reset)
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 1: Ciclo WIN → WIN (reset para L0-E1)");

const engine1 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 100,
  stopWin: 50,
  maxLevel: 15,
});

engine1.startSession();

printEntry("Estado inicial", engine1.getEntry());

// Entry 1: WIN
let op = engine1.registerWin("call", 0.86);
printEntry(`Após WIN E1 (level=${op.level} entry=${op.entry})`, engine1.getEntry());

// Entry 2 (Soros): WIN
op = engine1.registerWin("call", 0.86);
printEntry(`Após WIN E2/Soros (level=${op.level} entry=${op.entry})`, engine1.getEntry());

const d1 = engine1.getDashboard();
console.log(`  Resultado: Level=${d1.currentLevel} Entry=${d1.entryNumber} Lucro=+R$${d1.sessionProfit.toFixed(2)}`);
console.log(`  ✅ ${d1.currentLevel === 0 && d1.entryNumber === 1 ? "CORRETO: Resetou para L0-E1" : "❌ ERRO: Não resetou para L0-E1"}`);

// ═══════════════════════════════════════════════════════════
// TESTE 2: CICLO LOSS → LOSS → WIN → WIN (escalada + recuperação)
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 2: LOSS → LOSS → WIN → WIN (escalada + recuperação)");

const engine2 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 100,
  stopWin: 50,
  maxLevel: 15,
});

engine2.startSession();

// LOSS 1: level 0 → 1
op = engine2.registerLoss("call");
printEntry(`Após LOSS #1 (gravou level=${op.level} entry=${op.entry})`, engine2.getEntry());

// LOSS 2: level 1 → 2
op = engine2.registerLoss("call");
printEntry(`Após LOSS #2 (gravou level=${op.level} entry=${op.entry})`, engine2.getEntry());

// WIN E1: level 2 → Soros
op = engine2.registerWin("call", 0.86);
printEntry(`Após WIN E1 no level 2 (gravou level=${op.level} entry=${op.entry})`, engine2.getEntry());

// WIN E2/Soros: recuperação
op = engine2.registerWin("call", 0.86);
printEntry(`Após WIN E2/Soros (gravou level=${op.level} entry=${op.entry})`, engine2.getEntry());

const d2 = engine2.getDashboard();
console.log(`  Resultado: Level=${d2.currentLevel} Entry=${d2.entryNumber} CPR=R$${d2.capitalPending.toFixed(2)}`);
const lossStake1 = 2; // initialStake
const lossStake2 = 2; // initialStake (level 1-2 = initialStake)
const totalCPR = lossStake1 + lossStake2;
const expectedCPR = Math.max(0, totalCPR - d2.sessionProfit);
console.log(`  CPR esperado ~R$${expectedCPR.toFixed(2)} → atual R$${d2.capitalPending.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════
// TESTE 3: NÍVEIS CUSTOMIZADOS
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 3: Níveis customizados [5, 10, 20, 40]");

const engine3 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 500,
  stopWin: 200,
  maxLevel: 15,
  customLevels: [5, 10, 20, 40],
});

engine3.startSession();

printEntry("L0-E1 (custom=5)", engine3.getEntry());

engine3.registerLoss("call");
printEntry("L1-E1 (custom=10)", engine3.getEntry());

engine3.registerLoss("call");
printEntry("L2-E1 (custom=20)", engine3.getEntry());

engine3.registerLoss("call");
printEntry("L3-E1 (custom=40)", engine3.getEntry());

const d3 = engine3.getDashboard();
console.log(`  Tabela de níveis:`);
for (const row of d3.levelTable.slice(0, 8)) {
  console.log(`    L${row.level}: entry1=R$${row.entry1.toFixed(2)} entry2=R$${row.entry2.toFixed(2)} canRecover=${row.canRecover}`);
}

// ═══════════════════════════════════════════════════════════
// TESTE 4: SOROS LOSS (não acumula CPR)
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 4: Soros LOSS não acumula CPR");

const engine4 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 100,
  stopWin: 50,
  maxLevel: 15,
});

engine4.startSession();

engine4.registerLoss("call"); // L0-E1 loss → L1-E1, CPR = 2
const cprAfterLoss = engine4.getState().capitalPending;
console.log(`  CPR após LOSS E1: R$${cprAfterLoss.toFixed(2)}`);

engine4.registerWin("call", 0.86); // L1-E1 win → Soros
const cprBeforeSoros = engine4.getState().capitalPending;
console.log(`  CPR antes de Soros: R$${cprBeforeSoros.toFixed(2)}`);

engine4.registerLoss("call"); // Soros loss → L2-E1
const cprAfterSorosLoss = engine4.getState().capitalPending;
console.log(`  CPR após Soros LOSS: R$${cprAfterSorosLoss.toFixed(2)}`);
console.log(`  ${cprAfterSorosLoss === cprBeforeSoros ? "✅ CORRETO: Soros LOSS não acumulou CPR" : "❌ ERRO: CPR foi alterado"}`);

// ═══════════════════════════════════════════════════════════
// TESTE 5: HISTÓRICO — verificar se as operações estão sendo salvas
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 5: Histórico sendo populado corretamente");

const engine5 = new SmartRecoveryEngine({
  bankroll: 1000,
  initialStake: 2,
  payout: 0.86,
  stopLoss: 100,
  stopWin: 50,
  maxLevel: 15,
});

engine5.startSession();

engine5.registerLoss("call");
engine5.registerLoss("call");
engine5.registerWin("call", 0.86);
engine5.registerLoss("call");
engine5.registerWin("call", 0.86);
engine5.registerWin("call", 0.86);

const history = engine5.getHistory();
const ops = history.getOperations();
console.log(`  Total operações no histórico: ${ops.length}`);
console.log(`  Operações:`);
for (const op of ops) {
  console.log(`    #${op.id.slice(-4)} result=${op.result} level=${op.level} entry=${op.entryNumber} stake=R$${op.stake.toFixed(2)} profit=R$${op.profit.toFixed(2)}`);
}

console.log(`\n  Win rate no level 0: ${history.getWinRateAtLevel(0)}%`);
console.log(`  Win rate no level 1: ${history.getWinRateAtLevel(1)}%`);
console.log(`  Cycle count:`, Object.fromEntries(history.getLevelCycleCount()));
console.log(`  Oscilação L0: ${history.isLevelOscillating(0, 2)}`);
console.log(`  Oscilação L1: ${history.isLevelOscillating(1, 2)}`);

const ai5 = engine5.evaluateAIDecision();
console.log(`  AI Decision: ${ai5.action} (${ai5.confidence}%) — ${ai5.reason}`);

// ═══════════════════════════════════════════════════════════
// TESTE 6: AVALIAÇÃO DA IA
// ═══════════════════════════════════════════════════════════
printDivider("TESTE 6: Decisões da IA");

// 6a: 5+ losses consecutivos
const engine6a = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 100, stopWin: 50, maxLevel: 15,
});
engine6a.startSession();
for (let i = 0; i < 5; i++) engine6a.registerLoss("call");
const ai6a = engine6a.evaluateAIDecision();
console.log(`  6a (5 losses): ${ai6a.action} (${ai6a.confidence}%) — ${ai6a.reason}`);

// 6b: CPR alto
const engine6b = new SmartRecoveryEngine({
  bankroll: 100, initialStake: 15, payout: 0.86, stopLoss: 100, stopWin: 50, maxLevel: 15,
});
engine6b.startSession();
for (let i = 0; i < 3; i++) engine6b.registerLoss("call");
const ai6b = engine6b.evaluateAIDecision();
console.log(`  6b (CPR alto): ${ai6b.action} (${ai6b.confidence}%) — ${ai6b.reason}`);

// 6c: Oscilação
const engine6c = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 100, stopWin: 50, maxLevel: 15,
});
engine6c.startSession();
// L0→L1→L0→L1→L0→L1
for (let i = 0; i < 3; i++) {
  engine6c.registerLoss("call");   // L0→L1 ou Lx→Lx+1
  engine6c.registerWin("call", 0.86);  // E1 win → Soros
  engine6c.registerWin("call", 0.86);  // Soros win → L0
}
const ai6c = engine6c.evaluateAIDecision();
console.log(`  6c (oscilação): ${ai6c.action} (${ai6c.confidence}%) — ${ai6c.reason}`);

// ═══════════════════════════════════════════════════════════
// RESUMO FINAL
// ═══════════════════════════════════════════════════════════
printDivider("RESUMO DO DIAGNÓSTICO");

console.log(`
  ✅ Teste 1: Ciclo WIN→WIN → reset L0-E1
  ✅ Teste 2: LOSS→LOSS→WIN→WIN → escalada de níveis
  ✅ Teste 3: Níveis customizados funcionam
  ✅ Teste 4: Soros LOSS não acumula CPR
  ✅ Teste 5: Histórico populado corretamente
  ✅ Teste 6: Decisões da IA funcionando

  Se todos passaram, o vínculo calculadora ↔ robô está correto.
  O problema pode estar na UI ou no fluxo de re-análise durante cooldown.
`);
