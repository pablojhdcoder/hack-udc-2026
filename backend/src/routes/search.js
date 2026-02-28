import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../lib/prisma.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * GET /api/search?q=...
 * Busca en filename/title/content y topic en todas las entidades del vault.
 * Devuelve array normalizado con { id, kind, filename, title?, topic, filePath?, url?, thumbnailUrl? }.
 */
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  // SQLite no soporta mode: 'insensitive'; la búsqueda es case-sensitive
  const searchFilter = (field) => ({ [field]: { contains: q } });
  const topicFilter = { topic: { contains: q } };

  try {
    const [notes, links, files, photos, audios, videos] = await Promise.all([
      prisma.note.findMany({
        where: {
          OR: [{ content: { contains: q } }, topicFilter],
        },
        select: { id: true, content: true, topic: true, processedPath: true, createdAt: true },
      }),
      prisma.link.findMany({
        where: {
          OR: [
            { url: { contains: q } },
            { title: { contains: q } },
            topicFilter,
          ],
        },
        select: { id: true, url: true, title: true, topic: true, processedPath: true, createdAt: true },
      }),
      prisma.file.findMany({
        where: {
          OR: [searchFilter("filename"), topicFilter],
        },
        select: { id: true, filename: true, filePath: true, topic: true, processedPath: true, createdAt: true },
      }),
      prisma.photo.findMany({
        where: {
          OR: [searchFilter("filename"), topicFilter],
        },
        select: { id: true, filename: true, filePath: true, topic: true, processedPath: true, createdAt: true },
      }),
      prisma.audio.findMany({
        where: {
          OR: [
            searchFilter("filePath"),
            { transcription: { contains: q } },
            topicFilter,
          ],
        },
        select: { id: true, filePath: true, topic: true, processedPath: true, createdAt: true },
      }),
      prisma.video.findMany({
        where: {
          OR: [searchFilter("filePath"), { title: { contains: q } }, topicFilter],
        },
        select: { id: true, filePath: true, title: true, topic: true, processedPath: true, createdAt: true },
      }),
    ]);

    const toUrl = (filePath) => {
      if (!filePath) return null;
      const basename = path.basename(filePath);
      return `/api/uploads/${basename}`;
    };

    const out = [
      ...notes.map((n) => ({
        id: n.id,
        kind: "note",
        filename: n.content?.slice(0, 80) || "Nota",
        title: n.content?.slice(0, 80) || null,
        topic: n.topic,
        processedPath: n.processedPath,
        createdAt: n.createdAt,
      })),
      ...links.map((l) => ({
        id: l.id,
        kind: "link",
        filename: l.title || l.url?.slice(0, 50) || "Enlace",
        title: l.title,
        url: l.url,
        topic: l.topic,
        processedPath: l.processedPath,
        createdAt: l.createdAt,
      })),
      ...files.map((f) => ({
        id: f.id,
        kind: "file",
        filename: f.filename,
        filePath: f.filePath,
        topic: f.topic,
        processedPath: f.processedPath,
        createdAt: f.createdAt,
      })),
      ...photos.map((p) => ({
        id: p.id,
        kind: "photo",
        filename: p.filename,
        filePath: p.filePath,
        topic: p.topic,
        thumbnailUrl: toUrl(p.filePath),
        processedPath: p.processedPath,
        createdAt: p.createdAt,
      })),
      ...audios.map((a) => ({
        id: a.id,
        kind: "audio",
        filename: path.basename(a.filePath) || "Audio",
        filePath: a.filePath,
        topic: a.topic,
        processedPath: a.processedPath,
        createdAt: a.createdAt,
      })),
      ...videos.map((v) => ({
        id: v.id,
        kind: "video",
        filename: v.title || path.basename(v.filePath) || "Video",
        title: v.title,
        filePath: v.filePath,
        topic: v.topic,
        thumbnailUrl: null,
        processedPath: v.processedPath,
        createdAt: v.createdAt,
      })),
    ];

    res.json(out);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Error en búsqueda" });
  }
});

export default router;
