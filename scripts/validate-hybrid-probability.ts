#!/usr/bin/env node
/**
 * scripts/validate-hybrid-probability.ts
 *
 * PHASE XXIII.5 — Offline Validation Script
 *
 * Executa replay determinístico de candles históricos através do
 * HybridProbabilityEngine e gera relatório de validação.
 *
 * Uso:
 *   npx tsx scripts/validate-hybrid-probability.ts [opções]
 *
 * Opções:
 *   --historySize <n>        Tamanho da janela de candles (500, 1000, 2000) [default: 2000]
 *   --probabilityWeight <n>  Peso da probabilidade (0.1-0.4) [default: 0.20]
 *   --asset <symbol>         Ativo para análise [default: EURUSD]
 *   --timeframe <tf>         Timeframe (M1, M5, M15) [default: M1]
 *   --input <dir>            Diretório com arquivos JSON de candles [default: test-data/]
 *   --output <file>          Arquivo de saída do relatório [default: validation-report.txt]
 *   --step <n>               Passo do slide window (candles entre análises) [default: 1]
 *
 * Formato dos arquivos de entrada:
 *   Cada arquivo JSON deve conter um array de objetos Candle:
 *   [{ time, open, high, low, close, volume, asset }, ...]
 *
 * O script NÃO gera WIN/LOSS aleatórios. Para sinais APPROVED com candles
 * suficientes, verifica deterministicamente o resultado comparando com o
 * próximo candle histórico.
 */

import * as fs from "fs";
import * as path from "path";
import { HybridProbabilityEngine } from "../src/engine/decision/HybridProbabilityEngine";
import { DEFAULT_HYBRID_PROBABILITY_CONFIG } from "../src/engine/decision/HybridProbabilityEngine";
import type { HybridProbabilityConfig } from "../src/engine/decision/HybridProbabilityEngine";
import type { Candle } from "../src/market/types";
import { SignalLogger, JsonlSignalStorage } from "../src/engine/statistics/signal-log";
import {
  ENGINE_VERSION,
  DATABASE_VERSION,
  PATTERN_CATALOG_VERSION,
} from "../src/engine/statistics/signal-log";
import { ValidationSummary } from "../src/engine/statistics/validation-summary";

// ═══════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════════

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const key = raw[i].replace(/^--/, "");
    const val = raw[i + 1];
    if (val && !val.startsWith("--")) {
      args[key] = val;
      i++;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function loadCandlesFromDir(dir: string): Map<string, Candle[]> {
  const candlesByAsset = new Map<string, Candle[]>();

  if (!fs.existsSync(dir)) {
    console.error(`❌ Diretório não encontrado: ${dir}`);
    console.error(`   Crie o diretório e adicione arquivos JSON com candles.`);
    console.error(`   Formato: [{ time, open, high, low, close, volume, asset }, ...]`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`❌ Nenhum arquivo .json encontrado em: ${dir}`);
    process.exit(1);
  }

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      const data = JSON.parse(content) as Candle[];
      if (Array.isArray(data) && data.length > 0) {
        const asset = data[0].asset ?? path.basename(file, ".json");
        candlesByAsset.set(asset.toUpperCase(), data);
        console.log(`  ✅ ${file}: ${data.length} candles (${asset})`);
      }
    } catch (err) {
      console.warn(`  ⚠️ ${file}: erro ao ler — ${err}`);
    }
  }

  return candlesByAsset;
}

// ═══════════════════════════════════════════════════════════════════
// DETERMINISTIC OUTCOME: verifica resultado real vs próximo candle
// ═══════════════════════════════════════════════════════════════════

function checkDeterministicOutcome(
  candles: Candle[],
  signalIndex: number,
  direction: "CALL" | "PUT" | null,
): "WIN" | "LOSS" | "DRAW" | null {
  if (!direction) return null;
  if (signalIndex >= candles.length - 1) return null;

  const entryCandle = candles[signalIndex];
  const exitCandle = candles[signalIndex + 1];

  const entryPrice = entryCandle.close;
  const exitPrice = exitCandle.close;

  if (direction === "CALL") {
    return exitPrice > entryPrice ? "WIN" : exitPrice < entryPrice ? "LOSS" : "DRAW";
  } else {
    return exitPrice < entryPrice ? "WIN" : exitPrice > entryPrice ? "LOSS" : "DRAW";
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

function main() {
  const args = parseArgs();
  const historySize = parseInt(args.historySize ?? "2000", 10);
  const probabilityWeight = parseFloat(args.probabilityWeight ?? "0.20");
  const targetAsset = (args.asset ?? "EURUSD").toUpperCase();
  const timeframe = args.timeframe ?? "M1";
  const inputDir = args.input ?? "test-data";
  const outputFile = args.output ?? "validation-report.txt";
  const step = parseInt(args.step ?? "1", 10);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PHASE XXIII.5 — OFFLINE VALIDATION");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  History Size:       ${historySize}`);
  console.log(`  Probability Weight: ${probabilityWeight}`);
  console.log(`  Asset:              ${targetAsset}`);
  console.log(`  Timeframe:          ${timeframe}`);
  console.log(`  Input:              ${inputDir}`);
  console.log(`  Output:             ${outputFile}`);
  console.log(`  Step:               ${step}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  // Load candle data
  console.log("📂 Carregando candles...");
  const allCandles = loadCandlesFromDir(inputDir);
  console.log(`  ${allCandles.size} ativos carregados`);
  console.log("");

  // Filter target asset
  let candles = allCandles.get(targetAsset);
  if (!candles) {
    const available = [...allCandles.keys()].join(", ");
    console.error(`❌ Ativo "${targetAsset}" não encontrado.`);
    console.error(`   Disponíveis: ${available || "nenhum"}`);
    process.exit(1);
  }

  if (candles.length < historySize) {
    console.error(`❌ Ativo "${targetAsset}" tem apenas ${candles.length} candles — mínimo ${historySize} necessário.`);
    process.exit(1);
  }

  console.log(`📊 Processando ${targetAsset}: ${candles.length} candles disponíveis`);
  console.log(`   Janela: ${historySize}, Passo: ${step}`);
  console.log(`   Análises previstas: ${Math.floor((candles.length - historySize) / step) + 1}`);
  console.log("");

  // Configure engine
  const config: HybridProbabilityConfig = {
    ...DEFAULT_HYBRID_PROBABILITY_CONFIG,
    probabilityWeight,
    historySize,
  };

  const engine = new HybridProbabilityEngine();

  // Create a temporary storage for this run (not the global singleton)
  const storage = new JsonlSignalStorage();
  const logger = new SignalLogger(storage);

  // Run analysis loop
  let analyzed = 0;
  let approved = 0;
  const startTime = performance.now();

  for (let i = historySize; i <= candles.length - 1; i += step) {
    const window = candles.slice(i - historySize, i);
    const result = engine.analyze(window, targetAsset, timeframe, config);

    // Deterministic outcome for approved signals
    let outcome: "WIN" | "LOSS" | "DRAW" | null = null;
    if (result.signalStatus === "APPROVED" && result.direction) {
      outcome = checkDeterministicOutcome(candles, i - 1, result.direction);
    }

    logger.log({
      engineVersion: ENGINE_VERSION,
      databaseVersion: DATABASE_VERSION,
      patternCatalogVersion: PATTERN_CATALOG_VERSION,
      asset: targetAsset,
      timeframe,
      status: result.signalStatus,
      direction: result.direction,
      blockedReasons: result.blockedReasons,
      setup: result.setup,
      indicators: result.indicators,
      pattern: {
        id: "continuity-2c",
        name: "2 Candle Continuation",
        occurrences: result.historicalPatterns,
        winRate: result.historicalWinrate ?? 0,
        confidence: result.probabilityScore.breakdown.confidence,
      },
      scores: {
        technicalScore: result.technicalScore.total,
        probabilityScore: result.probabilityScore.total,
        decisionScore: result.decisionScore.total,
        probabilityWeight,
      },
      filters: result.signalFilters,
      config,
      candlesUsed: result.candlesUsed,
      processingTimeMs: result.processingTimeMs,
      result: outcome,
      orderId: null,
      decisionId: null,
      decisionTree: result.decisionTree,
    });

    analyzed++;
    if (result.signalStatus === "APPROVED") approved++;

    // Progress indicator
    if (analyzed % 100 === 0) {
      process.stdout.write(`\r  📈 ${analyzed} análises processadas...`);
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(`\r  ✅ ${analyzed} análises processadas em ${elapsed.toFixed(0)}ms`);
  console.log(`     ${approved} sinais aprovados (${((approved / analyzed) * 100).toFixed(1)}%)`);
  console.log("");

  // Generate report
  console.log("📋 Gerando relatório...");
  const entries = logger.getAll();
  const summary = new ValidationSummary(entries);
  const metrics = summary.compute();
  const report = ValidationSummary.formatReport(metrics);

  // Print to console
  console.log(report);

  // Write to file
  fs.writeFileSync(outputFile, report, "utf-8");
  console.log(`\n📄 Relatório salvo em: ${outputFile}`);

  // Also save the full JSONL for PHASE XXIV
  const jsonlFile = outputFile.replace(".txt", ".jsonl");
  const jsonlContent = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(jsonlFile, jsonlContent, "utf-8");
  console.log(`📄 JSONL salvo em: ${jsonlFile}`);
}

main();
