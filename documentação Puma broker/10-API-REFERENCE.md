# API Reference - Documentação Detalhada

## Visão Geral

Este documento lista todos os endpoints da API do Puma Broker e do daemon local, com exemplos de uso.

## API PumaBroker (Externa)

### Base URL

```
https://trade.pumabroker.com
```

### Autenticação

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Origin: https://trade.pumabroker.com
```

### Endpoints

#### Login

```
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

**Response:**
```json
{
  "user": {
    "id": "28318",
    "email": "usuario@email.com",
    "name": "NOME COMPLETO",
    "balance": 0,
    "demoBalance": 9998,
    "isDemo": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### Profile

```
GET /api/v1/me
```

**Response:**
```json
{
  "id": "28318",
  "email": "usuario@email.com",
  "name": "NOME COMPLETO",
  "balance": 0,
  "demoBalance": 9998,
  "isDemo": true,
  "isVip": true,
  "vipLevel": 1
}
```

---

#### Balance

```
GET /api/v1/balance
```

**Response:**
```json
{
  "balance": 0,
  "demoBalance": 9998,
  "currency": "BRL"
}
```

---

#### Trade History

```
GET /api/v1/trades
```

**Response:**
```json
{
  "trades": [
    {
      "id": "5186325",
      "symbol": "BETHUSDT",
      "direction": "CALL",
      "amount": 2,
      "entryPrice": 911.31632,
      "exitPrice": 912.50000,
      "profit": 1.74,
      "payout": 0.87,
      "status": "WIN",
      "createdAt": "2026-07-05T10:00:00Z"
    }
  ]
}
```

---

#### Place Trade

```
POST /api/v1/trades
```

**Request:**
```json
{
  "userId": "28318",
  "symbol": "BETHUSDT",
  "direction": "CALL",
  "amount": 2,
  "duration": 55,
  "entryPrice": 911.31632,
  "mode": "CANDLE_TIME",
  "payout": 0.87,
  "timeframe": "M1",
  "verify": "gAAAAABqMLMX8x8KnN21gQRKFTf...",
  "wallet": "DEMO"
}
```

**Response:**
```json
{
  "id": "5186326",
  "status": "ACTIVE",
  "symbol": "BETHUSDT",
  "direction": "CALL",
  "amount": 2,
  "entryPrice": 911.31632
}
```

---

#### Candle History

```
GET /api/v1/tradingview/history
```

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| symbol | string | Nome do ativo |
| resolution | string | Timeframe (1, 5, 15, 30, 60) |
| from | int | Unix timestamp início |
| to | int | Unix timestamp fim |

**Request:**
```
GET /api/v1/tradingview/history?symbol=XRDOGUSDT&resolution=1&from=1783247524&to=1783267324
```

**Response:**
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

---

#### Active Assets

```
GET /api/v1/active
```

**Response:**
```json
{
  "assets": [
    {
      "symbol": "BETHUSDT",
      "name": "Binance ETH/USDT",
      "payout": 0.87,
      "isActive": true
    }
  ]
}
```

## API Daemon Local

### Base URL

```
http://127.0.0.1:3001
```

### Endpoints

#### Status

```
GET /status
```

**Response:**
```json
{
  "status": "running",
  "uptime": 3600,
  "version": "2.0.0"
}
```

---

#### Login

```
POST /login
```

**Request:**
```json
{
  "email": "usuario@email.com",
  "password": "senha"
}
```

**Response:**
```json
{
  "user": {
    "id": "28318",
    "email": "usuario@email.com",
    "name": "NOME COMPLETO"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "ws2Session": "cd0dc3ba..."
}
```

---

#### Balance

```
GET /balance
```

**Response:**
```json
{
  "balance": 0,
  "demoBalance": 9998,
  "currency": "BRL"
}
```

---

#### Place Trade

```
POST /trades
```

**Request:**
```json
{
  "symbol": "BETHUSDT",
  "direction": "CALL",
  "amount": 2,
  "duration": 55,
  "entryPrice": 911.31632,
  "timeframe": "M1",
  "wallet": "DEMO"
}
```

**Response:**
```json
{
  "status": "success",
  "orderId": "5186326"
}
```

---

#### WS2 Session

```
GET /ws2-session?force=1
```

**Response:**
```json
{
  "session": "novo_server_name_session_token",
  "expiresAt": 1783300000
}
```

---

#### Copy Sessions

```
GET /copy/sessions
```

**Response:**
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

---

#### Add Copy Session

```
POST /copy/sessions
```

**Request:**
```json
{
  "email": "conta3@email.com",
  "password": "senha3"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Session added"
}
```

---

#### Enable Copy Trade

```
POST /copy/enable
```

**Request:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "enabled": true,
  "userConfirmed": true
}
```

---

#### Copy Logs

```
GET /copy/logs
```

**Response:**
```json
{
  "logs": [
    {
      "timestamp": 1783300000,
      "account": "conta2@email.com",
      "symbol": "BETHUSDT",
      "direction": "CALL",
      "result": {
        "status": "success",
        "orderId": "5186327"
      }
    }
  ]
}
```

## WebSocket Events

### Socket.IO

**URL:** `wss://trade.pumabroker.com/socket.io/?EIO=4&transport=websocket`

#### tradeUpdate

```
← 42/trades,["tradeUpdate", {
    "id": "5186325",
    "symbol": "BETHUSDT",
    "direction": "CALL",
    "amount": 2,
    "entryPrice": 911.31632,
    "exitPrice": null,
    "profit": 0,
    "payout": 0.87,
    "status": "ACTIVE"
}]
```

#### candle (OTC)

```
← 42/otc,["candle", {
    "assetId": 11,
    "symbol": "BETH/USDT",
    "time": 1781573700000,
    "open": 914.05714,
    "high": 914.25613,
    "low": 913.3959,
    "close": 913.3959
}]
```

### WS2 (WebSocket Proxy)

**URL:** `ws://127.0.0.1:3002?token=<session_token>`

#### bar_update

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
  }
}
```

#### server_time

```json
{
  "type": "server_time",
  "timestamp": 1783300000000
}
```

## Erros da API

### HTTP Status Codes

| Code | Significado |
|------|-------------|
| 200 | Sucesso |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Formato de Erro

```json
{
  "error": "error_code",
  "message": "Descrição do erro",
  "details": {}
}
```

### Erros Comuns

| Error Code | Descrição |
|------------|-----------|
| `invalid_credentials` | Email ou senha incorretos |
| `token_expired` | JWT expirado |
| `rate_limited` | Muitas requisições |
| `insufficient_balance` | Saldo insuficiente |
| `market_closed` | Mercado fechado |
| `invalid_symbol` | Símbolo inválido |
