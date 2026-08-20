# WebSocket e Dados de Mercado - Documentação Detalhada

## Visão Geral

O sistema utiliza três fontes de dados de mercado diferentes:
1. **Binance WebSocket**: Dados públicos de pares forex
2. **Puma WS2**: Dados de ativos híbridos via proxy
3. **Puma Socket.IO**: Trades e candles OTC

## Arquitetura de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Binance  │  │ Puma WS2 │  │ Puma     │                  │
│  │ WS       │  │ Client   │  │ Socket.IO│                  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘                  │
│        │             │             │                         │
└────────┼─────────────┼─────────────┼─────────────────────────┘
         │             │             │
         │         ┌───▼───┐         │
         │         │ ws_   │         │
         │         │ proxy │         │
         │         │ :3002 │         │
         │         └───┬───┘         │
         │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │ Binance │   │ Puma    │   │ Puma    │
    │ API     │   │ WS2     │   │ Socket  │
    │ (público│   │ (hybrid)│   │ .IO     │
    └─────────┘   └─────────┘   └─────────┘
```

## Binance WebSocket

### URL

```
wss://stream.binance.com:9443/ws
```

### Pares Suportados

```typescript
const BINANCE_PAIRS = [
  "eurusd",
  "gbpusd",
  "usdjpy",
  "audusd",
  "usdcad",
  "nzdusd",
  "btcusdt",
  "ethusdt",
  "xauusd",
];
```

### Conexão

```typescript
class BinanceWsClient {
  private _ws: WebSocket | null = null;

  connect(pairs: string[]): void {
    const streams = pairs.map(p => `${p}@kline_1m`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    this._ws = new WebSocket(url);
    
    this._ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this._onCandleUpdate(data);
    };
  }
}
```

### Formato do Dado

```json
{
  "e": "kline",
  "E": 1783300000,
  "s": "BTCUSDT",
  "k": {
    "t": 1783300000000,
    "T": 1783300060000,
    "s": "BTCUSDT",
    "i": "1m",
    "o": "50000.00",
    "c": "50100.00",
    "h": "50200.00",
    "l": "49900.00",
    "v": "100.00",
    "n": 1000,
    "x": false
  }
}
```

## Puma WS2 (WebSocket Proxy)

### URL

```
ws://127.0.0.1:3002?token=<session_token>
```

### Por que o Proxy é Necessário

O browser **não permite** enviar `Cookie` customizado no handshake WebSocket. O proxy Python contorna essa limitação.

### Fluxo

```
Browser → ws://127.0.0.1:3002?token=<session_token>
    ↓  extrai token da query string
ws_proxy.py
    ↓  conecta com header Cookie: server_name_session=<token>
wss://wsm5.pumabroker.com/
    ↓  proxy bidirecional de mensagens
Browser recebe bar_update normalmente
```

### Conexão

```typescript
class PumaWs2Client {
  private _ws: WebSocket | null = null;

  connect(token: string): void {
    const url = `ws://127.0.0.1:3002?token=${token}`;
    
    this._ws = new WebSocket(url);
    
    this._ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "bar_update") {
        this._onCandleUpdate(data);
      } else if (data.type === "server_time") {
        this._onHeartbeat(data);
      }
    };
    
    // Heartbeat a cada 10s
    this._heartbeatTimer = setInterval(() => {
      this._ws?.send(JSON.stringify({ method: "server_time" }));
    }, 10000);
  }
}
```

### Formato do Dado (bar_update)

```json
{
  "type": "bar_update",
  "symbol": "BETHUSDT",
  "interval": "5",
  "bar": {
    "time": 1783300000,
    "open": 914.05714,
    "high": 914.25613,
    "low": 913.3959,
    "close": 913.3959,
    "volume": 190.0
  },
  "last_bar": {
    "time": 1783299940,
    "open": 914.10000,
    "high": 914.30000,
    "low": 913.40000,
    "close": 914.05714,
    "volume": 180.0
  }
}
```

### Ativos Híbridos

```typescript
const HYBRID_PUMA_ASSETS = new Set([
  "BETHUSDT",
  "BTSOLUSDT",
  "MAPEUSDT",
  "XRDOGUSDT",
  "XRPSOLUSDT",
]);
```

## Puma Socket.IO

### URL

```
wss://trade.pumabroker.com/socket.io/?EIO=4&transport=websocket
```

### Handshake

```
1. Conecta WSS
2. Recebe: 0{"sid":"AAxrTo2u...","pingInterval":25000,"pingTimeout":20000}
3. Envia:  40/trades,
4. Recebe: 40/trades,{"sid":"OFsHv2_q..."}
5. Envia:  42/trades,["subscribe","28318"]   ← account_id
6. Envia:  40/otc,
7. Recebe: 40/otc,{"sid":"UgJ02aQp..."}
8. Ping/Pong a cada 25s: envia "2", recebe "3"
```

### Eventos

#### tradeUpdate

```
← 42/trades,["tradeUpdate", {
    "id":          "5186325",
    "uid":         "364a4ac0f65720fa8b450f7b0b32cd",
    "userId":      "28318",
    "symbol":      "BETHUSDT",
    "currency":    "BETHUSDT",
    "direction":   "CALL",
    "amount":      2,
    "entryPrice":  "911.31632",
    "exitPrice":   null,
    "profit":      0,
    "payout":      0.87,
    "status":      "ACTIVE",
    "isDemo":      false
}]
```

#### candle (OTC)

```
← 42/otc,["candle", {
    "assetId": 11,
    "symbol":  "BETH/USDT",
    "time":    1781573700000,
    "open":    914.05714,
    "high":    914.25613,
    "low":     913.3959,
    "close":   913.3959,
    "verify":  "gAAAAA..."
}]
```

### Status de Trade

| Status | Significado |
|--------|-------------|
| `ACTIVE` | Ordem aberta — aguardando resultado |
| `WIN` | Ganhou — `profit` preenchido |
| `LOSS` | Perdeu — `profit` = 0 |
| `DRAW` | Empate — valor devolvido |

## REST API - Histórico de Candles

### Endpoint

```
GET https://trade.pumabroker.com/api/v1/tradingview/history
    ?symbol=XRDOGUSDT
    &resolution=1
    &from=1783247524
    &to=1783267324
```

### Parâmetros

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `symbol` | string | Nome do ativo |
| `resolution` | string | Timeframe (1, 5, 15, 30, 60) |
| `from` | int | Unix timestamp início |
| `to` | int | Unix timestamp fim |

### Response

```json
{
  "s": "ok",
  "t": [1783247520, 1783247580, 1783247640],
  "o": [50.68, 50.7, 50.65],
  "h": [50.72, 50.75, 50.7],
  "l": [50.65, 50.68, 50.6],
  "c": [50.7, 50.65, 50.68],
  "v": [190.0, 210.0, 175.0]
}
```

### Quando Retorna Vazio

```json
{ "s": "no_data" }
```

**Causa**: Período sem dados (mercado fechado, fim de semana).

**Correção**: Ampliar o range `from` para cobrir mais tempo.

## Buffer de Candles

### Estrutura

```typescript
interface CandleBuffer {
  key: string;          // Símbolo do ativo
  candles: Candle[];    // Array de candles
  count: number;        // Quantidade atual
  lastTime: string;     // Último timestamp
}
```

### Capacidade

| Perfil | Capacidade | Mínimo |
|--------|------------|--------|
| AUTO | 500 | 70 |
| FOREX | 500 | 70 |
| HYBRID_FLOW | 300 | 70 |
| HYBRID_PROBABILITY | 2000 | 70 |

### Health Check

```typescript
const bufferHealth = {
  live: secondsWithout < 3,      // Recebendo dados
  waiting: secondsWithout < 10,  // Aguardando próximo candle
  stale: secondsWithout >= 10,   // Buffer desatualizado
};
```

## Erros Comuns

### 1. "WS2: cookie server_name_session AUSENTE"

**Causa**: Login não retornou o cookie necessário.

**Correção**: Verifique se a conta está verificada.

### 2. "WS2 AUTH Failed"

**Causa**: Sessão WS2 expirou.

**Correção**: Sistema tenta refresh via `GET /ws2-session?force=1`.

### 3. "Buffer vazio"

**Causa**: WebSocket não está recebendo dados.

**Correção**: Verifique se Binance WS ou Puma Socket.IO está conectado.

### 4. "Candle duplicado"

**Causa**: Mesmo candle processado duas vezes.

**Correção**: Sistema usa idempotência com `_lastProcessedCandle`.

### 5. "Heartbeat timeout"

**Causa**: Servidor não respondeu heartbeat.

**Correção**: Sistema reconecta automaticamente.

## Melhores Práticas

1. **Reconexão**: Implemente reconexão automática com backoff
2. **Buffer**: Mantenha buffer suficiente (mínimo 70 candles)
3. **Heartbeat**: Envie heartbeat para manter conexão viva
4. **Idempotência**: Use timestamps para evitar processamento duplicado
5. **Logging**: Registre conexões e desconexões para debugging
