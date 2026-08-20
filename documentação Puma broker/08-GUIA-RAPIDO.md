# Guia Rápido para Novos Projetos - Documentação Detalhada

## Visão Geral

Este guia serve como referência rápida para criar projetos similares ao Puma V2. Ele resume as melhores práticas, padrões de arquitetura e lições aprendidas.

## Checklist de Implementação

### Fase 1: Infraestrutura

- [ ] Criar proxy daemon Python (porta 3001)
- [ ] Criar WebSocket proxy (porta 3002)
- [ ] Configurar variáveis de ambiente
- [ ] Implementar tratamento de erros (429, 401, timeouts)
- [ ] Implementar logs detalhados

### Fase 2: Autenticação

- [ ] Implementar login flow com JWT
- [ ] Implementar auto-renovação de token
- [ ] Implementar persistência de tokens
- [ ] Implementar proteção HTTP 429

### Fase 3: Dados de Mercado

- [ ] Implementar WebSocket para dados públicos
- [ ] Implementar proxy para dados autenticados
- [ ] Implementar buffer de candles
- [ ] Implementar reconexão automática

### Fase 4: Motor de Trading

- [ ] Implementar sistema de scores/decisão
- [ ] Implementar sistema de recuperação (Smart Recovery)
- [ ] Implementar execução de ordens
- [ ] Implementar gestão de risco

### Fase 5: Funcionalidades

- [ ] Implementar CopyTrade
- [ ] Implementar dashboard em tempo real
- [ ] Implementar histórico de trades
- [ ] Implementar configurações

## Estrutura de Pastas Recomendada

```
projeto/
├── frontend/                    # React/TypeScript
│   ├── src/
│   │   ├── broker/             # Integração com API
│   │   │   ├── puma-broker-adapter.ts
│   │   │   ├── puma-token-manager.ts
│   │   │   ├── puma-socket-client.ts
│   │   │   └── puma-ws2-client.ts
│   │   ├── engine/             # Motor de decisão
│   │   │   ├── flow-robot-engine.ts
│   │   │   ├── decision/
│   │   │   ├── execution/
│   │   │   └── score-calculator.ts
│   │   ├── calculator/         # Calculadora de recovery
│   │   │   ├── smart-recovery-engine.ts
│   │   │   └── sorosgale-calculator.ts
│   │   ├── modules/            # Módulos funcionais
│   │   │   ├── smart-recovery/
│   │   │   ├── analyst/
│   │   │   └── performance/
│   │   ├── market/             # Dados de mercado
│   │   ├── components/         # Componentes UI
│   │   └── routes/             # Rotas TanStack
│   ├── .env
│   └── package.json
├── backend/                     # Python daemon
│   ├── proxy_daemon.py          # Proxy HTTP principal
│   ├── ws_proxy.py              # Proxy WebSocket
│   ├── pumabroker/              # SDK da API
│   │   ├── auth.py              # Autenticação
│   │   ├── token_manager.py     # Gerenciamento de tokens
│   │   ├── trades_api.py        # API de trades
│   │   └── config.py            # Configurações
│   ├── .env
│   └── requirements.txt
└── docs/                        # Documentação
    ├── 00-INDICE-GERAL.md
    ├── 01-LOGIN-PUMABROKER.md
    ├── 02-SISTEMA-DE-TOKENS.md
    ├── 03-COPYTRADE.md
    ├── 04-CALCULADORA-SMART-RECOVERY.md
    ├── 05-ENGINE-DE-TRADING.md
    ├── 06-WEBSOCKET-E-DADOS.md
    ├── 07-VARIAVEIS-E-CONFIGURACAO.md
    └── 08-GUIA-RAPIDO.md
```

## Padrões de Código

### 1. Proxy Pattern

Sempre usar proxy Python para contornar CORS e WebSocket restrictions.

```python
# Backend - Proxy HTTP
@app.route("/api/<path:path>", methods=["GET", "POST", "PUT", "DELETE"])
def proxy(path):
    response = requests.request(
        method=request.method,
        url=f"https://api.original.com/{path}",
        headers=request.headers,
        data=request.get_data(),
    )
    return response.content, response.status_code
```

```typescript
// Frontend - Uso do proxy
const response = await fetch("http://127.0.0.1:3001/api/endpoint");
```

### 2. Token Refresh Pattern

Implementar auto-renovação 5 minutos antes da expiração.

```typescript
class TokenManager {
  private _scheduleRefresh(): void {
    const expiresIn = this._expiresAt - Date.now();
    const refreshIn = Math.max(0, expiresIn - 5 * 60 * 1000);
    
    setTimeout(() => {
      this._refresh();
    }, refreshIn);
  }
}
```

### 3. Idempotency Pattern

Usar timestamps de candles para evitar trades duplicados.

```typescript
private static _lastProcessedCandle: Map<string, number> = new Map();

private _isDuplicate(candle: Candle): boolean {
  const lastTime = FlowRobotEngine._lastProcessedCandle.get(candle.asset);
  return lastTime !== undefined && lastTime >= candle.time;
}
```

### 4. Mutex Pattern

Usar locks estáticos para evitar conditions de race.

```typescript
private static _isProcessing = false;

private async _onDecisionTime(): Promise<void> {
  if (FlowRobotEngine._isProcessing) {
    return; // Já está processando
  }
  
  FlowRobotEngine._isProcessing = true;
  
  try {
    // ... processamento ...
  } finally {
    FlowRobotEngine._isProcessing = false;
  }
}
```

### 5. Backoff Pattern

Implementar exponential backoff para HTTP 429.

```typescript
private _lastError429 = 0;

private async _requestWithBackoff(): Promise<Response> {
  const now = Date.now();
  if (now < this._lastError429) {
    const wait = this._lastError429 - now;
    throw new Error(`Rate limited. Aguarde ${wait/1000}s`);
  }
  
  const response = await fetch(url);
  
  if (response.status === 429) {
    this._lastError429 = Date.now() + (2 ** this._retryCount) * 10000;
    throw new Error("Too Many Requests");
  }
  
  return response;
}
```

### 6. Event Emitter Pattern

Usar eventos para comunicação entre componentes.

```typescript
type RobotEventType = "status-changed" | "operation-opened" | "operation-closed";

class Robot {
  private listeners: Map<RobotEventType, Function[]> = new Map();
  
  on(event: RobotEventType, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    
    return () => {
      this.listeners.set(
        event,
        this.listeners.get(event)!.filter(cb => cb !== callback)
      );
    };
  }
  
  private _emit(event: RobotEventType, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}
```

## Lições Aprendidas

### 1. Nunca Reinicie o Daemon Repetidamente

O HTTP 429 (Too Many Requests) é comum quando se reinicia o daemon muitas vezes. O sistema implementa backoff, mas é melhor evitar isso.

### 2. Sempre Aguarde o Saldo Real

O robô não deve operar até obter o saldo real da conta. Isso evita operações com valores incorretos.

### 3. Use Threads para CopyTrade

Cada conta cópia deve rodar em uma thread separada para evitar bloqueio.

### 4. Implemente Idempotência

Sempre verifique se um candle já foi processado antes de tomar uma decisão.

### 5. Mantenha o Buffer Cheio

O sistema precisa de pelo menos 70 candles no buffer para operar. Aguarde o WebSocket enviar dados suficientes.

### 6. Logue Tudo

Logs detalhados são essenciais para debugging em produção.

### 7. Teste com Conta Demo

Sempre teste novas funcionalidades com conta demo antes de usar em conta real.

## Referências de Código

### Arquivos Principais

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/engine/flow-robot-engine.ts` | 4162 | Orquestrador principal |
| `src/broker/puma-broker-adapter.ts` | ~1200 | Integração com API |
| `pumabroker-api/proxy_daemon.py` | ~1650 | Backend Python |
| `src/calculator/smart-recovery-engine.ts` | 304 | Calculadora de recovery |
| `src/engine/decision/DecisionEngine.ts` | ~800 | Motor de decisão |

### Pontos de Atenção

1. **Timing**: A janela de decisão é de ~200ms antes do fechamento do candle
2. **Buffer**: Mínimo de 70 candles para operar
3. **Saldo**: Sempre usar saldo real, não mock
4. **CopyTrade**: Flag `_copy_user_confirmed` nunca é persistida
5. **Tokens**: JWT expira em ~24h — implemente auto-renovação

## Comandos Úteis

### Inicialização

```bash
# Tudo junto (recomendado)
npm run start:all

# Manual
npm run daemon      # Terminal 1
npm run wsproxy     # Terminal 2
npm run dev         # Terminal 3
```

### Build

```bash
npm run build           # Build web
npm run build:desktop   # Build Electron
```

### Debug

```bash
npm run lint            # Verificar código
npm run format          # Formatar código
```

## Conclusão

Seguindo este guia e os padrões documentados, você poderá criar projetos similares ao Puma V2 de forma mais rápida e eficiente. Lembre-se sempre de:

1. Priorizar segurança (tokens, credenciais)
2. Implementar tratamento de erros robusto
3. Usar logs detalhados
4. Testar extensivamente
5. Documentar suas decisões

---

*Guia gerado em Agosto 2026 — Puma V2 Project*
