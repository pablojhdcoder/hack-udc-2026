import { Router } from "express";
import { runVaultSearch } from "../services/searchService.js";

const router = Router();

const VALID_KINDS = ["note", "link", "file", "photo", "audio", "video"];

/**
 * GET /api/search?q=...&kind=... (kind opcional)
 * Búsqueda en el vault. Si kind está presente y es válido, busca solo en esa carpeta.
 * Devuelve array ordenado por relevancia (score).
 */
router.get("/search", async (req, res) => {
  const raw = (req.query.q || "").trim().toLowerCase();
  if (!raw) return res.json([]);

  const kindParam = (req.query.kind || "").trim().toLowerCase();
  const singleKind = VALID_KINDS.includes(kindParam) ? kindParam : null;

  try {
    const scored = await runVaultSearch(raw, singleKind);
    res.json(scored);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Error en búsqueda" });
  }
});

export default router;
