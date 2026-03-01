import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// GET /api/topics — Lista todos los temas con su resumen y conteo
router.get("/", async (req, res) => {
  try {
    const topics = await prisma.topicSummary.findMany({
      orderBy: { itemCount: "desc" },
    });
    res.json(
      topics.map((t) => ({
        id: t.id,
        topic: t.topic,
        summary: t.summary,
        itemCount: t.itemCount,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
        sourceItems: (() => {
          try { return JSON.parse(t.sourceItems); } catch { return []; }
        })(),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/topics/:topic — Detalle de un tema concreto
router.get("/:topic", async (req, res) => {
  try {
    const record = await prisma.topicSummary.findUnique({
      where: { topic: req.params.topic.toLowerCase() },
    });
    if (!record) return res.status(404).json({ error: "Tema no encontrado" });
    res.json({
      id: record.id,
      topic: record.topic,
      summary: record.summary,
      itemCount: record.itemCount,
      updatedAt: record.updatedAt,
      createdAt: record.createdAt,
      sourceItems: (() => {
        try { return JSON.parse(record.sourceItems); } catch { return []; }
      })(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
