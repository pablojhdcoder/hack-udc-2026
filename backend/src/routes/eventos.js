import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

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
 * Elimina un evento.
 */
router.delete("/:id", async (req, res) => {
  try {
    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    console.error("[eventos] DELETE /:id", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
