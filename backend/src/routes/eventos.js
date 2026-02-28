import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

const SOURCE_MODEL_MAP = {
  note:  () => prisma.note,
  link:  () => prisma.link,
  file:  () => prisma.file,
  photo: () => prisma.photo,
  audio: () => prisma.audio,
  video: () => prisma.video,
};

/**
 * GET /api/eventos
 * Lista todos los eventos de calendario, ordenados por fecha ASC.
 */
router.get("/", async (req, res) => {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    res.json(events);
  } catch (err) {
    console.error("[eventos] GET /", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/eventos
 * Crea un evento manualmente.
 * Body: { title, date, time?, description?, sourceKind?, sourceId? }
 */
router.post("/", async (req, res) => {
  const { title, date, time, description, sourceKind, sourceId } = req.body;
  if (!title || !date) {
    return res.status(400).json({ error: "title y date son obligatorios" });
  }
  try {
    const event = await prisma.calendarEvent.create({
      data: { title, date, time: time ?? null, description: description ?? null, sourceKind: sourceKind ?? null, sourceId: sourceId ?? null },
    });
    res.status(201).json(event);
  } catch (err) {
    console.error("[eventos] POST /", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/eventos/:id
 * Elimina un evento y, opcionalmente, su ítem fuente del inbox.
 * Query param: ?deleteSource=true para borrar también el origen.
 */
router.delete("/:id", async (req, res) => {
  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: "Evento no encontrado" });

    await prisma.calendarEvent.delete({ where: { id: req.params.id } });

    // Eliminar también el ítem fuente si se pide y existe
    const deleteSource = req.query.deleteSource === "true";
    if (deleteSource && event.sourceKind && event.sourceId) {
      const modelFn = SOURCE_MODEL_MAP[event.sourceKind];
      if (modelFn) {
        try {
          await modelFn().delete({ where: { id: event.sourceId } });
          console.log(`[eventos] Ítem origen eliminado: ${event.sourceKind} ${event.sourceId}`);
        } catch (err) {
          // Si el origen ya no existe, ignorar
          console.warn(`[eventos] No se pudo eliminar origen ${event.sourceKind}/${event.sourceId}:`, err.message);
        }
      }
    }

    res.status(204).end();
  } catch (err) {
    console.error("[eventos] DELETE /:id", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
