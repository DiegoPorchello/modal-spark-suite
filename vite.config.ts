// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/trades": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/balance": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/active": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/ws2-session": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/login": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/logs": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/copy": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/health": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/history": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/binance-klines": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
      },
    },
  },
});
