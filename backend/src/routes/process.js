import { Router } from "express";
import { processItem } from "../services/processService.js";

const router = Router();

function isValidIdEntry(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.kind === "string" &&
    typeof obj.id === "string" &&
    ["link", "note", "file", "audio"].includes(obj.kind) &&
    obj.id.trim().length > 0
  );
}

// POST /api/process - Procesar entradas seleccionadas y generar Markdown
router.post("/", async (req, res) => {
  try {
    const { ids, destination } = req.body ?? {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids debe ser un array no vacío de { kind, id }" });
    }
    if (typeof destination !== "string" || !destination.trim()) {
      return res.status(400).json({ error: "destination es obligatorio (string no vacío)" });
    }

    const validIds = ids.filter(isValidIdEntry);
    if (validIds.length === 0) {
      return res.status(400).json({ error: "Ningún ítem en ids tiene formato válido { kind, id }" });
    }

    const results = await Promise.all(
      validIds.map((item) => processItem({ kind: item.kind, id: item.id }, destination.trim()))
    );

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
