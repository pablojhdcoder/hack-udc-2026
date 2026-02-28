import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../lib/prisma.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parsea el campo aiEnrichment (string JSON) y extrae title, topics y category.
 * También busca coincidencia con la query para saber si aplica como resultado de IA.
 */
function parseAI(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Comprueba si la query coincide con algún campo del aiEnrichment (title, topics, category).
 * Se usa para filtrar en JS cuando SQLite ya devolvió el item por otros criterios.
 */
function aiMatches(ai, q) {
  if (!ai) return false;
  if (ai.title && ai.title.toLowerCase().includes(q)) return true;
  if (ai.category && ai.category.toLowerCase().includes(q)) return true;
  if (Array.isArray(ai.topics)) {
    return ai.topics.some((t) => t && t.toLowerCase().includes(q));
  }
  return false;
}

/**
 * GET /api/search?q=...
 * Busca por filename/title/url/content y también dentro de aiEnrichment
 * (title, topics, category) en todas las entidades del vault.
 * Devuelve array normalizado con { id, kind, filename, title?, aiTitle, aiTopics, aiCategory, filePath?, url?, thumbnailUrl? }.
 */
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  // SQLite no soporta mode: 'insensitive'; la búsqueda es case-sensitive por defecto.
  // aiEnrichment se almacena como JSON string → contains busca la subcadena dentro del JSON completo,
  // lo que incluye title, topics y category de forma nativa.
  const aiFilter = { aiEnrichment: { contains: q } };

  try {
    const [notes, links, files, photos, audios, videos] = await Promise.all([
      prisma.note.findMany({
        where: {
          OR: [{ content: { contains: q } }, aiFilter],
        },
        select: { id: true, content: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.link.findMany({
        where: {
          OR: [
            { url: { contains: q } },
            { title: { contains: q } },
            aiFilter,
          ],
        },
        select: { id: true, url: true, title: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.file.findMany({
        where: {
          OR: [{ filename: { contains: q } }, aiFilter],
        },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.photo.findMany({
        where: {
          OR: [{ filename: { contains: q } }, aiFilter],
        },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.audio.findMany({
        where: {
          OR: [
            { filePath: { contains: q } },
            { transcription: { contains: q } },
            aiFilter,
          ],
        },
        select: { id: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.video.findMany({
        where: {
          OR: [{ filePath: { contains: q } }, { title: { contains: q } }, aiFilter],
        },
        select: { id: true, filePath: true, title: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
    ]);

    const toUrl = (filePath) => {
      if (!filePath) return null;
      const basename = path.basename(filePath);
      return `/api/uploads/${basename}`;
    };

    const normalizeAI = (raw) => {
      const ai = parseAI(raw);
      return {
        aiTitle: ai?.title ?? null,
        aiTopics: Array.isArray(ai?.topics) ? ai.topics : [],
        aiCategory: ai?.category ?? null,
      };
    };

    const out = [
      ...notes.map((n) => ({
        id: n.id,
        kind: "note",
        filename: n.content?.slice(0, 80) || "Nota",
        title: n.content?.slice(0, 80) || null,
        processedPath: n.processedPath,
        createdAt: n.createdAt,
        ...normalizeAI(n.aiEnrichment),
      })),
      ...links.map((l) => ({
        id: l.id,
        kind: "link",
        filename: l.title || l.url?.slice(0, 50) || "Enlace",
        title: l.title,
        url: l.url,
        processedPath: l.processedPath,
        createdAt: l.createdAt,
        ...normalizeAI(l.aiEnrichment),
      })),
      ...files.map((f) => ({
        id: f.id,
        kind: "file",
        filename: f.filename,
        filePath: f.filePath,
        processedPath: f.processedPath,
        createdAt: f.createdAt,
        ...normalizeAI(f.aiEnrichment),
      })),
      ...photos.map((p) => ({
        id: p.id,
        kind: "photo",
        filename: p.filename,
        filePath: p.filePath,
        thumbnailUrl: toUrl(p.filePath),
        processedPath: p.processedPath,
        createdAt: p.createdAt,
        ...normalizeAI(p.aiEnrichment),
      })),
      ...audios.map((a) => ({
        id: a.id,
        kind: "audio",
        filename: path.basename(a.filePath) || "Audio",
        filePath: a.filePath,
        processedPath: a.processedPath,
        createdAt: a.createdAt,
        ...normalizeAI(a.aiEnrichment),
      })),
      ...videos.map((v) => ({
        id: v.id,
        kind: "video",
        filename: v.title || path.basename(v.filePath) || "Video",
        title: v.title,
        filePath: v.filePath,
        thumbnailUrl: null,
        processedPath: v.processedPath,
        createdAt: v.createdAt,
        ...normalizeAI(v.aiEnrichment),
      })),
    ];

    res.json(out);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Error en búsqueda" });
  }
});

export default router;
