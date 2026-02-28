import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "../lib/prisma.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseAI(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Calcula la puntuación de relevancia de un item frente a los tokens de búsqueda.
 * Compara cada token contra: aiTitle, aiTags, topic, aiTopics, aiCategory, filename.
 *
 * Sistema de pesos:
 *   aiTitle       → exacto: 20 | parcial: 10
 *   aiTags        → exacto: 15 | parcial:  8
 *   topic (DB)    → exacto: 15 | parcial:  8
 *   aiTopics      → exacto: 12 | parcial:  6
 *   aiCategory    → exacto: 10 | parcial:  5
 *   filename/url  → parcial:  3
 *
 * Bonus de cobertura: se multiplica por (0.4 + 0.6 * fracciónTokensQueCoinciden)
 * para premiar cuando la mayoría de palabras de la búsqueda aparecen en el item.
 */
function scoreItem(item, tokens) {
  if (!tokens.length) return 0;

  const lc = (s) => (s ?? "").toString().toLowerCase();

  const title   = lc(item.aiTitle ?? item.title ?? item.filename);
  const fname   = lc(item.filename ?? item.url ?? "");
  const cat     = lc(item.aiCategory);
  const topic   = lc(item.topic);
  const tags    = (item.aiTags ?? []).map((t) => lc(t));
  const topics  = (item.aiTopics ?? []).map((t) => lc(t));

  let totalScore = 0;
  const matchedTokens = new Set();

  for (const token of tokens) {
    let tokenScore = 0;

    // --- aiTitle (prioridad máxima) ---
    if (title === token)         { tokenScore += 20; matchedTokens.add(token); }
    else if (title.includes(token)) { tokenScore += 10; matchedTokens.add(token); }

    // --- aiTags ---
    for (const tag of tags) {
      if (tag === token)            { tokenScore += 15; matchedTokens.add(token); break; }
      else if (tag.includes(token)) { tokenScore +=  8; matchedTokens.add(token); break; }
    }

    // --- topic (campo DB) ---
    if (topic === token)            { tokenScore += 15; matchedTokens.add(token); }
    else if (topic.includes(token)) { tokenScore +=  8; matchedTokens.add(token); }

    // --- aiTopics ---
    for (const t of topics) {
      if (t === token)            { tokenScore += 12; matchedTokens.add(token); break; }
      else if (t.includes(token)) { tokenScore +=  6; matchedTokens.add(token); break; }
    }

    // --- aiCategory ---
    if (cat === token)            { tokenScore += 10; matchedTokens.add(token); }
    else if (cat.includes(token)) { tokenScore +=  5; matchedTokens.add(token); }

    // --- filename / url (fallback) ---
    if (fname.includes(token))    { tokenScore +=  3; matchedTokens.add(token); }

    totalScore += tokenScore;
  }

  // Bonus de cobertura: penaliza si solo coinciden pocos de los tokens buscados
  const coverage = matchedTokens.size / tokens.length;
  totalScore = totalScore * (0.4 + 0.6 * coverage);

  return Math.round(totalScore);
}

/**
 * GET /api/search?q=...
 * Busca en todas las entidades del vault comparando la query (tokenizada) contra:
 *   title, tags, topic, topics y category de la IA, además de filename/url/content.
 * Devuelve array ordenado de mayor a menor relevancia, con campo `score`.
 */
router.get("/search", async (req, res) => {
  const raw = (req.query.q || "").trim().toLowerCase();
  if (!raw) return res.json([]);

  // Tokenizar la query: divide por espacios y elimina duplicados
  const tokens = [...new Set(raw.split(/\s+/).filter(Boolean))];

  // Para SQLite: buscar por subcadena en campos principales + JSON de aiEnrichment
  const aiFilter = { aiEnrichment: { contains: raw } };

  // También filtramos por cada token individualmente en aiEnrichment para búsquedas multi-palabra
  const aiTokenFilters = tokens.map((t) => ({ aiEnrichment: { contains: t } }));

  try {
    const [notes, links, files, photos, audios, videos] = await Promise.all([
      prisma.note.findMany({
        where: {
          OR: [
            { content: { contains: raw } },
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, content: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.link.findMany({
        where: {
          OR: [
            { url: { contains: raw } },
            { title: { contains: raw } },
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, url: true, title: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.file.findMany({
        where: {
          OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters],
        },
        select: { id: true, filename: true, filePath: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.photo.findMany({
        where: {
          OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters],
        },
        select: { id: true, filename: true, filePath: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.audio.findMany({
        where: {
          OR: [
            { filePath: { contains: raw } },
            { transcription: { contains: raw } },
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, filePath: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
      prisma.video.findMany({
        where: {
          OR: [{ filePath: { contains: raw } }, { title: { contains: raw } }, aiFilter, ...aiTokenFilters],
        },
        select: { id: true, filePath: true, title: true, topic: true, aiEnrichment: true, processedPath: true, createdAt: true },
      }),
    ]);

    const toUrl = (filePath) => {
      if (!filePath) return null;
      return `/api/uploads/${path.basename(filePath)}`;
    };

    const normalizeAI = (raw) => {
      const ai = parseAI(raw);
      return {
        aiTitle:    ai?.title    ?? null,
        aiTags:     Array.isArray(ai?.tags)   ? ai.tags   : [],
        aiTopics:   Array.isArray(ai?.topics) ? ai.topics : [],
        aiCategory: ai?.category ?? null,
      };
    };

    // Deduplicar por kind+id (la búsqueda multi-token puede traer duplicados)
    const seen = new Set();
    const dedup = (arr) => arr.filter((x) => {
      const k = `${x.kind}:${x.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const out = dedup([
      ...notes.map((n) => ({
        id: n.id,
        kind: "note",
        filename: n.content?.slice(0, 80) || "Nota",
        title: n.content?.slice(0, 80) || null,
        topic: n.topic ?? null,
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
        topic: l.topic ?? null,
        processedPath: l.processedPath,
        createdAt: l.createdAt,
        ...normalizeAI(l.aiEnrichment),
      })),
      ...files.map((f) => ({
        id: f.id,
        kind: "file",
        filename: f.filename,
        filePath: f.filePath,
        topic: f.topic ?? null,
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
        topic: p.topic ?? null,
        processedPath: p.processedPath,
        createdAt: p.createdAt,
        ...normalizeAI(p.aiEnrichment),
      })),
      ...audios.map((a) => ({
        id: a.id,
        kind: "audio",
        filename: path.basename(a.filePath) || "Audio",
        filePath: a.filePath,
        topic: a.topic ?? null,
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
        topic: v.topic ?? null,
        processedPath: v.processedPath,
        createdAt: v.createdAt,
        ...normalizeAI(v.aiEnrichment),
      })),
    ]);

    // Calcular puntuación y ordenar de mayor a menor relevancia
    const scored = out
      .map((item) => ({ ...item, score: scoreItem(item, tokens) }))
      .sort((a, b) => b.score - a.score);

    res.json(scored);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Error en búsqueda" });
  }
});

export default router;
