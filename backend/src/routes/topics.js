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
    const msg = err?.message ?? String(err);
    // Si la tabla no existe (migraciones sin aplicar), devolver lista vacía para no romper la pantalla
    if (/table.*TopicSummary|no such table|does not exist/i.test(msg)) {
      console.warn("[Topics] Tabla TopicSummary no encontrada. Ejecuta: npx prisma migrate dev o npx prisma db push");
      return res.json([]);
    }
    console.error("[Topics] GET / error:", msg);
    res.status(500).json({ error: msg });
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
    const msg = err?.message ?? String(err);
    console.error("[Topics] GET /:topic error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
