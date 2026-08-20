# Login PumaBroker - Documentação Detalhada

## Visão Geral

O login é o ponto de entrada para todas as operações na plataforma PumaBroker. O sistema utiliza um daemon Python como proxy para contornar restrições de CORS e WebSocket do browser.

## Fluxo Completo de Login

```
┌─────────────────────┐
│  Frontend (React)    │
│                      │
│  connectWith-        │
│  Credentials()       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /login         │
│  127.0.0.1:3001      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  proxy_daemon.py     │
│                      │
│  PumaDaemon.login()  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST /api/v1/       │
│  auth/login          │
│  trade.pumabroker.com│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Response:           │
│  - accessToken (JWT) │
│  - refreshToken      │
│  - user data         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  GET /api/v1/users/  │
│  {id}                │
│                      │
│  Extrai cookie:      │
│  server_name_session │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Retorna para        │
│  Frontend:           │
│  { user, token,      │
│    ws2Session }      │
└─────────────────────┘
```

## Código do Login

### Frontend (`src/broker/puma-broker-adapter.ts`)

```typescript
private async _login(
  email: string,
  password: string,
  accountType: "real" | "demo"
): Promise<{ user: any; token: string; ws2Session?: string }> {
  // 1. Limpa token cache
  pumaTokenManager.clear();

  // 2. POST para daemon local
  const response = await fetch("http://127.0.0.1:3001/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  // 3. Extrai dados
  const data = await response.json();
  
  // 4. Armazena token
  pumaTokenManager.set({
    token: data.token,
    user: data.user,
    ws2Session: data.ws2Session,
  });

  return data;
}
```

### Backend (`pumabroker-api/proxy_daemon.py`)

```python
def login(self, email: str, password: str) -> dict:
    """Login completo com extração de session cookie"""
    
    # 1. Login via API Puma
    auth = PumaBrokerAuth(email, password)
    login_response = auth.login()
    
    # 2. Busca session cookie para WS2
    user_id = login_response["user"]["id"]
    session_response = auth._session.get(
        f"{API_BASE_URL}/api/v1/users/{user_id}",
        headers={"Authorization": f"Bearer {login_response['token']}"}
    )
    
    # 3. Extrai cookie server_name_session
    ws2_session = None
    for cookie in auth._session.cookies:
        if cookie.name == "server_name_session":
            ws2_session = cookie.value
            break
    
    return {
        "user": login_response["user"],
        "token": login_response["token"],
        "ws2Session": ws2_session
    }
```

## Autenticação REST

Todos os endpoints REST usam:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Origin: https://trade.pumabroker.com
```

### Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/login` | Autenticação |
| GET | `/me` | Perfil do usuário |
| GET | `/accounts` | Lista de contas |
| GET | `/balance` | Saldo atual |
| GET | `/settings` | Configurações |
| GET | `/active` | Ativos disponíveis |
| POST | `/trades` | Abrir ordem |
| GET | `/api/v1/tradingview/history` | Histórico de candles |

## Abrir Ordem

### Payload

```json
{
  "userId": "28318",
  "symbol": "AUDUSD",
  "direction": "CALL",
  "amount": 2,
  "duration": 530,
  "entryPrice": 0.70563,
  "mode": "CANDLE_TIME",
  "payout": 0.85,
  "timeframe": "M15",
  "verify": "gAAAAABqMLMX8x8KnN21gQRKFTf...",
  "wallet": "REAL"
}
```

### Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `userId` | string | ID da conta |
| `symbol` | string | Nome do ativo |
| `direction` | string | `CALL` ou `PUT` |
| `amount` | number | Valor em BRL/USD |
| `duration` | int | Segundos até expiração |
| `entryPrice` | float | Preço atual |
| `mode` | string | Sempre `CANDLE_TIME` |
| `payout` | float | Retorno (ex: 0.85 = 85%) |
| `timeframe` | string | M1, M5, M15, M30, H1 |
| `verify` | string | Token anti-fraude |
| `wallet` | string | REAL ou DEMO |

### Duração por Timeframe

| Timeframe | Segundos Totais | Duration Típico |
|-----------|-----------------|-----------------|
| M1 | 60 | 5–59 |
| M5 | 300 | 5–299 |
| M15 | 900 | 5–899 |
| M30 | 1800 | 5–1799 |
| H1 | 3600 | 5–3599 |

## Proteção HTTP 429

### Python

```python
_login_backoff_until = 0

def login(self, email, password):
    global _login_backoff_until
    
    if time.time() < _login_backoff_until:
        wait = _login_backoff_until - time.time()
        raise Exception(f"Rate limited. Aguarde {wait:.0f}s")
    
    # ... tenta login ...
    
    if response.status == 429:
        _login_backoff_until = time.time() + (2 ** retry_count) * 10
        raise Exception("Too Many Requests")
```

### TypeScript

```typescript
private _lastAuthError429 = 0;

private async _loginWithBackoff(email, password) {
  const now = Date.now();
  if (now < this._lastAuthError429) {
    const wait = this._lastAuthError429 - now;
    throw new Error(`Rate limited. Aguarde ${wait/1000}s`);
  }
  
  // ... tenta login ...
  
  if (response.status === 429) {
    this._lastAuthError429 = Date.now() + (2 ** retryCount) * 10000;
    throw new Error("Too Many Requests");
  }
}
```

## Erros Comuns

### 1. "Email ou senha incorretos"

**Causa**: Credenciais inválidas.

**Correção**: Verifique email e senha no painel PumaBroker.

### 2. HTTP 429

**Causa**: Muitas tentativas de login.

**Correção**: Aguarde o período de backoff. Não reinicie o daemon.

### 3. "Token expirado" (401)

**Causa**: JWT expirou (~24h).

**Correção**: Sistema auto-renova. Se persistente, limpe `puma_tokens.json`.

### 4. "Cookie server_name_session ausente"

**Causa**: Login não retornou o cookie WS2.

**Correção**: Verifique se a conta está verificada e não está bloqueada.

## Segurança

- **NUNCA** compartilhe tokens JWT ou cookies publicamente
- **NUNCA** armazene senhas em texto plano no código
- Use variáveis de ambiente para credenciais
- Tokens expiram em ~24h — implemente auto-renovação
