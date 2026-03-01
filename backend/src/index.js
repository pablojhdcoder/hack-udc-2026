// SPDX-License-Identifier: MIT
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Cargar .env del backend para DATABASE_URL, PORT, etc.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import http from "http";
import express from "express";
import cors from "cors";
import inboxRoutes from "./routes/inbox.js";
import processRoutes from "./routes/process.js";
import searchRoutes from "./routes/search.js";
import chatRoutes from "./routes/chat.js";
import eventosRoutes from "./routes/eventos.js";

const rootDir = path.join(__dirname, "..");
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Servir ficheros subidos (para preview de imágenes en el frontend)
app.use("/api/uploads", express.static(path.join(rootDir, "uploads")));

app.use("/api/inbox", inboxRoutes);
app.use("/api/process", processRoutes);
app.use("/api", searchRoutes);
app.use("/api", chatRoutes);
app.use("/api/eventos", eventosRoutes);

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

// Si el puerto está en uso, probar el siguiente (3002, 3003, ...) hasta levantar
const server = http.createServer(app);
const PORT_BASE = Number(process.env.PORT) || 3001;
const PORT_MAX = PORT_BASE + 20;

function startServer(tryPort = PORT_BASE) {
  server.removeAllListeners("error");
  server.listen(tryPort, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${tryPort}`);
    if (tryPort !== PORT_BASE) {
      console.log(`(Puerto ${PORT_BASE} estaba en uso. Configura el frontend proxy a ${tryPort} o usa PORT=${tryPort})`);
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && tryPort < PORT_MAX) {
      console.warn(`Puerto ${tryPort} en uso, probando ${tryPort + 1}...`);
      server.close(() => startServer(tryPort + 1));
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer();
