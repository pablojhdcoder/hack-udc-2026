import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El backend debe estar en marcha o verás ECONNREFUSED en /api.
// Desde la raíz del proyecto: npm run dev (arranca backend + frontend).
// O en otra terminal: cd backend && npm run dev
const API_PORT = process.env.VITE_API_PORT || process.env.PORT || 3001;
const proxyTarget = `http://localhost:${API_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        // Timeout largo para rutas lentas (ej. /api/process con enriquecimiento IA)
        timeout: 300000, // 5 min
      },
    },
  },
});
