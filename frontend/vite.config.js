import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = process.env.VITE_API_PORT || process.env.PORT || 3001;
const proxyTarget = `http://localhost:${API_PORT}`;

function backendCheckPlugin() {
  return {
    name: "backend-check",
    configureServer() {
      setTimeout(async () => {
        try {
          const res = await fetch(`${proxyTarget}/api/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) return;
        } catch {
          // Backend no responde
        }
        console.warn("");
        console.warn("\x1b[33m⚠ Backend no está en marcha.\x1b[0m Las peticiones a /api darán ECONNREFUSED.");
        console.warn("\x1b[36m  Arranca todo desde la raíz:\x1b[0m  npm run dev");
        console.warn("\x1b[36m  O en otra terminal:\x1b[0m       cd backend && npm run dev");
        console.warn("");
      }, 1500);
    },
  };
}

export default defineConfig({
  plugins: [react(), backendCheckPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        timeout: 600000,
      },
    },
  },
});
