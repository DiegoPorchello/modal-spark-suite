# Engine de Trading (Flow Robot) - Documentação Detalhada

## Visão Geral

O **FlowRobotEngine** é o orquestrador principal do sistema de trading automatizado. Ele coordena todas as operações desde a análise do mercado até a execução de ordens, passando pelo sistema de decisão e recuperação inteligente.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    FlowRobotEngine                           │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Decision │  │ Smart    │  │Execution │  │ Market   │    │
│  │ Engine   │  │ Recovery │  │ Engine   │  │ Session  │    │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘    │
│        │             │             │             │          │
│        └─────────────┴──────┬──────┴─────────────┘          │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  PumaBrokerAdapter │
                    └───────────────────┘
```

## Ciclo de Vida

### 1. Inicialização

```typescript
const robot = new FlowRobotEngine(broker);

robot.start({
  asset: "BETHUSDT",
  timeframes: ["M1", "M5", "M15"],
  initialBankroll: 1000,
  targetProfit: 100,
  stopLoss: 200,
  autoDirection: true,
});
```

### 2. Fluxo Principal

```
start(config)
    │
    ├──► Inicializa SmartRecovery
    ├──► Inicia ExecutionEngine (50ms polling)
    ├──► Inscreve em candle close events
    ├──► Busca saldo real da Puma
    │
    ▼
_scheduleNextOperation()
    │
    ▼
_onDecisionTime() (~200ms antes do fechamento)
    │
    ├──► Risk checks (stop loss, profit target)
    ├──► SmartRecovery.getEntry()
    ├──► DecisionEngine.analyze()
    │       ├── TrendEngine (EMA alignment)
    │       ├── StructureEngine (Suporte/Resistência)
    │       ├── PriceActionEngine (Padrões de candle)
    │       ├── SmartMoneyEngine (FVG, liquidity)
    │       ├── MomentumEngine (RSI)
    │       └── ScoreEngine (pesos ponderados)
    │
    ▼
Execução na abertura do candle
    │
    ▼
Aguarda tradeUpdate via Socket.IO
    │
    ▼
Processa WIN/LOSS/DRAW → SmartRecovery
```

## Componentes Principais

### DecisionEngine

Responsável por analisar o mercado e decidir se deve ou não operar.

```typescript
class DecisionEngine {
  analyze(candles: Candle[], config: RobotConfig): DecisionResult {
    // 1. Análise de tendência (EMA)
    const trend = this.trendEngine.analyze(candles);
    
    // 2. Estrutura de mercado (Suporte/Resistência)
    const structure = this.structureEngine.analyze(candles);
    
    // 3. Padrões de candle
    const priceAction = this.priceActionEngine.analyze(candles);
    
    // 4. Smart Money (FVG, liquidity)
    const smartMoney = this.smartMoneyEngine.analyze(candles);
    
    // 5. Momentum (RSI)
    const momentum = this.momentumEngine.analyze(candles);
    
    // 6. Score ponderado
    const score = this.scoreEngine.calculate({
      trend,
      structure,
      priceAction,
      smartMoney,
      momentum,
    });
    
    // 7. Decisão final
    return {
      direction: trend.direction,
      score: score,
      shouldTrade: score >= 80,
    };
  }
}
```

### ScoreEngine

Calcula um score ponderado baseado em múltiplos fatores.

```typescript
class ScoreEngine {
  private weights = {
    continuity: 0.40,   // 40%
    dominance: 0.25,    // 25%
    strength: 0.15,     // 15%
    structure: 0.10,    // 10%
    history: 0.10,      // 10%
  };

  calculate(factors: ScoreFactors): number {
    return (
      factors.continuity * this.weights.continuity +
      factors.dominance * this.weights.dominance +
      factors.strength * this.weights.strength +
      factors.structure * this.weights.structure +
      factors.history * this.weights.history
    );
  }
}
```

### Classificação de Scores

| Score | Classificação | Ação |
|-------|---------------|------|
| 95+ | EXTREMO | Operar com confiança |
| 90+ | PREMIUM | Operar |
| 85+ | FORTE | Operar |
| 80+ | MODERADO | Operar com cautela |
| <80 | IGNORAR | Não operar |

### ExecutionEngine

Motor de alta precisão que sincroniza o clock com o servidor.

```typescript
class ExecutionEngine {
  private _pollingInterval = 50; // 50ms
  private _decisionOffset = 200; // 200ms antes do fechamento

  start(): void {
    this._timer = setInterval(() => {
      const now = Date.now();
      const candleCloseTime = this._getNextCandleCloseTime();
      const timeUntilClose = candleCloseTime - now;
      
      // Dispara decisão 200ms antes do fechamento
      if (timeUntilClose <= this._decisionOffset && !this._decisionFired) {
        this._onDecisionTime();
        this._decisionFired = true;
      }
      
      // Dispara execução na abertura do candle
      if (timeUntilClose <= 0 && this._decisionFired) {
        this._onCandleOpen();
        this._decisionFired = false;
      }
    }, this._pollingInterval);
  }
}
```

### SmartRecoveryEngine

Sistema de recuperação inteligente (detalhado na seção de Calculadora).

```typescript
class SmartRecoveryEngine {
  getEntry(): { stake: number; level: number; entry: number } {
    // Calcula próxima aposta baseado no estado atual
  }

  processResult(result: "WIN" | "LOSS" | "DRAW"): void {
    // Atualiza estado baseado no resultado
  }

  getHealth(): number {
    // Retorna saúde do recovery (0-100%)
  }
}
```

## Modos de Operação

### Single Mode

Opera apenas um ativo por vez.

```typescript
const config: RobotConfig = {
  scanMode: "single",
  asset: "BETHUSDT",
  assets: ["BETHUSDT"],
};
```

### Multi Mode

Scaneia múltiplos ativos simultaneamente.

```typescript
const config: RobotConfig = {
  scanMode: "multi",
  assets: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "BETHUSDT",
    "XRDOGUSDT",
  ],
};
```

## Perfis Operacionais

### Configuração de Candles

```typescript
const profileConfig = {
  AUTO: {
    minCandles: 70,
    fetchSize: 200,
  },
  FOREX: {
    minCandles: 70,
    fetchSize: 200,
  },
  HYBRID_FLOW: {
    minCandles: 70,
    fetchSize: 300,
  },
  HYBRID_PROBABILITY: {
    minCandles: 70,
    fetchSize: 2000,
  },
};
```

## Gestão de Risco

### Stop Loss

```typescript
const profit = currentBankroll - initialBankroll;

if (profit >= targetProfit) {
  this._stopByRisk("Meta de lucro atingida!");
  return;
}

if (-profit >= stopLoss) {
  this._stopByRisk("Stop loss atingido!");
  return;
}
```

### Demo Daily Limit

```typescript
const DEMO_DAILY_LIMIT = 50;

const tradesToday = this._countTradesToday();
if (tradesToday >= DEMO_DAILY_LIMIT) {
  this._stopByRisk("Limite diário da conta demo atingido.");
  return;
}
```

### Cooldown Global

```typescript
private _globalCooldownUntil: number = 0;

private _scheduleNextOperation(delay: number, reason: ScheduleReason): void {
  this._globalCooldownUntil = Date.now() + (delay * 1000);
  
  this._loopTimer = setTimeout(() => {
    this._runOperationCycle();
  }, delay * 1000);
}
```

## Eventos

### Tipos de Evento

```typescript
type RobotEventType =
  | "status-changed"
  | "operation-opened"
  | "operation-closed"
  | "step-changed"
  | "balance-updated"
  | "state-changed"
  | "error"
  | "stopped-by-risk"
  | "draw";
```

### Escutando Eventos

```typescript
robot.on((event) => {
  switch (event.type) {
    case "status-changed":
      console.log("Status:", event.state.status);
      break;
    case "operation-opened":
      console.log("Operação aberta:", event.operation);
      break;
    case "operation-closed":
      console.log("Operação fechada:", event.operation);
      break;
  }
});
```

## Dados de Mercado

### Fontes

| Fonte | Uso | Autenticação |
|-------|-----|--------------|
| Binance WebSocket | Pares forex (mercado aberto) | Pública |
| Puma Socket.IO | Trades/OTC | Cookie |
| Puma WS2 | Ativos híbridos | Cookie |

### Ativos Híbridos

Estes ativos **não existem na Binance**:
- BETHUSDT
- BTSOLUSDT
- MAPEUSDT
- XRDOGUSDT
- XRPSOLUSDT

### Buffer de Candles

```typescript
// Capacidade por perfil
const bufferCapacity = {
  AUTO: 500,
  FOREX: 500,
  HYBRID_FLOW: 300,
  HYBRID_PROBABILITY: 2000,
};

// Mínimo para operar
const minCandles = 70;
```

## Erros Comuns

### 1. "Broker não conectado"

**Causa**: PumaBrokerAdapter não está conectado.

**Correção**: Faça login primeiro.

### 2. "Buffer vazio"

**Causa**: WebSocket não está recebendo dados.

**Correção**: Verifique se Binance WS ou Puma Socket.IO está conectado.

### 3. "Score insuficiente"

**Causa**: Análise retornou score < 80.

**Correção**: Comportamento esperado — aguarde próxima oportunidade.

### 4. "Stop loss atingido"

**Causa**: Perda acumulada ultrapassou limite.

**Correção**: Aguarde novo dia ou ajuste configurações.

### 5. "Race condition"

**Causa**: Múltiplas instâncias processando simultaneamente.

**Correção**: Sistema usa mutex estático `_isProcessing`.

## Melhores Práticas

1. **Inicialização**: Sempre aguarde saldo real antes de operar
2. **Timeframes**: Use M1 para trades rápidos, M5/M15 para maiores
3. **Ativos**: Comece com poucos ativos e adicione gradualmente
4. **Monitoramento**: Acompanhe logs e métricas continuamente
5. **Backup**: Tenha um plano B caso o sistema falhe
