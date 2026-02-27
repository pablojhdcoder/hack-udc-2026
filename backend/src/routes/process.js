import { Router } from "express";

const router = Router();

// POST /api/process - Procesar entradas seleccionadas y generar Markdown
router.post("/", async (req, res) => {
  try {
    // TODO: body { ids: [{ kind, id }, ...], destination } -> generar .md, actualizar Prisma
    res.status(501).json({ message: "TODO: implementar procesado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
