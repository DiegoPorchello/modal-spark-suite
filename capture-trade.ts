import { chromium, CDPSession, Page } from "playwright";
import * as fs from "fs";

const EMAIL = process.env.PUMA_EMAIL || "fernandalopestorres1@gmail.com";
const PASSWORD = process.env.PUMA_PASSWORD || "Semsenh@123";
const OUTPUT_FILE = `trade-capture-${Date.now()}.jsonl`;

interface CapturedEvent {
  timestamp: string;
  type: "websocket" | "request" | "response" | "ws-sent" | "ws-received";
  url?: string;
  method?: string;
  status?: number;
  data?: any;
  direction?: "sent" | "received";
}

const events: CapturedEvent[] = [];

function logEvent(type: CapturedEvent["type"], data: Partial<CapturedEvent>) {
  events.push({
    timestamp: new Date().toISOString(),
    type,
    ...data,
  });
}

async function main() {
  console.log("=== INICIANDO CAPTURA ===");
  console.log("Email:", EMAIL);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // CDP session para capturar WebSocket frames
  const client: CDPSession = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });

  // Capturar requests REST
  client.on("Network.requestWillBeSent", (params) => {
    const url = params.request.url;
    if (
      url.includes("pumabroker") ||
      url.includes("trade") ||
      url.includes("wsmt5") ||
      url.includes("socket.io")
    ) {
      logEvent("request", { url, method: params.request.method, data: params.request.postData });
    }
  });

  client.on("Network.responseReceived", (params) => {
    const url = params.response.url;
    if (
      url.includes("pumabroker") ||
      url.includes("trade") ||
      url.includes("wsmt5") ||
      url.includes("socket.io")
    ) {
      logEvent("response", { url, status: params.response.status });
    }
  });

  client.on("Network.webSocketCreated", (params) => {
    logEvent("websocket", { url: params.url });
  });

  client.on("Network.webSocketFrameSent", (params) => {
    logEvent("ws-sent", { data: params.response.payloadData, direction: "sent" });
  });

  client.on("Network.webSocketFrameReceived", (params) => {
    logEvent("ws-received", { data: params.response.payloadData, direction: "received" });
  });

  // Abrir site
  console.log("Abrindo https://trade.pumabroker.com...");
  await page.goto("https://trade.pumabroker.com", { waitUntil: "networkidle", timeout: 60000 });

  // Login
  console.log("Fazendo login...");
  try {
    await page.waitForSelector('input[type="email"], input[name="email"], input[id*="email"]', {
      timeout: 10000,
    });
    await page.fill('input[type="email"], input[name="email"], input[id*="email"]', EMAIL);
    await page.fill(
      'input[type="password"], input[name="password"], input[id*="password"]',
      PASSWORD,
    );
    await page.click(
      'button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")',
    );
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log("Login realizado");
  } catch (e) {
    console.log("Login pulado (pode já estar logado):", e.message);
  }

  // Aguardar UI carregar
  console.log("Aguardando interface...");
  await page.waitForTimeout(5000);

  // Debug: listar elementos interativos para ajudar a ajustar seletores
  console.log("\n--- DEBUG: Elementos na página ---");
  const elements = await page.$$eval(
    'select, button, input[type="text"], input[type="number"], input[placeholder]',
    (els) =>
      els.slice(0, 30).map((el) => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        class: el.className,
        placeholder: (el as HTMLInputElement).placeholder,
        type: (el as HTMLInputElement).type,
        text: el.textContent?.slice(0, 50),
        options:
          el.tagName === "SELECT"
            ? Array.from((el as HTMLSelectElement).options)
                .map((o) => o.value + ":" + o.text)
                .join(", ")
            : undefined,
      })),
  );
  console.log(JSON.stringify(elements, null, 2));

  console.log("\n=== AGORA CRIE A ORDEM MANUALMENTE NO NAVEGADOR ===");
  console.log("1. Selecione EURUSD");
  console.log("2. Selecione CALL/Alta");
  console.log("3. Valor: 2");
  console.log("4. Expiração: 60s (M1)");
  console.log("5. Clique em Comprar/Call");
  console.log("\nO script vai aguardar 120 segundos capturando tudo...");
  console.log("Pressione Enter aqui no terminal quando a ordem for criada, ou aguarde o timeout.");

  // Aguardar input do usuário (opcional) ou timeout
  await page.waitForTimeout(120000);

  // Salvar
  const jsonl = events.map((e) => JSON.stringify(e)).join("\n");
  fs.writeFileSync(OUTPUT_FILE, jsonl);
  console.log(`\n=== CAPTURA CONCLUÍDA ===`);
  console.log(`Arquivo: ${OUTPUT_FILE}`);
  console.log(`Eventos: ${events.length}`);

  const wsReceived = events.filter((e) => e.type === "ws-received").length;
  const wsSent = events.filter((e) => e.type === "ws-sent").length;
  const requests = events.filter((e) => e.type === "request").length;
  const responses = events.filter((e) => e.type === "response").length;
  const websockets = events.filter((e) => e.type === "websocket").length;
  console.log(
    `WS received: ${wsReceived} | WS sent: ${wsSent} | REST req: ${requests} | REST res: ${responses} | WS connections: ${websockets}`,
  );

  await browser.close();
}

main().catch(console.error);
