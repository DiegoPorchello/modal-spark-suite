# Puma V2 - Documentação Completa do Projeto

## Índice Geral

1. [Visão Geral do Projeto](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura)
3. [Login PumaBroker](#login)
4. [Sistema de Tokens](#tokens)
5. [CopyTrade](#copytrade)
6. [Calculadora Smart Recovery](#calculadora)
7. [Engine de Trading (Flow Robot)](#engine)
8. [Variáveis de Ambiente](#variaveis)
9. [Configuração e Inicialização](#configuracao)
10. [Erros Comuns e Correções](#erros)
11. [Guia Rápido para Novos Projetos](#guia-rapido)

---

## Visão Geral do Projeto

O **Puma V2** (nome interno: `modal-spark-suite`) é um sistema de trading automatizado para a plataforma **Puma Broker**. O projeto integra:

- **Frontend**: React + TypeScript (TanStack Start + Vite)
- **Backend Local**: Python daemon (proxy HTTP + WebSocket)
- **Trading Engine**: Motor de decisão com Smart Recovery (Martingale avançado)
- **CopyTrade**: Sistema de cópia automática de ordens entre contas
- **Dados de Mercado**: Binance WebSocket + Puma WS2 + Socket.IO

### Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, TypeScript, TanStack Router, Tailwind CSS 4, Vite 8 |
| Backend | Python 3, Flask/HTTP Server, WebSocket |
| Database | Supabase (PostgreSQL) |
| UI Components | Radix UI, Recharts, Lucide Icons |
| State Management | Zustand, React Context |
| Build | Vite, Electron (desktop) |

---

## Arquitetura do Sistema

### Diagrama de Portas

```
Porta 5173:  Vite Dev Server (Frontend TypeScript)
Porta 3001:  proxy_daemon.py (Proxy HTTP + Socket.IO + CopyTrade)
Porta 3002:  ws_proxy.py (WebSocket Proxy → wsmt5.pumabroker.com)
```

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVEGADOR (Frontend)                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ PumaBroker│  │ FlowRobot│  │SmartRecov│  │ CopyTrade│    │
│  │ Adapter   │  │ Engine   │  │ Engine   │  │ Manager  │    │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘    │
│        │             │             │             │          │
│        └─────────────┴──────┬──────┴─────────────┘          │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  proxy_daemon.py   │
                    │     (Porta 3001)   │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼───────┐ ┌──────▼──────┐ ┌───────▼───────┐
    │ trade.puma-   │ │ wsm5.puma-  │ │ Socket.IO     │
    │ broker.com    │ │ broker.com  │ │ /trades,/otc  │
    │ (REST API)    │ │ (WS Candles)│ │ (WS Events)   │
    └───────────────┘ └─────────────┘ └───────────────┘
```

### Por que o Proxy é Necessário

O browser tem duas limitações de segurança:
1. **CORS**: `trade.pumabroker.com` não libera todas as origens
2. **WebSocket Headers**: O browser não permite enviar `Cookie` customizado no handshake WebSocket

O Python roda fora do browser e não tem essas restrições.

---

## Login PumaBroker

### Fluxo Completo

```
Frontend → connectWithCredentials(email, password, accountType)
    │
    ▼
POST http://127.0.0.1:3001/login  (proxy_daemon.py)
    │
    ▼
POST https://trade.pumabroker.com/api/v1/auth/login
    │
    ▼
Response: { accessToken, refreshToken, user }
    │
    ▼
GET /api/v1/users/{id} → Extrai cookie server_name_session
    │
    ▼
Retorna para Frontend: { user, token, ws2Session }
```

### Payload de Login

```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

### Response de Login

```json
{
  "user": {
    "id": "28318",
    "email": "usuario@email.com",
    "name": "NOME COMPLETO",
    "balance": 0,
    "demoBalance": 9998,
    "isDemo": true,
    "isVip": true,
    "vipLevel": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Campos Importantes

| Campo | Uso |
|-------|-----|
| `token` | JWT Bearer — usado em TODOS os requests REST |
| `user.id` | account_id — usado no subscribe do Socket.IO |
| `user.balance` | Saldo da conta real |
| `user.demoBalance` | Saldo da conta demo |

### Proteção HTTP 429

Tanto o Python quanto o TypeScript implementam **exponential backoff com jitter** para respostas HTTP 429 (Too Many Requests).

- Python: usa `_login_backoff_until` timestamp global
- TypeScript: tracks `_lastAuthError429` com backoff

**NUNCA reinicie o daemon repetidamente se receber 429 — aguarde o backoff.**

---

## Sistema de Tokens

### Token Manager Python (`pumabroker/token_manager.py`)

Persiste em `puma_tokens.json`:
- `accessToken`
- `refreshToken`
- `user_id`
- `email`
- `expires_at`
- `issued_at`

**Fluxo `get_access_token()`:**
1. Token válido (não expirado com 300s buffer) → retorna
2. Token expirado → tenta refresh via `POST /api/v1/auth/refresh`
3. Refresh falha → login completo via email/password

### Token Manager TypeScript (`src/broker/puma-token-manager.ts`)

Armazena no `localStorage` (chave: `puma_token_data`):
- Token JWT + dados do usuário + ws2Session

### Auto-Renovação JWT

- `PumaSocketClient` agenda renovação 5 minutos antes da expiração
- `PumaBrokerAdapter._refreshJwt()` faz re-login real quando JWT expira
- WS2 session token é renovado via daemon `/ws2-session?force=1`

### Renovação Manual

O JWT expira em ~24h. Para renovar:
```bash
# Chamar POST /login novamente com as mesmas credenciais
curl -X POST http://127.0.0.1:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"senha"}'
```

---

## CopyTrade

### Arquitetura

```
Conta Principal
    │
    ├──► Trade via TradesAPI.place_order()
    │
    ▼
CopyTrade Manager (_copy_sessions)
    │
    ├──► Conta Cópia 1 → TradesAPI.place_order() (thread separada)
    ├──► Conta Cópia 2 → TradesAPI.place_order() (thread separada)
    └──► Conta Cópia N → TradesAPI.place_order() (thread separada)
```

### Como Funciona

1. **Ativação**: Usuário clica no toggle de CopyTrade na UI
2. **Flag `_copy_user_confirmed`**: Só é `true` quando o usuário ativa explicitamente
3. **Execução**: Cada conta cópia usa sua própria instância `PumaBrokerAuth` + `TradesAPI`
4. **Sessões Lazy**: Login não acontece até que o copy trade seja ativado
5. **Persistência**: Sessões salvas em `.copy_sessions.json` (NUNCA salva `enabled: true`)

### Segurança

- Flag `_copy_user_confirmed` é resetada a cada reinício do daemon
- Detecção de duplicatas: mesmo asset+direction+amount+entryPrice dentro de 30s
- Retry automático em HTTP 401 com fresh login

### Arquivo de Sessões

`.copy_sessions.json`:
```json
[
  {
    "email": "conta2@email.com",
    "password": "senha2",
    "enabled": false,
    "lastUsed": "2026-07-05T10:00:00Z"
  }
]
```

---

## Calculadora Smart Recovery

### O que é

O **Smart Recovery** é um sistema de recuperação de perdas baseado em **Soros Gale** (variante avançada de Martingale).

### Configuração

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `initialStake` | 2 | Valor da aposta inicial |
| `payout` | 0.86 | Retorno esperado (86%) |
| `stopLoss` | 50 | Perda máxima antes de parar |
| `maxLevels` | 10 | Níveis máximos de recuperação |

### Máquina de Estados (FSM)

```
N0-E1 → (WIN) → N0-E2 → (WIN) → N0-E1 (reset)
   │                 │
   ▼ (LOSS)          ▼ (LOSS)
N1-E1 → (WIN) → N1-E2 → (WIN) → N1-E1
   │
   ▼ (LOSS)
N2-E1 → ...
   │
   ▼ (LOSS)
STOP
```

### Estados

| Estado | Significado |
|--------|-------------|
| `N0-E1` | Nível 0, Entrada 1 (aposta inicial) |
| `N0-E2` | Nível 0, Entrada 2 (soros) |
| `N1-E1` | Nível 1, Entrada 1 (recuperação) |
| `STOP` | Stop loss atingido |
| `FINALIZADO` | Níveis máximos esgotados |

### Lógica de Cálculo

**Entrada 1:**
```
stake = recoveryBudget / payout
```

**Entrada 2 (Soros):**
```
stake = entry1Stake + (entry1Stake * payout)
```

**Saúde do Recovery:**
```
healthPercent = stopAvailable / stopLoss * 100
```

| Saúde | Label |
|-------|-------|
| 80%+ | Confortável |
| 60%+ | Atenção |
| 30%+ | Crítico |
| <30% | Limite atingido |

### Arquivos Principais

- `src/calculator/smart-recovery-engine.ts` (304 linhas)
- `src/calculator/sorosgale-calculator.ts` (105 linhas)
- `src/calculator/types.ts` (110 linhas)
- `src/modules/smart-recovery/SmartRecoveryEngine.ts` (versão avançada)

---

## Engine de Trading (Flow Robot)

### Ciclo de Vida

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

### Sistema de Scores

| Score | Classificação | Ação |
|-------|---------------|------|
| 95+ | EXTREMO | Operar com confiança |
| 90+ | PREMIUM | Operar |
| 85+ | FORTE | Operar |
| 80+ | MODERADO | Operar com cautela |
| <80 | IGNORAR | Não operar |

### Pesos do ScoreEngine

| Componente | Peso |
|------------|------|
| Continuity | 40% |
| Dominance | 25% |
| Strength | 15% |
| Structure | 10% |
| History | 10% |

### Modos de Operação

| Modo | Descrição |
|------|-----------|
| `single` | Opera apenas um ativo por vez |
| `multi` | Scaneia múltiplos ativos |

### Perfis Operacionais

| Perfil | Candles Mínimos | Fetch Size |
|--------|-----------------|------------|
| AUTO | 70 | 200 |
| FOREX | 70 | 200 |
| HYBRID_FLOW | 70 | 300 |
| HYBRID_PROBABILITY | 70 | 2000 |

### Ativos Híbridos (Puma)

Estes ativos **não existem na Binance** — recebem dados via REST + WS2:
- BETHUSDT
- BTSOLUSDT
- MAPEUSDT
- XRDOGUSDT
- XRPSOLUSDT

---

## Variáveis de Ambiente

### Frontend (`.env`)

| Variável | Propósito |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima do Supabase |
| `VITE_ELELABS_API_KEY` | Chave API ElevenLabs |
| `VITE_WS2_PROXY_URL` | URL do proxy WS2 (padrão: `ws://127.0.0.1:3002`) |

### Python (`pumabroker-api/.env`)

| Variável | Propósito |
|----------|-----------|
| `PUMA_EMAIL` | Email de login PumaBroker |
| `PUMA_PASSWORD` | Senha de login PumaBroker |
| `PUMA_SESSION` | Cookie de sessão legado |
| `LOG_LEVEL` | Nível de log Python (padrão: INFO) |

### Bot (`bot.py`)

| Variável | Propósito | Padrão |
|----------|-----------|--------|
| `SYMBOL` | Símbolo de trading | BETHUSDT |
| `TIMEFRAME` | Timeframe | M1 |
| `AMOUNT` | Valor da aposta | 2 |
| `WALLET` | Tipo de conta | DEMO |
| `MAX_TRADES` | Máximo de trades abertos | 1 |
| `STOP_LOSS` | Stop loss diário | 20 |
| `COOLDOWN_MS` | Cooldown em ms | 5000 |

---

## Configuração e Inicialização

### Pré-requisitos

1. Python 3.10+ instalado
2. Node.js 18+ instalado
3. Dependências Python: `pip install -r requirements.txt`
4. Dependências Node: `npm install`

### Comando Único (Recomendado)

```bash
npm run start:all
```

Sobe na ordem:
1. `proxy_daemon.py` (porta 3001)
2. `ws_proxy.py` (porta 3002) — aguarda 3s
3. `npm run dev` (frontend) — aguarda 3s

### Inicialização Manual (Debug)

```bash
# Terminal 1 - Daemon
npm run daemon

# Terminal 2 - WS Proxy
npm run wsproxy

# Terminal 3 - Frontend
npm run dev
```

### Verificação

Após subir, confirmar no console do browser:
```
[WS2] Conectado via proxy ws://127.0.0.1:3002
_fetchHybridHistory: XRDOGUSDT — 200 candles alimentados no buffer
[FlowRobot] SCAN XRDOGUSDT: OK (count: 200)
```

### Scripts NPM

```json
{
  "dev": "node scripts/dev.mjs",
  "build": "vite build",
  "daemon": "python pumabroker-api/proxy_daemon.py --port 3001 --no-ws",
  "wsproxy": "python pumabroker-api/ws_proxy.py --port 3002",
  "services": "start.bat",
  "start:all": "npm run services && timeout /t 3 /nobreak && npm run dev",
  "electron:dev": "electron electron/main.cjs",
  "build:desktop": "node scripts/build-desktop.mjs"
}
```

---

## Erros Comuns e Correções

### 1. "Daemon offline" / Connection Timeout

**Causa**: `proxy_daemon.py` não está rodando na porta 3001.

**Correção**:
```bash
cd pumabroker-api
python proxy_daemon.py --port 3001 --no-ws
```

### 2. HTTP 429 Too Many Requests

**Causa**: Muitas tentativas de login. Puma limita autenticação.

**Correção**: Aguarde o período de backoff (exponencial, até 60s). O sistema trata isso automaticamente. **NÃO reinicie o daemon repetidamente.**

### 3. HTTP 401 Unauthorized

**Causa**: Token JWT expirado.

**Correção**: O sistema auto-renova via re-login. Se persistente, limpe:
- `puma_tokens.json`
- `puma_token_data` do localStorage

### 4. "WS2: cookie server_name_session AUSENTE"

**Causa**: Login não retornou o cookie necessário para WS2.

**Correção**: O daemon busca via `GET /api/v1/users/{id}`. Se persistir, verifique se a conta está verificada.

### 5. WS2 AUTH Failed

**Causa**: Sessão WS2 expirou ou chave estática mudou.

**Correção**: Sistema tenta refresh via `GET /ws2-session?force=1`. Se a chave estática mudou, atualize em `ws_proxy.py`.

### 6. Buffer Empty / No Candles

**Causa**: WebSocket não recebendo dados ou buffer não atingiu mínimo (70 candles).

**Correção**: Verifique se Binance WS (mercado aberto) ou Puma Socket.IO (mercado fechado) está conectado. Para ativos híbridos, verifique se o proxy WS2 (porta 3002) está rodando.

### 7. "Robô não iniciou / Saldo insuficiente"

**Causa**: Falha ao buscar saldo real após múltiplas tentativas.

**Correção**: Verifique conectividade de rede e status da conta PumaBroker. Sistema retenta até 10 vezes com intervalo de 10s.

### 8. Duplicate Trade / Race Condition

**Causa**: Múltiplas janelas de decisão disparando simultaneamente.

**Correção**: Sistema usa mutex estático (`_isProcessing`) e verificações de idempotência. Verifique o mapa `_lastProcessedCandle` se persistir.

### 9. Portas em Conflito (3001/3002/5173)

**Causa**: Processos anteriores ainda rodando.

**Correção**: `start.bat` mata processos automaticamente. Fix manual:
```bash
netstat -ano | findstr :3001
taskkill /F /PID <pid>
```

### 10. Copy Trade Não Executa

**Causa**: Flag `_copy_user_confirmed` é `false`.

**Correção**: Ative o copy trade via toggle na UI. A flag reseta a cada reinício do daemon.

---

## Guia Rápido para Novos Projetos

### Checklist de Implementação

- [ ] Criar proxy daemon Python (porta 3001)
- [ ] Criar WebSocket proxy (porta 3002)
- [ ] Implementar login flow com JWT
- [ ] Implementar auto-renovação de token
- [ ] Implementar WebSocket para dados de mercado
- [ ] Implementar sistema de scores/decisão
- [ ] Implementar sistema de recuperação (Smart Recovery)
- [ ] Implementar CopyTrade com threads
- [ ] Criar frontend React com dashboard
- [ ] Configurar variáveis de ambiente
- [ ] Implementar tratamento de erros (429, 401, timeouts)
- [ ] Implementar logs detalhados

### Estrutura de Pastas Recomendada

```
projeto/
├── frontend/           # React/TypeScript
│   ├── src/
│   │   ├── broker/     # Integração com API
│   │   ├── engine/     # Motor de decisão
│   │   ├── calculator/ # Calculadora de recovery
│   │   └── modules/    # Módulos funcionais
│   └── .env
├── backend/            # Python daemon
│   ├── proxy_daemon.py
│   ├── ws_proxy.py
│   ├── pumabroker/     # SDK da API
│   └── .env
└── docs/               # Documentação
```

### Padrões Importantes

1. **Proxy Pattern**: Sempre usar proxy Python para contornar CORS e WebSocket restrictions
2. **Token Refresh**: Implementar auto-renovação 5min antes da expiração
3. **Idempotência**: Usar timestamps de candles para evitar trades duplicados
4. **Mutex**: Usar locks estáticos para evitar conditions de race
5. **Backoff**: Implementar exponential backoff para HTTP 429
6. **Logging**: Log detalhado para debugging em produção

### Referências de Código

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/engine/flow-robot-engine.ts` | 4162 | Orquestrador principal |
| `src/broker/puma-broker-adapter.ts` | ~1200 | Integração com API |
| `pumabroker-api/proxy_daemon.py` | ~1650 | Backend Python |
| `src/calculator/smart-recovery-engine.ts` | 304 | Calculadora de recovery |
| `src/engine/decision/DecisionEngine.ts` | ~800 | Motor de decisão |

---

*Documentação gerada em Agosto 2026 — Puma V2 Project*
