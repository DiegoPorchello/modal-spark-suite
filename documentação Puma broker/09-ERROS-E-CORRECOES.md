# Erros Comuns e Correções - Documentação Detalhada

## Visão Geral

Este documento lista todos os erros comuns encontrados no projeto Puma V2, suas causas e correções detalhadas.

## Erros de Conexão

### 1. "Daemon offline" / Connection Timeout

**Mensagem de Erro:**
```
Error: Failed to fetch
ECONNREFUSED 127.0.0.1:3001
```

**Causa:** `proxy_daemon.py` não está rodando na porta 3001.

**Correção:**
```bash
# Opção 1: Iniciar manualmente
cd pumabroker-api
python proxy_daemon.py --port 3001 --no-ws

# Opção 2: Usar script
npm run daemon

# Opção 3: Usar start.bat (Windows)
start.bat
```

**Verificação:**
```bash
# Verificar se a porta está em uso
netstat -ano | findstr :3001
```

---

### 2. Portas em Conflito (3001/3002/5173)

**Mensagem de Erro:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Causa:** Processos anteriores ainda rodando nas portas.

**Correção:**
```bash
# Opção 1: Usar start.bat (mata automaticamente)
start.bat

# Opção 2: Matar manualmente
# Encontrar PID
netstat -ano | findstr :3001

# Matar processo
taskkill /F /PID <pid>

# Opção 3: Matar todos os processos Node
taskkill /F /IM node.exe
```

---

### 3. "Socket hang up"

**Mensagem de Erro:**
```
Error: socket hang up
at TLSSocket.onConnectTimeout
```

**Causa:** Conexão perdida com o servidor.

**Correção:**
```typescript
// Implementar reconexão automática
private _reconnect(): void {
  setTimeout(() => {
    this.connect();
  }, 5000);
}
```

## Erros de Autenticação

### 4. HTTP 429 Too Many Requests

**Mensagem de Erro:**
```
HTTP 429: Too Many Requests
Retry-After: 60
```

**Causa:** Muitas tentativas de login. Puma limita autenticação.

**Correção:**
- **NÃO reinicie o daemon repetidamente**
- Aguarde o período de backoff (exponencial, até 60s)
- O sistema trata isso automaticamente com retry + jitter

**Prevenção:**
```typescript
// Implementar backoff
private _lastError429 = 0;

private async _loginWithBackoff() {
  const now = Date.now();
  if (now < this._lastError429) {
    const wait = this._lastError429 - now;
    console.log(`Rate limited. Aguarde ${wait/1000}s`);
    return;
  }
  
  // ... tenta login ...
  
  if (response.status === 429) {
    this._lastError429 = Date.now() + (2 ** this._retryCount) * 10000;
  }
}
```

---

### 5. HTTP 401 Unauthorized

**Mensagem de Erro:**
```
HTTP 401: Unauthorized
```

**Causa:** Token JWT expirado (~24h).

**Correção:**
```typescript
// Sistema auto-renova via re-login
await this._login(email, password, accountType);
```

**Correção manual:**
```bash
# Limpar tokens
rm puma_tokens.json

# No browser, limpar localStorage
# Chave: puma_token_data
```

---

### 6. "Cookie server_name_session AUSENTE"

**Mensagem de Erro:**
```
[WS2] cookie server_name_session AUSENTE
```

**Causa:** Login não retornou o cookie necessário para WS2.

**Correção:**
```python
# Daemon busca via GET /users/{id}
response = session.get(f"{API_BASE_URL}/api/v1/users/{user_id}")
```

**Verificação:**
```bash
# Verificar se a conta está verificada
curl -H "Authorization: Bearer <token>" \
     https://trade.pumabroker.com/api/v1/me
```

---

### 7. WS2 AUTH Failed

**Mensagem de Erro:**
```
AUTH WS2 falhou -- token pode estar expirado
```

**Causa:** Sessão WS2 expirou ou chave estática mudou.

**Correção:**
```typescript
// Sistema tenta refresh via daemon
GET /ws2-session?force=1
```

**Se a chave estática mudou:**
```python
# Atualizar em ws_proxy.py
STATIC_AUTH_KEY = "nova_chave_aqui"
```

## Erros de Dados

### 8. Buffer Empty / No Candles

**Mensagem de Erro:**
```
[WARN] getCandles VAZIO: XRDOGUSDT
[WARN] BLOQUEADO — poucos dados (mínimo: 70), count: 0
```

**Causa:** WebSocket não recebendo dados ou buffer não atingiu mínimo (70 candles).

**Correção:**
```typescript
// Verificar status do buffer
const bufferStatus = broker.getBufferStatus();
console.log("Buffer:", bufferStatus);

// Aguardar dados suficientes
if (bufferStatus.count < 70) {
  console.log("Aguardando dados...");
}
```

**Verificação:**
```bash
# Verificar se Binance WS está conectado (mercado aberto)
# Verificar se Puma Socket.IO está conectado (mercado fechado)
# Para ativos híbridos, verificar se proxy WS2 (porta 3002) está rodando
```

---

### 9. "history retorna s:'no_data'"

**Mensagem de Erro:**
```json
{ "s": "no_data" }
```

**Causa:** Período sem dados (mercado fechado, fim de semana, fora do horário).

**Correção:**
```python
# Ampliar o range de tempo
from_ts = int(time.time()) - (count * tf_seconds * 3)
```

---

### 10. "Candle duplicado"

**Mensagem de Erro:**
```
[INFO] Candle duplicado ignorado (idempotência): BETHUSDT @ 10:30:00
```

**Causa:** Mesmo candle processado duas vezes.

**Correção:** Comportamento esperado — sistema usa idempotência com `_lastProcessedCandle`.

## Erros de Trading

### 11. "Robô não iniciou / Saldo insuficiente"

**Mensagem de Erro:**
```
Falha ao obter saldo real após múltiplas tentativas.
Robô não iniciará.
```

**Causa:** Falha ao buscar saldo real da conta.

**Correção:**
```bash
# Verificar conectividade de rede
ping trade.pumabroker.com

# Verificar status da conta
curl -H "Authorization: Bearer <token>" \
     https://trade.pumabroker.com/api/v1/balance
```

---

### 12. "Duplicate Trade / Race Condition"

**Mensagem de Erro:**
```
[ERROR] Trade duplicado detectado
```

**Causa:** Múltiplas janelas de decisão disparando simultaneamente.

**Correção:** Sistema usa mutex estático `_isProcessing` e verificações de idempotência.

**Verificação:**
```typescript
// Verificar mapa de candles processados
console.log("_lastProcessedCandle:", FlowRobotEngine._lastProcessedCandle);
```

---

### 13. "Stop loss atingido"

**Mensagem de Erro:**
```
[INFO] Stop loss atingido! Robot stopped.
```

**Causa:** Perda acumulada ultrapassou limite configurado.

**Correção:**
- Aguarde novo dia ou
- Aumente `stopLoss` na configuração

---

### 14. "Níveis máximos esgotados"

**Mensagem de Erro:**
```
[INFO] Níveis máximos de recuperação atingidos.
```

**Causa:** Todos os níveis de recuperação foram usados.

**Correção:**
- Aumente `maxLevels` na configuração ou
- Reduza `initialStake` para usar mais níveis

## Erros de CopyTrade

### 15. "Copy trade não executa"

**Mensagem de Erro:**
```
[INFO] Copy trade ignorado — _copy_user_confirmed = false
```

**Causa:** Flag `_copy_user_confirmed` é `False`.

**Correção:** Ative o copy trade via toggle na UI.

---

### 16. "Sessão não autenticada"

**Mensagem de Erro:**
```
[ERROR] Copy session login failed
```

**Causa:** Login da conta cópia falhou.

**Correção:**
```bash
# Verificar credenciais da conta cópia
# Verificar se a conta está ativa
```

---

### 17. "HTTP 401 na conta cópia"

**Mensagem de Erro:**
```
[WARN] Copy trade 401 — retrying with fresh login
```

**Causa:** Token da conta cópia expirou.

**Correção:** Sistema faz retry com fresh login.

## Erros de Performance

### 18. "Memory leak"

**Sintomas:** Aplicação ficando cada vez mais lenta.

**Causa:** Event listeners não estão sendo removidos.

**Correção:**
```typescript
// Sempre remover listeners ao desmontar
useEffect(() => {
  const unsubscribe = robot.on("state-changed", setState);
  return () => unsubscribe();
}, []);
```

---

### 19. "High CPU usage"

**Sintomas:** Computador ficando lento.

**Causa:** Muitos timers rodando simultaneamente.

**Correção:**
```typescript
// Limpar timers ao parar
stop(): void {
  if (this._loopTimer) {
    clearTimeout(this._loopTimer);
    this._loopTimer = null;
  }
  if (this._countdownTimer) {
    clearInterval(this._countdownTimer);
    this._countdownTimer = null;
  }
}
```

## Erros de Build

### 20. "Cannot find module"

**Mensagem de Erro:**
```
Cannot find module '@tanstack/react-router'
```

**Causa:** Dependências não instaladas.

**Correção:**
```bash
npm install
```

---

### 21. "TypeScript errors"

**Mensagem de Erro:**
```
Type 'string' is not assignable to type 'number'
```

**Causa:** Erros de tipo no código.

**Correção:**
```bash
# Verificar erros
npx tsc --noEmit

# Corrigir tipos no código
```

## Comandos de Debug

### Verificar Status

```bash
# Portas em uso
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :5173

# Processos Node
tasklist | findstr node

# Processos Python
tasklist | findstr python
```

### Logs

```bash
# Daemon logs
cat pumabroker-api/daemon.log

# Frontend logs
# Abrir console do browser (F12)
```

### Testes

```bash
# Testar conexão com API
curl http://127.0.0.1:3001/status

# Testar login
curl -X POST http://127.0.0.1:3001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'
```

## Melhores Práticas para Evitar Erros

1. **Sempre use start.bat** para iniciar o sistema
2. **NÃO reinicie** o daemon repetidamente
3. **Aguarde dados suficientes** (70 candles) antes de operar
4. **Teste com conta demo** antes de usar em conta real
5. **Monitore logs** continuamente
6. **Implemente tratamento de erros** robusto
7. **Use variáveis de ambiente** para configurações
8. **Documente erros** encontrados e suas soluções
