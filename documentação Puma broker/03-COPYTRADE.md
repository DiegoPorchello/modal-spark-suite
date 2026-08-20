# CopyTrade - Documentação Detalhada

## Visão Geral

O CopyTrade é um sistema de cópia automática de ordens entre contas. Quando uma ordem é executada na conta principal, ela automaticamente é replicada em uma ou mais contas de cópia.

## Arquitetura

```
┌─────────────────────┐
│  Conta Principal     │
│                      │
│  TradesAPI.place_    │
│  order()             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CopyTrade Manager   │
│                      │
│  _copy_sessions      │
│  _copy_enabled       │
│  _copy_user_confirmed│
└──────────┬──────────┘
           │
    ┌──────┼──────┐
    │      │      │
    ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐
│Conta ││Conta ││Conta │
│Cópia1││Cópia2││CópiaN│
└──────┘└──────┘└──────┘
```

## Flags de Segurança

### _copy_enabled

```python
_copy_enabled: bool = False
```

- Flag principal de ativação
- Controla se o copy trade está ativo

### _copy_user_confirmed

```python
_copy_user_confirmed: bool = False
```

- **CRÍTICO**: Só é `True` quando o usuário ativa explicitamente via UI
- **NUNCA** é persistido em arquivo
- **SEMPRE** inicia como `False` a cada reinício do daemon

### Motivo da Segurança

```python
# Na inicialização do daemon
self._copy_user_confirmed = False  # SEMPRE False
```

Isso impede que o copy trade execute acidentalmente ao reiniciar o daemon.

## Fluxo de Execução

### 1. Ativação via UI

```typescript
// Frontend - Toggle de CopyTrade
const handleToggleCopy = async () => {
  await fetch("http://127.0.0.1:3001/copy/enable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  });
};
```

### 2. Daemon Processa

```python
@app.route("/copy/enable", methods=["POST"])
def enable_copy():
    data = request.json
    daemon._copy_enabled = data.get("enabled", False)
    
    # CRÍTICO: Só ativa se usuário confirmou
    if daemon._copy_enabled:
        daemon._copy_user_confirmed = True
    
    return {"enabled": daemon._copy_enabled}
```

### 3. Execução de Trade

```python
def place_trade(self, symbol, direction, amount, entry_price, ...):
    # 1. Trade na conta principal
    main_result = self._main_trades_api.place_order(
        symbol=symbol,
        direction=direction,
        amount=amount,
        entry_price=entry_price,
        ...
    )
    
    # 2. Verifica se copy está ativo
    if not self._copy_enabled or not self._copy_user_confirmed:
        return main_result
    
    # 3. Executa copy em threads separadas
    for session in self._copy_sessions:
        if session.is_active and session.has_valid_auth():
            thread = threading.Thread(
                target=self._executar_copy_em_thread,
                args=(session, symbol, direction, amount, entry_price, ...)
            )
            thread.start()
    
    return main_result
```

### 4. Thread de Cópia

```python
def _executar_copy_em_thread(self, session, symbol, direction, amount, entry_price, ...):
    try:
        # 1. Verifica autenticação
        if not session.is_authenticated():
            session.login()
        
        # 2. Executa trade
        result = session.trades_api.place_order(
            symbol=symbol,
            direction=direction,
            amount=amount,
            entry_price=entry_price,
            ...
        )
        
        # 3. Log do resultado
        self._copy_log_buffer.append({
            "timestamp": time.time(),
            "account": session.email,
            "symbol": symbol,
            "direction": direction,
            "result": result
        })
        
    except Exception as e:
        # 4. Retry em caso de 401
        if "401" in str(e):
            session.login()
            # Retry...
```

## Detecção de Duplicatas

```python
def _is_duplicate(self, symbol, direction, amount, entry_price):
    """Verifica se trade já foi executado nos últimos 30s"""
    
    now = time.time()
    for log in self._copy_log_buffer:
        if (log["symbol"] == symbol and
            log["direction"] == direction and
            log["amount"] == amount and
            abs(log["entry_price"] - entry_price) < 0.0001 and
            now - log["timestamp"] < 30):
            return True
    
    return False
```

## Sessões de Cópia

### Estrutura

```json
[
  {
    "email": "conta2@email.com",
    "password": "senha2",
    "enabled": false,
    "lastUsed": "2026-07-05T10:00:00Z"
  },
  {
    "email": "conta3@email.com",
    "password": "senha3",
    "enabled": false,
    "lastUsed": "2026-07-05T10:00:00Z"
  }
]
```

### Persistência

- Arquivo: `.copy_sessions.json`
- **NUNCA** salva `enabled: true`
- **SEMPRE** inicia como `false`

### Lazy Login

```python
class CopySession:
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self._auth = None
        self._trades_api = None
    
    def login(self):
        """Login só acontece quando necessário"""
        self._auth = PumaBrokerAuth(self.email, self.password)
        self._auth.login()
        self._trades_api = TradesAPI(self._auth)
    
    def is_authenticated(self):
        return self._auth is not None and self._auth.is_valid()
```

## Endpoints da API

### Listar Sessões

```
GET /copy/sessions
```

Resposta:
```json
{
  "sessions": [
    {
      "email": "conta2@email.com",
      "enabled": false,
      "lastUsed": "2026-07-05T10:00:00Z"
    }
  ]
}
```

### Adicionar Sessão

```
POST /copy/sessions
```

Payload:
```json
{
  "email": "conta4@email.com",
  "password": "senha4"
}
```

### Remover Sessão

```
DELETE /copy/sessions/{email}
```

### Ativar/Desativar

```
POST /copy/enable
```

Payload:
```json
{
  "enabled": true
}
```

### Logs de Cópia

```
GET /copy/logs
```

Resposta:
```json
{
  "logs": [
    {
      "timestamp": 1783300000,
      "account": "conta2@email.com",
      "symbol": "BETHUSDT",
      "direction": "CALL",
      "result": {"status": "success", "orderId": "12345"}
    }
  ]
}
```

## Erros Comuns

### 1. "Copy trade não executa"

**Causa**: `_copy_user_confirmed` é `False`.

**Correção**: Ative o copy trade via toggle na UI.

### 2. "Sessão não autenticada"

**Causa**: Login da conta cópia falhou.

**Correção**: Verifique credenciais e status da conta.

### 3. "HTTP 401 na conta cópia"

**Causa**: Token da conta cópia expirou.

**Correção**: Sistema faz retry com fresh login.

### 4. "Trade duplicado"

**Causa**: Mesmo trade executado nos últimos 30s.

**Correção**: Comportamento esperado — detecção de duplicatas.

## Melhores Práticas

1. **Segurança**: Nunca ative copy trade automaticamente
2. **Lazy Login**: Faça login apenas quando necessário
3. **Threads**: Use threads separadas para cada conta cópia
4. **Logging**: Registre todos os trades copiados
5. **Retry**: Implemente retry com backoff em caso de falha
6. **Timeout**: Defina timeout para operações de rede
