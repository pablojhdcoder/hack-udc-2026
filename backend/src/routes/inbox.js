import { Router } from "express";

const router = Router();

// POST /api/inbox - Crear entrada (link, note, file, audio)
router.post("/", async (req, res) => {
  try {
    // TODO: detectar kind y payload, clasificar tipo, guardar con Prisma
    res.status(501).json({ message: "TODO: implementar creación de entrada" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbox - Listar entradas pendientes
router.get("/", async (req, res) => {
  try {
    // TODO: consultar Link, Note, File, Audio con inboxStatus = pending
    res.status(501).json({ message: "TODO: implementar listado de inbox" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
