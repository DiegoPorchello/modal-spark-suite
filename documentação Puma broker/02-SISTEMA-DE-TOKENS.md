# Sistema de Tokens - Documentação Detalhada

## Visão Geral

O projeto possui dois sistemas de gerenciamento de tokens:
1. **Python Token Manager**: Persiste tokens em arquivo JSON
2. **TypeScript Token Manager**: Armazena tokens no localStorage do browser

## Token Manager Python

### Localização
`pumabroker-api/pumabroker/token_manager.py`

### Estrutura de Dados

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "28318",
  "email": "usuario@email.com",
  "expires_at": 1783300000,
  "issued_at": 1783213600
}
```

### Fluxo get_access_token()

```python
def get_access_token(self) -> str:
    """Retorna token válido, renovando se necessário"""
    
    # 1. Carrega token do arquivo
    self._load_token()
    
    # 2. Verifica se está válido (com buffer de 300s)
    if self._token and time.time() < self._expires_at - 300:
        return self._access_token
    
    # 3. Tenta refresh
    if self._refresh_token:
        try:
            return self._refresh_access_token()
        except:
            pass
    
    # 4. Login completo
    return self._full_login()
```

### Persistência

O token é salvo em `puma_tokens.json`:
```python
def _save_token(self):
    data = {
        "accessToken": self._access_token,
        "refreshToken": self._refresh_token,
        "user_id": self._user_id,
        "email": self._email,
        "expires_at": self._expires_at,
        "issued_at": self._issued_at
    }
    with open("puma_tokens.json", "w") as f:
        json.dump(data, f)
```

### Thread Safety

```python
_login_mutex = threading.Lock()

def get_access_token(self) -> str:
    with _login_mutex:
        # ... lógica de renovação ...
```

## Token Manager TypeScript

### Localização
`src/broker/puma-token-manager.ts`

### Estrutura de Dados

```typescript
interface TokenData {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    balance: number;
    demoBalance: number;
    isDemo: boolean;
  };
  ws2Session?: string;
  expiresAt?: number;
}
```

### Fluxo

```typescript
class PumaTokenManager {
  private static STORAGE_KEY = "puma_token_data";

  get(): TokenData | null {
    // 1. Lê do localStorage
    const raw = localStorage.getItem(PumaTokenManager.STORAGE_KEY);
    if (!raw) return null;

    // 2. Parse e verifica expiração
    const data = JSON.parse(raw) as TokenData;
    
    if (data.expiresAt && Date.now() > data.expiresAt - 5 * 60 * 1000) {
      // Token expirado (com buffer de 5 min)
      return null;
    }

    return data;
  }

  set(data: TokenData): void {
    // 1. Adiciona timestamp de expiração
    const expiresAt = this._parseJwtExpiration(data.token);
    data.expiresAt = expiresAt;

    // 2. Salva no localStorage
    localStorage.setItem(
      PumaTokenManager.STORAGE_KEY,
      JSON.stringify(data)
    );
  }

  clear(): void {
    localStorage.removeItem(PumaTokenManager.STORAGE_KEY);
  }
}
```

## Auto-Renovação JWT

### PumaSocketClient

```typescript
// Agenda renovação 5 minutos antes da expiração
private _scheduleJwtRenewal(): void {
  const expiresIn = this._tokenExpiresAt - Date.now();
  const renewIn = Math.max(0, expiresIn - 5 * 60 * 1000);
  
  setTimeout(() => {
    this._renewJwt();
  }, renewIn);
}
```

### PumaBrokerAdapter

```typescript
private async _refreshJwt(): Promise<void> {
  // 1. Verifica se token expirou
  const tokenData = pumaTokenManager.get();
  if (!tokenData) {
    // 2. Faz re-login completo
    await this._login(this._email, this._password, this._accountType);
    return;
  }

  // 3. Verifica se /balance retorna 401
  const balance = await this._fetchBalance();
  if (balance === null) {
    // 4. Token inválido — re-login
    await this._login(this._email, this._password, this._accountType);
  }
}
```

### WS2 Session Refresh

```typescript
// Daemon endpoint para forçar refresh da sessão WS2
GET /ws2-session?force=1

// Resposta
{
  "session": "novo_server_name_session_token",
  "expiresAt": 1783300000
}
```

## Cookies e Headers

| Nome | Onde | Valor | Uso |
|------|------|-------|-----|
| `server_name_session` | Cookie | `cd0dc3ba...` | Autenticação WS2 e Socket.IO |
| `Authorization` | Header | `Bearer eyJhbGci...` | Todos os requests REST |

## Erros Comuns

### 1. "Token expirado" (401)

**Causa**: JWT expirou (~24h).

**Correção**:
```typescript
// Sistema auto-renova via re-login
await this._login(email, password, accountType);
```

### 2. "Token inválido"

**Causa**: Token corrompido ou formato inválido.

**Correção**:
```typescript
// Limpa cache e refaz login
pumaTokenManager.clear();
await this._login(email, password, accountType);
```

### 3. "Refresh token expirado"

**Causa**: Refresh token expirou (mais longo que access token).

**Correção**: Login completo necessário.

### 4. "Cookie server_name_session ausente"

**Causa**: Login não retornou o cookie.

**Correção**:
```python
# Daemon busca via GET /users/{id}
response = session.get(f"{API_BASE_URL}/api/v1/users/{user_id}")
```

## Melhores Práticas

1. **Buffer de Segurança**: Renove 5 minutos antes da expiração
2. **Persistência**: Salve tokens em arquivo/localStorage
3. **Thread Safety**: Use mutex para operações concorrentes
4. **Cleanup**: Limpe tokens ao fazer logout
5. **Logging**: Registre renovações para debugging
