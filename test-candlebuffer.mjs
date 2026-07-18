import { chromium } from "playwright";

const EMAIL = "fernandalopestorres1@gmail.com";
const PASSWORD = "Semsenh@123";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const candleLogs = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("CandleBuffer") || text.includes("STATE TRANSITION") || text.includes("VIOLAÇÃO") || text.includes("LIVE") || text.includes("GAP-FILL") || text.includes("PRIMEIRO CANDLE") || text.includes("DUPLICATA")) {
      candleLogs.push(text);
      console.log("[BROWSER]", text);
    }
  });

  page.on("pageerror", (err) => {
    console.error("[PAGE ERROR]", err.message);
  });

  console.log("Navegando para http://localhost:8083...");
  await page.goto("http://localhost:8083", { waitUntil: "networkidle", timeout: 30000 });

  await page.waitForTimeout(2000);

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.getByRole("button", { name: /CONECTAR/i });

  const emailExists = await emailInput.count();
  console.log(`Campo email encontrado: ${emailExists}`);

  if (emailExists > 0) {
    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await submitButton.click();
    console.log("Login submit realizado. Aguardando CandleBuffer...");

    await page.waitForTimeout(10000);

    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      if (candleLogs.some(l => l.includes("LIVE") && !l.includes("VIOLAÇÃO"))) {
        console.log("\n=== BUFFER EM LIVE DETECTADO ===");
        break;
      }
    }
  } else {
    console.log("Página já logada ou formulário diferente. Monitorando logs...");
    await page.waitForTimeout(15000);
  }

  console.log("\n========== LOGS CAPTURADOS ==========");
  for (const log of candleLogs) {
    console.log(log);
  }
  console.log("======================================");
  console.log(`Total de logs do CandleBuffer: ${candleLogs.length}`);

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
