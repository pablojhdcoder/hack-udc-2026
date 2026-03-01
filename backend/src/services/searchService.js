/**
 * searchService.js — Lógica de búsqueda del baúl reutilizable (vault search).
 * Usado por GET /api/search y por el chat cuando el LLM devuelve searchQuery.
 * Incluye normalización (minúsculas + sin acentos) y filtrado multi-campo por tokens.
 */

import path from "path";
import prisma from "../lib/prisma.js";

/**
 * Normaliza texto para búsqueda: minúsculas y sin diacríticos/acentos.
 */
function normalizeText(text) {
  if (text == null || typeof text !== "string") return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseAI(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Tokens de búsqueda significativos: longitud > 3 para ignorar "de", "con", etc.
 * Si no queda ninguno, se usan todos los tokens (mínimo longitud 1).
 */
function getSearchTerms(normalizedQuery) {
  const all = normalizedQuery.split(/\s+/).filter(Boolean);
  const significant = all.filter((t) => t.length > 3);
  return significant.length > 0 ? significant : all;
}

/**
 * Construye el texto buscable de un ítem (title, folder/category, summary, topics) ya normalizado.
 */
function buildSearchableText(item) {
  const title = item.aiTitle ?? item.title ?? item.filename ?? "";
  const folder = item.aiCategory ?? item.kind ?? "";
  const summary = item.aiSummary ?? "";
  const topics = (item.aiTopics ?? item.aiTags ?? [])
    .filter(Boolean)
    .map((t) => String(t))
    .join(" ");
  return normalizeText([title, folder, summary, topics].join(" "));
}

/**
 * Comprueba si el ítem coincide con la búsqueda: al menos un término de búsqueda
 * está incluido en el texto buscable (normalizado) del ítem, o coincide por palabra
 * (p. ej. "cita" en la nota con término "citas").
 */
function itemMatchesNormalizedSearch(item, searchTerms) {
  if (!searchTerms.length) return true;
  const searchableText = buildSearchableText(item);
  const words = searchableText.split(/\s+/).filter(Boolean);
  return searchTerms.some(
    (term) =>
      searchableText.includes(term) ||
      words.some((word) => word.includes(term) || term.includes(word))
  );
}

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
    if (aiTitle && (aiTitle.includes(token) || (aiTitle.length >= 2 && token.includes(aiTitle)))) return true;
    if (aiTopics.some((t) => t === token || t.includes(token))) return true;
    if (aiCat && aiCat.includes(token)) return true;
  }
  return false;
}

function scoreItem(item, tokens) {
  if (!tokens.length) return 0;
  const lc = (s) => (s ?? "").toString().toLowerCase();
  const title = lc(item.aiTitle ?? item.title ?? item.filename);
  const fname = lc(item.filename ?? item.url ?? "");
  const cat = lc(item.aiCategory);
  const tags = (item.aiTags ?? item.aiTopics ?? []).map((t) => lc(t));

  let totalScore = 0;
  const matchedTokens = new Set();

  for (const token of tokens) {
    let tokenScore = 0;
    if (title === token) { tokenScore += 20; matchedTokens.add(token); }
    else if (title.includes(token)) { tokenScore += 10; matchedTokens.add(token); }
    else if (title.length >= 2 && token.includes(title)) { tokenScore += 10; matchedTokens.add(token); }
    for (const tag of tags) {
      if (tag === token) { tokenScore += 15; matchedTokens.add(token); break; }
      else if (tag.includes(token)) { tokenScore += 8; matchedTokens.add(token); break; }
    }
    if (cat === token) { tokenScore += 10; matchedTokens.add(token); }
    else if (cat.includes(token)) { tokenScore += 5; matchedTokens.add(token); }
    if (fname.includes(token)) { tokenScore += 3; matchedTokens.add(token); }
    totalScore += tokenScore;
  }

  const coverage = matchedTokens.size / tokens.length;
  totalScore = totalScore * (0.4 + 0.6 * coverage);
  return Math.round(totalScore);
}

const VALID_KINDS = ["note", "link", "file", "photo", "audio", "video"];

const whereProcessed = { inboxStatus: "processed" };

async function searchByKind(kind, raw, { aiFilter, aiTokenFilters, rawTokens }) {
  switch (kind) {
    case "note":
      return prisma.note.findMany({
        where: { ...whereProcessed, OR: [{ content: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, content: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "link":
      return prisma.link.findMany({
        where: {
          ...whereProcessed,
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
        where: { ...whereProcessed, OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "photo":
      return prisma.photo.findMany({
        where: { ...whereProcessed, OR: [{ filename: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "audio":
      return prisma.audio.findMany({
        where: { ...whereProcessed, OR: [{ filePath: { contains: raw } }, { transcription: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filePath: true, transcription: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    case "video":
      return prisma.video.findMany({
        where: { ...whereProcessed, OR: [{ filePath: { contains: raw } }, { title: { contains: raw } }, aiFilter, ...aiTokenFilters] },
        select: { id: true, filePath: true, title: true, aiEnrichment: true, processedPath: true, createdAt: true },
      });
    default:
      return [];
  }
}

/** Obtiene ítems procesados recientes sin filtro de texto (para búsqueda normalizada en memoria). */
async function fetchRecentProcessed(limitPerKind = 50) {
  const [notes, links, files, photos, audios, videos] = await Promise.all([
    prisma.note.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, content: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
    prisma.link.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, url: true, title: true, metadata: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
    prisma.file.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
    prisma.photo.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, filename: true, filePath: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
    prisma.audio.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, filePath: true, transcription: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
    prisma.video.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: limitPerKind, select: { id: true, filePath: true, title: true, aiEnrichment: true, processedPath: true, createdAt: true } }),
  ]);
  return { notes, links, files, photos, audios, videos };
}

/**
 * Ejecuta la búsqueda del baúl (misma lógica que GET /api/search).
 * Usa normalización (minúsculas, sin acentos) y filtrado multi-campo por tokens (título, carpeta, resumen, topics).
 * @param {string} raw - texto de búsqueda
 * @param {string|null} kind - opcional: "note" | "link" | "file" | "photo" | "audio" | "video"
 * @returns {Promise<Array<{ id, kind, title?, filename?, ... }>>}
 */
export async function runVaultSearch(raw, kind = null) {
  const rawInput = (raw || "").trim();
  if (!rawInput) return [];

  const normalizedQuery = normalizeText(rawInput);
  const searchTerms = getSearchTerms(normalizedQuery);

  const q = normalizedQuery;
  const singleKind = kind && VALID_KINDS.includes(kind) ? kind : null;
  const rawTokens = [...new Set(normalizedQuery.split(/\s+/).filter(Boolean))];
  const tokens = rawTokens.length > 1 ? rawTokens.filter((t) => t.length >= 2) : rawTokens;
  const tokensToUse = tokens.length > 0 ? tokens : rawTokens;

  const aiFilter = { aiEnrichment: { contains: q } };
  const aiTokenFilters = rawTokens.map((t) => ({ aiEnrichment: { contains: t } }));
  const filters = { aiFilter, aiTokenFilters, rawTokens };

  let notes = [];
  let links = [];
  let files = [];
  let photos = [];
  let audios = [];
  let videos = [];

  if (singleKind) {
    const result = await searchByKind(singleKind, q, filters);
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
      searchByKind("note", q, filters),
      searchByKind("link", q, filters),
      searchByKind("file", q, filters),
      searchByKind("photo", q, filters),
      searchByKind("audio", q, filters),
      searchByKind("video", q, filters),
    ]);
  }

  const toUrl = (filePath) => (filePath ? `/api/uploads/${path.basename(filePath)}` : null);
  const normalizeAI = (rawAi) => {
    const ai = parseAI(rawAi);
    const allTopics = Array.isArray(ai?.topics) ? ai.topics : [];
    return {
      aiTitle: ai?.title ?? null,
      aiSummary: ai?.summary ?? null,
      aiTags: allTopics,
      aiTopics: allTopics,
      aiCategory: ai?.category ?? null,
      topic: allTopics[0] ?? null,
    };
  };

  const allowed = (list, getFields) => list.filter((row) => matchesAllowedFields(tokensToUse, getFields(row)));
  const notesFiltered = allowed(notes, (n) => ({ content: n.content, aiEnrichment: n.aiEnrichment }));
  const linksFiltered = allowed(links, (l) => ({ url: l.url, title: l.title, metadata: l.metadata, aiEnrichment: l.aiEnrichment }));
  const filesFiltered = allowed(files, (f) => ({ filename: f.filename, filePath: f.filePath, aiEnrichment: f.aiEnrichment }));
  const photosFiltered = allowed(photos, (p) => ({ filename: p.filename, filePath: p.filePath, aiEnrichment: p.aiEnrichment }));
  const audiosFiltered = allowed(audios, (a) => ({ filePath: a.filePath, transcription: a.transcription, aiEnrichment: a.aiEnrichment }));
  const videosFiltered = allowed(videos, (v) => ({ filePath: v.filePath, title: v.title, aiEnrichment: v.aiEnrichment }));

  const seen = new Set();
  const dedup = (arr) =>
    arr.filter((x) => {
      const k = `${x.kind}:${x.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  let out = dedup([
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

  if (searchTerms.length > 0) {
    out = out.filter((item) => itemMatchesNormalizedSearch(item, searchTerms));
    if (out.length === 0) {
      const recent = await fetchRecentProcessed(50);
      const seen2 = new Set();
      const dedup2 = (arr) =>
        arr.filter((x) => {
          const k = `${x.kind}:${x.id}`;
          if (seen2.has(k)) return false;
          seen2.add(k);
          return true;
        });
      out = dedup2([
        ...recent.notes.map((n) => ({
          id: n.id,
          kind: "note",
          filename: n.content?.slice(0, 80) || "Nota",
          title: n.content?.slice(0, 80) || null,
          processedPath: n.processedPath,
          createdAt: n.createdAt,
          ...normalizeAI(n.aiEnrichment),
        })),
        ...recent.links.map((l) => ({
          id: l.id,
          kind: "link",
          filename: l.title || l.url?.slice(0, 50) || "Enlace",
          title: l.title,
          url: l.url,
          processedPath: l.processedPath,
          createdAt: l.createdAt,
          ...normalizeAI(l.aiEnrichment),
        })),
        ...recent.files.map((f) => ({
          id: f.id,
          kind: "file",
          filename: f.filename,
          filePath: f.filePath,
          processedPath: f.processedPath,
          createdAt: f.createdAt,
          ...normalizeAI(f.aiEnrichment),
        })),
        ...recent.photos.map((p) => ({
          id: p.id,
          kind: "photo",
          filename: p.filename,
          filePath: p.filePath,
          thumbnailUrl: toUrl(p.filePath),
          processedPath: p.processedPath,
          createdAt: p.createdAt,
          ...normalizeAI(p.aiEnrichment),
        })),
        ...recent.audios.map((a) => ({
          id: a.id,
          kind: "audio",
          filename: path.basename(a.filePath) || "Audio",
          filePath: a.filePath,
          processedPath: a.processedPath,
          createdAt: a.createdAt,
          ...normalizeAI(a.aiEnrichment),
        })),
        ...recent.videos.map((v) => ({
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
      out = out.filter((item) => itemMatchesNormalizedSearch(item, searchTerms));
    }
  }

  return out
    .map((item) => ({ ...item, score: scoreItem(item, tokensToUse) }))
    .sort((a, b) => b.score - a.score);
}
