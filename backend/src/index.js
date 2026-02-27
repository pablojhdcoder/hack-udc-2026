import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import inboxRoutes from "./routes/inbox.js";
import processRoutes from "./routes/process.js";
import knowledgeRoutes from "./routes/knowledge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Servir ficheros subidos (para preview de imágenes en el frontend)
app.use("/api/uploads", express.static(path.join(rootDir, "uploads")));

app.use("/api/inbox", inboxRoutes);
app.use("/api/process", processRoutes);
app.use("/api/knowledge", knowledgeRoutes);

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
