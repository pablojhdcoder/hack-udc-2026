import express from "express";
import cors from "cors";
import inboxRoutes from "./routes/inbox.js";
import processRoutes from "./routes/process.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use("/api/inbox", inboxRoutes);
app.use("/api/process", processRoutes);

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
