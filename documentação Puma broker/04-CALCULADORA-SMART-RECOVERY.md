# Calculadora Smart Recovery - Documentação Detalhada

## Visão Geral

O **Smart Recovery** é um sistema avançado de recuperação de perdas baseado em **Soros Gale** (uma variante inteligente de Martingale). Diferente do Martingale tradicional que apenas dobra a aposta após cada perda, o Smart Recovery usa uma máquina de estados finitos (FSM) para gerenciar níveis de recuperação de forma mais eficiente.

## Conceitos Fundamentais

### Soros Gale

O Soros Gale é uma estratégia onde:
1. Após uma **perda**, aumenta-se a aposta para recuperar a perda + lucro
2. Após uma **vitória na Entry 1**, aposta-se mais uma vez (Entry 2) para maximizar lucro
3. O ciclo continua até atingir o stop loss ou níveis máximos

### Diferença do Martingale

| Aspecto | Martingale | Soros Gale |
|---------|------------|------------|
| Após WIN | Reseta para aposta inicial | Continua com Entry 2 |
| Risco | Cresce exponencialmente | Controlado por níveis |
| Recuperação | Lenta | Mais rápida |
| Complexidade | Simples | FSM com estados |

## Máquina de Estados (FSM)

### Estados

```
┌─────────┐    WIN     ┌─────────┐    WIN     ┌─────────┐
│  N0-E1  │ ──────────►│  N0-E2  │ ──────────►│  N0-E1  │
│         │            │         │            │ (reset) │
└────┬────┘            └────┬────┘            └─────────┘
     │                      │
     │ LOSS                 │ LOSS
     ▼                      ▼
┌─────────┐            ┌─────────┐
│  N1-E1  │            │  N1-E2  │
│         │            │         │
└────┬────┘            └────┬────┘
     │                      │
     │ LOSS                 │ LOSS
     ▼                      ▼
┌─────────┐            ┌─────────┐
│  N2-E1  │            │  N2-E2  │
│         │            │         │
└────┬────┘            └────┬────┘
     │                      │
     ▼                      ▼
   STOP                   STOP
```

### Nomenclatura

- **N**: Nível de recuperação (0, 1, 2, ...)
- **E**: Entrada (1 ou 2)
- **N0-E1**: Nível 0, Entrada 1 (aposta inicial)
- **N0-E2**: Nível 0, Entrada 2 (soros)
- **N1-E1**: Nível 1, Entrada 1 (primeira recuperação)

## Configuração

### Parâmetros

```typescript
interface SmartRecoveryConfig {
  initialStake: number;    // Aposta inicial (padrão: 2)
  payout: number;          // Retorno esperado (padrão: 0.86 = 86%)
  stopLoss: number;        // Perda máxima antes de parar (padrão: 50)
  maxLevels: number;       // Níveis máximos de recuperação (padrão: 10)
}
```

### Valores Padrão

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `initialStake` | 2 | Valor da aposta inicial |
| `payout` | 0.86 | 86% de retorno |
| `stopLoss` | 50 | Perda máxima |
| `maxLevels` | 10 | Níveis máximos |

## Lógica de Cálculo

### Entry 1 (Aposta Normal)

```typescript
function calculateEntry1(recoveryBudget: number, payout: number, initialStake: number): number {
  // Stake = recoveryBudget / payout
  // Mínimo: initialStake
  const stake = recoveryBudget / payout;
  return Math.max(stake, initialStake);
}
```

**Exemplo:**
- `recoveryBudget = 10`
- `payout = 0.86`
- `stake = 10 / 0.86 = 11.63`

### Entry 2 (Soros)

```typescript
function calculateEntry2(entry1Stake: number, payout: number): number {
  // Stake = entry1Stake + (entry1Stake * payout)
  // Cobre a perda da Entry 1 + lucro
  return entry1Stake + (entry1Stake * payout);
}
```

**Exemplo:**
- `entry1Stake = 11.63`
- `payout = 0.86`
- `stake = 11.63 + (11.63 * 0.86) = 21.63`

### Recovery Budget

```typescript
function calculateRecoveryBudget(level: number, initialStake: number, payout: number): number {
  // Budget acumulado para recuperação
  let budget = 0;
  for (let i = 0; i <= level; i++) {
    budget += initialStake * Math.pow(1 + payout, i);
  }
  return budget;
}
```

## Saúde do Recovery

### Cálculo

```typescript
function calculateHealth(stopAvailable: number, stopLoss: number): number {
  return (stopAvailable / stopLoss) * 100;
}
```

### Classificações

| Saúde | Label | Cor | Ação |
|-------|-------|-----|------|
| 80%+ | Confortável | Verde | Operar normalmente |
| 60%+ | Atenção | Amarelo | Operar com cautela |
| 30%+ | Crítico | Laranja | Reduzir exposição |
| <30% | Limite atingido | Vermelho | Considerar parar |

## Exemplo Prático

### Configuração

```
initialStake = 2
payout = 0.86
stopLoss = 50
maxLevels = 10
```

### Cenário 1: Sequência de Perdas

```
Nível 0, Entry 1: Stake = 2 → LOSS
  → Perda acumulada: 2
  → Recovery Budget: 2

Nível 1, Entry 1: Stake = 2/0.86 = 2.33 → LOSS
  → Perda acumulada: 4.33
  → Recovery Budget: 4.33

Nível 2, Entry 1: Stake = 4.33/0.86 = 5.03 → LOSS
  → Perda acumulada: 9.36
  → Recovery Budget: 9.36

Nível 3, Entry 1: Stake = 9.36/0.86 = 10.88 → WIN
  → Lucro: 10.88 * 0.86 = 9.36
  → Perda recuperada!
```

### Cenário 2: Soros (WIN em Entry 1)

```
Nível 0, Entry 1: Stake = 2 → WIN
  → Lucro: 2 * 0.86 = 1.72

Nível 0, Entry 2: Stake = 2 + (2 * 0.86) = 3.72 → WIN
  → Lucro adicional: 3.72 * 0.86 = 3.20
  → Lucro total: 4.92

Reseta para Nível 0, Entry 1
```

## Implementação no Código

### SmartRecoveryEngine (`src/calculator/smart-recovery-engine.ts`)

```typescript
export class SmartRecoveryEngine {
  private config: SmartRecoveryConfig;
  private state: SmartRecoveryState;

  constructor(config: SmartRecoveryConfig) {
    this.config = config;
    this.state = {
      currentLevel: 0,
      currentEntry: 1,
      dailyLoss: 0,
      consecutiveLosses: 0,
      phase: "N0-E1",
    };
  }

  getEntry(): { stake: number; level: number; entry: number } {
    const { currentLevel, currentEntry, recoveryBudget } = this.state;
    
    if (currentEntry === 1) {
      return {
        stake: this._calculateEntry1(recoveryBudget),
        level: currentLevel,
        entry: 1,
      };
    } else {
      return {
        stake: this._calculateEntry2(this._lastEntry1Stake),
        level: currentLevel,
        entry: 2,
      };
    }
  }

  processResult(result: "WIN" | "LOSS" | "DRAW"): void {
    if (result === "WIN") {
      this._handleWin();
    } else if (result === "LOSS") {
      this._handleLoss();
    }
  }

  private _handleWin(): void {
    if (this.state.currentEntry === 1) {
      // WIN na Entry 1 → vai para Entry 2 (soros)
      this.state.currentEntry = 2;
      this.state.recoveryBudget += this._lastEntry1Stake;
    } else {
      // WIN na Entry 2 → reseta ou continua
      if (this.state.recoveryBudget <= 0) {
        this._reset();
      } else {
        this.state.currentEntry = 1;
      }
    }
  }

  private _handleLoss(): void {
    this.state.dailyLoss += this._currentStake;
    this.state.consecutiveLosses++;
    
    // Verifica stop loss
    if (this.state.dailyLoss >= this.config.stopLoss) {
      this.state.phase = "STOP";
      return;
    }
    
    // Próximo nível
    this.state.currentLevel++;
    this.state.currentEntry = 1;
    this.state.recoveryBudget += this._currentStake;
    
    // Verifica níveis máximos
    if (this.state.currentLevel >= this.config.maxLevels) {
      this.state.phase = "FINALIZADO";
    }
  }
}
```

### SorosGaleCalculator (`src/calculator/sorosgale-calculator.ts`)

```typescript
export class SorosGaleCalculator {
  private engine: SmartRecoveryEngine;

  constructor(config: SmartRecoveryConfig) {
    this.engine = new SmartRecoveryEngine(config);
  }

  calculate(stakeHistory: ("WIN" | "LOSS")[]): {
    nextStake: number;
    level: number;
    entry: number;
    health: number;
  } {
    // Processa histórico
    for (const result of stakeHistory) {
      this.engine.processResult(result);
    }

    // Retorna próxima aposta
    const entry = this.engine.getEntry();
    const health = this.engine.getHealth();

    return {
      nextStake: entry.stake,
      level: entry.level,
      entry: entry.entry,
      health: health,
    };
  }
}
```

## Erros Comuns

### 1. "Stop loss atingido"

**Causa**: Perda acumulada ultrapassou `stopLoss`.

**Correção**: Aguarde novo dia ou aumente `stopLoss`.

### 2. "Níveis máximos esgotados"

**Causa**: Todos os níveis de recuperação foram usados.

**Correção**: Aumente `maxLevels` ou ajuste `initialStake`.

### 3. "Stake negativo"

**Causa**: Cálculo retornou valor negativo.

**Correção**: Verifique se `payout` está entre 0 e 1.

### 4. "Health sempre zero"

**Causa**: `stopAvailable` não está sendo atualizado.

**Correção**: Verifique se `processResult()` está sendo chamado.

## Melhores Práticas

1. **Start Bankroll**: Defina um valor que suporte no mínimo 10 níveis
2. **Stop Loss**: Configure entre 20-50% do bankroll inicial
3. **Payout**: Use o payout real da plataforma (geralmente 0.85-0.90)
4. **Monitoramento**: Acompanhe a saúde do recovery continuamente
5. **Teste**: Teste com conta demo antes de usar em conta real
