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
 * Comprueba si al menos un token coincide en campos permitidos (no en summary).
 * Así excluimos ítems que solo coincidían por aiEnrichment.summary.
 */
function matchesAllowedFields(tokens, fields) {
  if (!tokens.length) return true;
  const lc = (s) => (s ?? "").toString().toLowerCase();
  const ai = parseAI(fields.aiEnrichment);
  const aiTitle = lc(ai?.title);
  const aiTopics = (Array.isArray(ai?.topics) ? ai.topics : []).map((t) => lc(t));
  const aiCat = lc(ai?.category);

  for (const token of tokens) {
    if (fields.content && lc(fields.content).includes(token)) return true;
    if (fields.url && lc(fields.url).includes(token)) return true;
    if (fields.title && lc(fields.title).includes(token)) return true;
    if (fields.filename && lc(fields.filename).includes(token)) return true;
    if (fields.filePath && lc(fields.filePath).includes(token)) return true;
    if (fields.metadata && lc(fields.metadata).includes(token)) return true;
    if (fields.transcription && lc(fields.transcription).includes(token)) return true;
    // Título: coincidencia parcial en ambos sentidos (token en título o título en token)
    if (aiTitle && (aiTitle.includes(token) || (aiTitle.length >= 2 && token.includes(aiTitle)))) return true;
    if (aiTopics.some((t) => t === token || t.includes(token))) return true;
    if (aiCat && aiCat.includes(token)) return true;
  }
  return false;
}

/**
 * Calcula la puntuación de relevancia de un item frente a los tokens de búsqueda.
 * Compara cada token contra: aiTitle, aiTags/aiTopics (mismo concepto), aiCategory, filename.
 *
 * Sistema de pesos:
 *   aiTitle       → exacto: 20 | parcial: 10 (token en título o título en token)
 *   aiTags/aiTopics → exacto: 15 | parcial: 8  (topics del enrichment, única fuente)
 *   aiCategory    → exacto: 10 | parcial:  5
 *   filename/url  → parcial:  3
 *
 * Bonus de cobertura: se multiplica por (0.4 + 0.6 * fracciónTokensQueCoinciden)
 * para premiar cuando la mayoría de palabras de la búsqueda aparecen en el item.
 */
function scoreItem(item, tokens) {
  if (!tokens.length) return 0;

  const lc = (s) => (s ?? "").toString().toLowerCase();

  const title = lc(item.aiTitle ?? item.title ?? item.filename);
  const fname = lc(item.filename ?? item.url ?? "");
  const cat   = lc(item.aiCategory);
  // Tags y topics son el mismo concepto: array de aiEnrichment.topics
  const tags  = (item.aiTags ?? item.aiTopics ?? []).map((t) => lc(t));

  let totalScore = 0;
  const matchedTokens = new Set();

  for (const token of tokens) {
    let tokenScore = 0;

    // --- aiTitle (prioridad máxima): exacto, o coincidencia parcial (token en título o título en token) ---
    if (title === token) { tokenScore += 20; matchedTokens.add(token); }
    else if (title.includes(token)) { tokenScore += 10; matchedTokens.add(token); }
    else if (title.length >= 2 && token.includes(title)) { tokenScore += 10; matchedTokens.add(token); }

    // --- aiTags/aiTopics (topics del enrichment: prioridad alta 15/8) ---
    for (const tag of tags) {
      if (tag === token)             { tokenScore += 15; matchedTokens.add(token); break; }
      else if (tag.includes(token))  { tokenScore +=  8; matchedTokens.add(token); break; }
    }

    // --- aiCategory ---
    if (cat === token)               { tokenScore += 10; matchedTokens.add(token); }
    else if (cat.includes(token))    { tokenScore +=  5; matchedTokens.add(token); }

    // --- filename / url (fallback) ---
    if (fname.includes(token))       { tokenScore +=  3; matchedTokens.add(token); }

    totalScore += tokenScore;
  }

  // Bonus de cobertura: penaliza si solo coinciden pocos de los tokens buscados
  const coverage = matchedTokens.size / tokens.length;
  totalScore = totalScore * (0.4 + 0.6 * coverage);

  return Math.round(totalScore);
}

const VALID_KINDS = ["note", "link", "file", "photo", "audio", "video"];

/**
 * Ejecuta findMany para un solo kind con los filtros de búsqueda.
 * @param {string} kind - note | link | file | photo | audio | video
 * @param {string} raw - query en minúsculas
 * @param {object} filters - { aiFilter, aiTokenFilters, rawTokens }
 */
async function searchByKind(kind, raw, { aiFilter, aiTokenFilters, rawTokens }) {
  switch (kind) {
    case "note":
      return prisma.note.findMany({
        where: {
          OR: [
            { content: { contains: raw } },
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, content: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "link":
      return prisma.link.findMany({
        where: {
          OR: [
            { url: { contains: raw } },
            { title: { contains: raw } },
            { metadata: { contains: raw } },
            ...rawTokens.map((t) => ({ metadata: { contains: t } })),
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, url: true, title: true, metadata: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "file":
      return prisma.file.findMany({
        where: { OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "photo":
      return prisma.photo.findMany({
        where: { OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "audio":
      return prisma.audio.findMany({
        where: {
          OR: [
            { filePath: { contains: raw } },
            { transcription: { contains: raw } },
            aiFilter,
            ...aiTokenFilters,
          ],
        },
        select: { id: true, filePath: true, transcription: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "video":
      return prisma.video.findMany({
        where: { OR: [{ filePath: { contains: raw } }, { title: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filePath: true, title: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    default:
      return [];
  }
}

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

  // Tokenizar: espacios, sin duplicados; si hay varias palabras, ignorar tokens de 1 carácter (ruido)
  const rawTokens = [...new Set(raw.split(/\s+/).filter(Boolean))];
  const tokens = rawTokens.length > 1
    ? rawTokens.filter((t) => t.length >= 2)
    : rawTokens;
  const tokensToUse = tokens.length > 0 ? tokens : rawTokens;

  const aiFilter = { aiEnrichment: { contains: raw } };
  const aiTokenFilters = rawTokens.map((t) => ({ aiEnrichment: { contains: t } }));
  const filters = { aiFilter, aiTokenFilters, rawTokens };

  try {
    let notes = [];
    let links = [];
    let files = [];
    let photos = [];
    let audios = [];
    let videos = [];

    if (singleKind) {
      const result = await searchByKind(singleKind, raw, filters);
      switch (singleKind) {
        case "note": notes = result; break;
        case "link": links = result; break;
        case "file": files = result; break;
        case "photo": photos = result; break;
        case "audio": audios = result; break;
        case "video": videos = result; break;
      }
    } else {
      [notes, links, files, photos, audios, videos] = await Promise.all([
        searchByKind("note", raw, filters),
        searchByKind("link", raw, filters),
        searchByKind("file", raw, filters),
        searchByKind("photo", raw, filters),
        searchByKind("audio", raw, filters),
        searchByKind("video", raw, filters),
      ]);
    }

    const toUrl = (filePath) => {
      if (!filePath) return null;
      return `/api/uploads/${path.basename(filePath)}`;
    };

    const normalizeAI = (raw) => {
      const ai = parseAI(raw);
      const allTopics = Array.isArray(ai?.topics) ? ai.topics : [];
      return {
        aiTitle:    ai?.title    ?? null,
        aiTags:     allTopics,
        aiTopics:   allTopics,
        aiCategory: ai?.category ?? null,
        topic:      allTopics[0] ?? null,
      };
    };

    // Excluir ítems que solo coincidían en summary (u otros campos no permitidos)
    const allowed = (list, getFields) => list.filter((row) => matchesAllowedFields(tokensToUse, getFields(row)));

    const notesFiltered = allowed(notes, (n) => ({ content: n.content, aiEnrichment: n.aiEnrichment }));
    const linksFiltered = allowed(links, (l) => ({ url: l.url, title: l.title, metadata: l.metadata, aiEnrichment: l.aiEnrichment }));
    const filesFiltered = allowed(files, (f) => ({ filename: f.filename, filePath: f.filePath, aiEnrichment: f.aiEnrichment }));
    const photosFiltered = allowed(photos, (p) => ({ filename: p.filename, filePath: p.filePath, aiEnrichment: p.aiEnrichment }));
    const audiosFiltered = allowed(audios, (a) => ({ filePath: a.filePath, transcription: a.transcription, aiEnrichment: a.aiEnrichment }));
    const videosFiltered = allowed(videos, (v) => ({ filePath: v.filePath, title: v.title, aiEnrichment: v.aiEnrichment }));

    const seen = new Set();
    const dedup = (arr) => arr.filter((x) => {
      const k = `${x.kind}:${x.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const out = dedup([
      ...notesFiltered.map((n) => ({
        id: n.id,
        kind: "note",
        filename: n.content?.slice(0, 80) || "Nota",
        title: n.content?.slice(0, 80) || null,
        processedPath: n.processedPath,
        createdAt: n.createdAt,
        ...normalizeAI(n.aiEnrichment),
      })),
      ...linksFiltered.map((l) => ({
        id: l.id,
        kind: "link",
        filename: l.title || l.url?.slice(0, 50) || "Enlace",
        title: l.title,
        url: l.url,
        processedPath: l.processedPath,
        createdAt: l.createdAt,
        ...normalizeAI(l.aiEnrichment),
      })),
      ...filesFiltered.map((f) => ({
        id: f.id,
        kind: "file",
        filename: f.filename,
        filePath: f.filePath,
        processedPath: f.processedPath,
        createdAt: f.createdAt,
        ...normalizeAI(f.aiEnrichment),
      })),
      ...photosFiltered.map((p) => ({
        id: p.id,
        kind: "photo",
        filename: p.filename,
        filePath: p.filePath,
        thumbnailUrl: toUrl(p.filePath),
        processedPath: p.processedPath,
        createdAt: p.createdAt,
        ...normalizeAI(p.aiEnrichment),
      })),
      ...audiosFiltered.map((a) => ({
        id: a.id,
        kind: "audio",
        filename: path.basename(a.filePath) || "Audio",
        filePath: a.filePath,
        processedPath: a.processedPath,
        createdAt: a.createdAt,
        ...normalizeAI(a.aiEnrichment),
      })),
      ...videosFiltered.map((v) => ({
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
    ]);

    // Calcular puntuación y ordenar de mayor a menor relevancia
    const scored = out
      .map((item) => ({ ...item, score: scoreItem(item, tokensToUse) }))
      .sort((a, b) => b.score - a.score);

    res.json(scored);
  } catch (err) {
    console.error("[search]", err);
    res.status(500).json({ error: err.message || "Error en búsqueda" });
  }
});

export default router;
