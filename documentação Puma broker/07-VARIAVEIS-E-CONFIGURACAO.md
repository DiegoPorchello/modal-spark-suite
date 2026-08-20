# Variáveis de Ambiente e Configuração - Documentação Detalhada

## Visão Geral

O projeto utiliza múltiplos arquivos de configuração e variáveis de ambiente para diferentes camadas do sistema.

## Estrutura de Arquivos

```
projeto/
├── .env                          # Variáveis do frontend
├── .env.example                  # Template de variáveis
├── pumabroker-api/
│   ├── .env                      # Variáveis do daemon Python
│   └── pumabroker/
│       └── config.py             # Configurações da API
├── tsconfig.json                 # Configuração TypeScript
├── vite.config.ts                # Configuração Vite
├── electron-builder.yml          # Configuração Electron
└── package.json                  # Dependências Node.js
```

## Variáveis de Ambiente

### Frontend (`.env`)

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ElevenLabs (opcional)
VITE_ELELABS_API_KEY=sk_xxxxx

# WS2 Proxy
VITE_WS2_PROXY_URL=ws://127.0.0.1:3002
```

### Python Daemon (`pumabroker-api/.env`)

```env
# PumaBroker
PUMA_EMAIL=usuario@email.com
PUMA_PASSWORD=senha

# Legacy
PUMA_SESSION=cd0dc3ba...

# Logging
LOG_LEVEL=INFO
```

### Bot (`bot.py`)

```env
# Trading
SYMBOL=BETHUSDT
TIMEFRAME=M1
AMOUNT=2
WALLET=DEMO
MAX_TRADES=1
STOP_LOSS=20
COOLDOWN_MS=5000
```

## config.py - Configurações da API

### Localização
`pumabroker-api/pumabroker/config.py`

### Endpoints

```python
API_BASE_URL = "https://trade.pumabroker.com"
WS2_URL = "wss://wsm5.pumabroker.com"
SOCKET_IO_URL = "wss://trade.pumabroker.com/socket.io"

# Endpoints REST
LOGIN_URL = f"{API_BASE_URL}/api/v1/auth/login"
BALANCE_URL = f"{API_BASE_URL}/api/v1/balance"
TRADES_URL = f"{API_BASE_URL}/api/v1/trades"
HISTORY_URL = f"{API_BASE_URL}/api/v1/tradingview/history"
```

### Headers

```python
DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://trade.pumabroker.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
```

## package.json - Scripts

```json
{
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "daemon": "python pumabroker-api/proxy_daemon.py --port 3001 --no-ws",
    "wsproxy": "python pumabroker-api/ws_proxy.py --port 3002",
    "services": "start.bat",
    "start:all": "npm run services && timeout /t 3 /nobreak && npm run dev",
    "electron:dev": "electron electron/main.cjs",
    "build:desktop": "node scripts/build-desktop.mjs",
    "build:desktop:portable": "node scripts/build-desktop.mjs --portable",
    "package:python": "node scripts/package-python.mjs"
  }
}
```

## electron-builder.yml

```yaml
appId: com.pumav2.app
productName: Puma V2
directories:
  output: release
files:
  - dist/**/*
  - electron/**/*
  - node_modules/**/*
win:
  target: nsis
  icon: resources/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

## Configurações do Engine

### Perfis Operacionais

```typescript
const operationalProfiles = {
  AUTO: {
    minCandles: 70,
    fetchSize: 200,
    indicators: ["EMA", "RSI", "Structure"],
  },
  FOREX: {
    minCandles: 70,
    fetchSize: 200,
    indicators: ["EMA", "RSI", "Structure", "Session"],
  },
  HYBRID_FLOW: {
    minCandles: 70,
    fetchSize: 300,
    indicators: ["EMA", "RSI", "Continuity"],
  },
  HYBRID_PROBABILITY: {
    minCandles: 70,
    fetchSize: 2000,
    indicators: ["EMA", "RSI", "Probability", "Patterns"],
  },
};
```

### Configurações do Robot

```typescript
const defaultRobotConfig: RobotConfig = {
  asset: "BETHUSDT",
  timeframes: ["M1", "M5", "M15"],
  expirationSeconds: 60,
  accountType: "demo",
  initialBankroll: 1000,
  targetProfit: 100,
  stopLoss: 200,
  direction: "call",
  autoDirection: true,
  reAnalysisIntervalSec: 30,
  scanMode: "multi",
  assetCooldownMinutes: 5,
  globalCooldownSec: 180,
  initialStake: 2,
  payout: 0.86,
  maxLevel: 15,
  customLevels: [],
  assets: [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCAD",
    "NZDUSD",
    "BTCUSD",
    "ETHUSD",
    "BETHUSDT",
    "BTSOLUSDT",
    "MAPEUSDT",
    "XRDOGUSDT",
    "XRPSOLUSDT",
    "XAUUSD",
  ],
  marketMode: "AUTO",
  operationProfile: "AUTO",
};
```

## Erros Comuns

### 1. "Variável de ambiente não definida"

**Causa**: Arquivo `.env` ausente ou incompleto.

**Correção**: Copie `.env.example` para `.env` e preencha os valores.

### 2. "Cannot find module"

**Causa**: Dependências não instaladas.

**Correção**:
```bash
npm install
pip install -r requirements.txt
```

### 3. "Port already in use"

**Causa**: Porta 3001, 3002 ou 5173 já está em uso.

**Correção**:
```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <pid>

# Ou use start.bat que mata automaticamente
```

### 4. "TypeScript errors"

**Causa**: Configuração `tsconfig.json` incorreta.

**Correção**: Verifique os paths e opções de compilação.

## Melhores Práticas

1. **Segurança**: Nunca commite `.env` no Git
2. **Variáveis**: Use `VITE_` para variáveis do frontend
3. **Documentação**: Mantenha `.env.example` atualizado
4. **Configuração**: Use arquivos de configuração para valores fixos
5. **Logging**: Configure `LOG_LEVEL` adequadamente
