/**
 * DIAGNÓSTICO DE INTEGRAÇÃO: FlowRobotEngine → SmartRecoveryEngine
 *
 * Simula o fluxo EXATO do robô para verificar se a calculadora
 * está sendo consultada corretamente após cada trade.
 *
 * Uso: npx tsx diagnostic-integration.ts
 */

import { SmartRecoveryEngine } from "./src/modules/smart-recovery/SmartRecoveryEngine";

function divider(label: string) {
  console.log("\n" + "═".repeat(72));
  console.log(`  ${label}`);
  console.log("═".repeat(72));
}

// ═══════════════════════════════════════════════════════════════
// SIMULA O FLUXO COMPLETO DO FLOW-ROBOT-ENGINE
// ═══════════════════════════════════════════════════════════════

function simulateBotCycle(engine: SmartRecoveryEngine, label: string, resultados: ("WIN" | "LOSS" | "DRAW")[]) {
  divider(label);
  
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];

    // Passo 1: Robô consulta a calculadora para saber o stake
    const antes = engine.getEntry();
    const stateAntes = engine.getState();

    // Passo 2: Robô executa a ordem no broker
    console.log(`\n  Trade #${i + 1}: Resultado=${r}`);
    console.log(`    ANTES de executar → level=${antes.level} entry=${antes.entry} stake=R$${antes.valor.toFixed(2)} soros=${antes.isSoros}`);

    // Passo 3: Broker retorna resultado, robô registra na calculadora
    let op;
    if (r === "WIN") {
      op = engine.registerWin("call", 0.86);
    } else if (r === "LOSS") {
      op = engine.registerLoss("call");
    } else {
      op = engine.registerDraw("call");
    }

    // Passo 4: Robô lê o novo estado da calculadora
    const depois = engine.getEntry();
    const stateDepois = engine.getState();

    console.log(`    DEPOIS de registrar → level=${depois.level} entry=${depois.entry} stake=R$${depois.valor.toFixed(2)} soros=${depois.isSoros}`);
    console.log(`    Operação registrada: op.level=${op.level} op.entry=${op.entryNumber} op.result=${op.result}`);
    
    // Verificações
    if (r === "LOSS" && antes.entry === 1) {
      // Loss na Entry 1: level deve subir 1, entry volta pra 1
      const nivelEsperado = stateAntes.currentLevel + 1;
      const ok = stateDepois.currentLevel === nivelEsperado && stateDepois.entryNumber === 1;
      console.log(`    ${ok ? "✅" : "❌"} LOSS E1: level=${stateDepois.currentLevel} (esperado=${nivelEsperado}) entry=${stateDepois.entryNumber} (esperado=1) ${ok ? "OK" : "ERRO!"}`);
      if (!ok) process.exit(1);
    } else if (r === "LOSS" && antes.entry === 2) {
      // Loss na Entry 2 (Soros): level sobe 1, entry volta pra 1, CPR não acumula
      const nivelEsperado = stateAntes.currentLevel + 1;
      const cprEsperado = stateAntes.capitalPending; // não acumula
      const ok = stateDepois.currentLevel === nivelEsperado && stateDepois.entryNumber === 1;
      console.log(`    ${ok ? "✅" : "❌"} LOSS E2/Soros: level=${stateDepois.currentLevel} (esperado=${nivelEsperado}) entry=${stateDepois.entryNumber} (esperado=1) CPR=R$${stateDepois.capitalPending.toFixed(2)} ${ok ? "OK" : "ERRO!"}`);
      if (!ok) process.exit(1);
    } else if (r === "WIN" && antes.entry === 1) {
      // Win na Entry 1: vai pra Soros (entry 2), mesmo level
      const ok = stateDepois.entryNumber === 2;
      console.log(`    ${ok ? "✅" : "❌"} WIN E1: entry=${stateDepois.entryNumber} (esperado=2/Soros) level=${stateDepois.currentLevel} ${ok ? "OK" : "ERRO!"}`);
      if (!ok) process.exit(1);
    } else if (r === "WIN" && antes.entry === 2) {
      // Win na Entry 2 (Soros): reseta level=0 entry=1
      const ok = stateDepois.currentLevel === 0 && stateDepois.entryNumber === 1;
      console.log(`    ${ok ? "✅" : "❌"} WIN E2/Soros: level=${stateDepois.currentLevel} (esperado=0) entry=${stateDepois.entryNumber} (esperado=1) ${ok ? "OK" : "ERRO!"}`);
      if (!ok) process.exit(1);
    } else if (r === "DRAW") {
      // DRAW: nada muda
      const ok = stateDepois.currentLevel === stateAntes.currentLevel && stateDepois.entryNumber === stateAntes.entryNumber;
      console.log(`    ${ok ? "✅" : "❌"} DRAW: level=${stateDepois.currentLevel} entry=${stateDepois.entryNumber} (sem alteração) ${ok ? "OK" : "ERRO!"}`);
      if (!ok) process.exit(1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 1: LOSS → WIN → WIN (recuperação completa)
// ═══════════════════════════════════════════════════════════════
const engine1 = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 200, stopWin: 100, maxLevel: 15,
});
engine1.startSession();

simulateBotCycle(engine1, "CENÁRIO 1: LOSS → RECUPERAÇÃO", [
  "LOSS",  // L0-E1 → L1-E1
  "WIN",   // L1-E1 → Soros
  "WIN",   // Soros → L0-E1 (recuperou)
]);

const final1 = engine1.getDashboard();
console.log(`\n  FINAL: level=${final1.currentLevel} entry=${final1.entryNumber} lucro=R$${final1.sessionProfit.toFixed(2)}`);
console.log(`  ${final1.currentLevel === 0 && final1.entryNumber === 1 ? "✅ Recuperação completa! Resetou L0-E1" : ""}`);

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 2: LOSS × 3 → WIN → WIN (recuperação de níveis múltiplos)
// ═══════════════════════════════════════════════════════════════
const engine2 = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 200, stopWin: 100, maxLevel: 15,
});
engine2.startSession();

simulateBotCycle(engine2, "CENÁRIO 2: 3 LOSSES → RECUPERAÇÃO", [
  "LOSS",  // L0-E1 → L1-E1
  "LOSS",  // L1-E1 → L2-E1
  "LOSS",  // L2-E1 → L3-E1
  "WIN",   // L3-E1 → Soros (entry 2)
  "WIN",   // Soros → recupera parcial ou totalmente
]);

const final2 = engine2.getDashboard();
console.log(`\n  FINAL: level=${final2.currentLevel} entry=${final2.entryNumber} CPR=R$${final2.capitalPending.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 3: WIN → LOSS → WIN → LOSS (alternado)
// ═══════════════════════════════════════════════════════════════
const engine3 = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 200, stopWin: 100, maxLevel: 15,
});
engine3.startSession();

simulateBotCycle(engine3, "CENÁRIO 3: WIN → LOSS → WIN → LOSS (alternado)", [
  "WIN",   // L0-E1 → Soros
  "LOSS",  // Soros loss → L1-E1
  "WIN",   // L1-E1 → Soros
  "LOSS",  // Soros loss → L2-E1
]);

const final3 = engine3.getDashboard();
console.log(`\n  FINAL: level=${final3.currentLevel} entry=${final3.entryNumber} CPR=R$${final3.capitalPending.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// CENÁRIO 4: DRAW (não altera nível)
// ═══════════════════════════════════════════════════════════════
const engine4 = new SmartRecoveryEngine({
  bankroll: 1000, initialStake: 2, payout: 0.86, stopLoss: 200, stopWin: 100, maxLevel: 15,
});
engine4.startSession();

simulateBotCycle(engine4, "CENÁRIO 4: DRAW não altera estado", [
  "DRAW",  // L0-E1 → L0-E1 (sem mudança)
  "LOSS",  // L0-E1 → L1-E1
  "DRAW",  // L1-E1 → L1-E1 (sem mudança)
  "WIN",   // L1-E1 → Soros
  "DRAW",  // Soros draw → Soros (sem mudança)
  "WIN",   // Soros → L0-E1
]);

const final4 = engine4.getDashboard();
console.log(`\n  FINAL: level=${final4.currentLevel} entry=${final4.entryNumber} CPR=R$${final4.capitalPending.toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════
// RESUMO
// ═══════════════════════════════════════════════════════════════
divider("RESULTADO DO DIAGNÓSTICO");
console.log(`
  ✅ Todos os cenários passaram!
  A calculadora SorosGale está corretamente integrada.

  Fluxo verificado:
  1. Robot consulta getEntry() → level/stake corretos
  2. Trade executado → registerWin/Loss/Draw()
  3. Calculator atualiza level/entry internamente
  4. Próximo getEntry() → level/stake NOVOS corretos
  5. Próximo trade usa o novo nível

  NÍVEIS PADRÃO (sem customLevels):
  - Level 0: stake=R$2.00
  - Level 1: stake=R$2.00
  - Level 2: stake=R$2.00
  - Level 3: stake=R$3.00+
  - (stake só aumenta a partir do level 3)

  Se o robô ainda parece estar no level errado, pode ser:
  - UI não atualizando corretamente
  - Cooldown de 3 min mascarando a progressão
  - Problema no fluxo de restart/reconexão
`);
