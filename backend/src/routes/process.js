import { Router } from "express";
import { processItem } from "../services/processService.js";

const router = Router();

function isValidIdEntry(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.kind === "string" &&
    typeof obj.id === "string" &&
    ["link", "note", "file", "photo", "audio", "video"].includes(obj.kind) &&
    obj.id.trim().length > 0
  );
}

// POST /api/process - Procesar entradas seleccionadas y generar Markdown (puede tardar si usa IA)
router.post("/", async (req, res) => {
  const send = (status, data) => {
    if (res.headersSent) return;
    res.status(status).json(data);
  };
  try {
    const { ids, destination } = req.body ?? {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return send(400, { error: "ids debe ser un array no vacío de { kind, id }" });
    }
    if (typeof destination !== "string" || !destination.trim()) {
      return send(400, { error: "destination es obligatorio (string no vacío)" });
    }

    const validIds = ids.filter(isValidIdEntry);
    if (validIds.length === 0) {
      return send(400, { error: "Ningún ítem en ids tiene formato válido { kind, id }" });
    }

    console.log("[Process] Iniciando procesado de", validIds.length, "ítem(s)...");
    const results = await Promise.all(
      validIds.map((item) => processItem({ kind: item.kind, id: item.id }, destination.trim()))
    );
    console.log("[Process] Completado:", results.length, "resultado(s)");
    send(200, { results });
  } catch (err) {
    console.error("[Process] Error:", err.message);
    send(500, { error: err.message ?? "Error al procesar" });
  }
});

export default router;
