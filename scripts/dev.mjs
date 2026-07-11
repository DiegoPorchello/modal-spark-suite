import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const apiDir = resolve(root, "pumabroker-api");

console.log("[dev] Iniciando Puma Broker Daemon...");

const daemon = spawn("python proxy_daemon.py", [], {
  cwd: apiDir,
  stdio: "pipe",
  shell: true,
});

daemon.stdout.on("data", (d) => process.stdout.write(`[daemon] ${d}`));
daemon.stderr.on("data", (d) => process.stderr.write(`[daemon] ${d}`));

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:3001/health", (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForDaemon(retries = 20) {
  for (let i = 0; i < retries; i++) {
    const ok = await healthCheck();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const ready = await waitForDaemon();
if (!ready) {
  console.error("[dev] Erro: Daemon Puma Broker não iniciou");
  daemon.kill();
  process.exit(1);
}

console.log("[dev] Daemon pronto! Iniciando Vite...");

const vite = spawn("npx", ["vite", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

vite.on("close", (code) => {
  daemon.kill();
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  daemon.kill();
  vite.kill();
  process.exit();
});
