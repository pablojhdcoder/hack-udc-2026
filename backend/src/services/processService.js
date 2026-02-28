import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import prisma from "../lib/prisma.js";
import { buildMarkdownContent, writeMarkdown } from "./markdownService.js";
import {
  isAIEnabled,
  enrichNote,
  enrichLink,
  enrichFile,
  enrichAudio,
  enrichVideo,
} from "./aiService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, "..", "..");
const KINDS = ["link", "note", "file", "photo", "audio", "video"];

/** Resuelve ruta absoluta del fichero (uploads/... o backend/uploads/...) */
function resolveFilePath(relativePath) {
  const fromCwd = path.resolve(process.cwd(), relativePath);
  if (existsSync(fromCwd)) return fromCwd;
  const fromBackend = path.resolve(BACKEND_ROOT, relativePath);
  return fromBackend;
}

/**
 * Asegura que el ítem tenga aiEnrichment antes de generar Markdown.
 * Si falta o solo tiene error, ejecuta el enriquecimiento y actualiza la BD.
 */
async function ensureEnrichment(kind, id, entity) {
  console.log(`[ensureEnrichment] Verificando ${kind} ${id}`);
  console.log(`[ensureEnrichment] entity.aiEnrichment:`, entity.aiEnrichment);
  
  const hasValidEnrichment =
    entity.aiEnrichment &&
    (entity.aiEnrichment.title || entity.aiEnrichment.summary) &&
    !entity.aiEnrichment.error;

  console.log(`[ensureEnrichment] hasValidEnrichment: ${hasValidEnrichment}`);
  
  if (hasValidEnrichment) {
    console.log(`[ensureEnrichment] Ya tiene enriquecimiento válido, saltando IA`);
    return entity;
  }
  
  if (!isAIEnabled()) {
    console.warn("[Process] AI no configurada: no se puede enriquecer", kind, id);
    return entity;
  }

  const enrichmentPayload = (enrichment) => {
    const { topic, ...enrichmentOnly } = enrichment;
    const data = { aiEnrichment: JSON.stringify(enrichmentOnly) };
    if (topic != null && String(topic).trim()) data.topic = String(topic).trim().slice(0, 120);
    return data;
  };

  console.log(`[ensureEnrichment] Llamando a enriquecer con IA...`);
  let enrichment;
  try {
    switch (kind) {
      case "note":
        enrichment = await enrichNote(entity.content);
        await prisma.note.update({ where: { id }, data: enrichmentPayload(enrichment) });
        break;
      case "link":
        enrichment = await enrichLink(entity.url, entity.metadata ?? {});
        await prisma.link.update({ where: { id }, data: enrichmentPayload(enrichment) });
        break;
      case "file": {
        const absolutePath = resolveFilePath(entity.filePath);
        enrichment = await enrichFile(absolutePath, entity.type, entity.filename);
        await prisma.file.update({ where: { id }, data: enrichmentPayload(enrichment) });
        break;
      }
      case "photo": {
        const absolutePath = resolveFilePath(entity.filePath);
        enrichment = await enrichFile(absolutePath, entity.type, entity.filename);
        await prisma.photo.update({ where: { id }, data: enrichmentPayload(enrichment) });
        break;
      }
      case "audio": {
        const absolutePath = resolveFilePath(entity.filePath);
        enrichment = await enrichAudio(absolutePath, entity.type);
        const payload = enrichmentPayload(enrichment);
        if (enrichment.transcription) payload.transcription = enrichment.transcription;
        await prisma.audio.update({ where: { id }, data: payload });
        break;
      }
      case "video": {
        const filename = path.basename(entity.filePath);
        enrichment = await enrichVideo(filename, entity.type);
        await prisma.video.update({ where: { id }, data: enrichmentPayload(enrichment) });
        break;
      }
      default:
        return entity;
    }
    console.log("[Process] Enriquecimiento aplicado al procesar:", kind, id);
    return { ...entity, aiEnrichment: enrichment };
  } catch (err) {
    console.error("[Process] Error enriqueciendo al procesar:", kind, id, err.message);
    const fallback = { error: err.message, enrichedAt: new Date().toISOString() };
    switch (kind) {
      case "link":
        await prisma.link.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
      case "note":
        await prisma.note.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
      case "file":
        await prisma.file.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
      case "photo":
        await prisma.photo.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
      case "audio":
        await prisma.audio.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
      case "video":
        await prisma.video.update({ where: { id }, data: { aiEnrichment: JSON.stringify(fallback) } });
        break;
    }
    return { ...entity, aiEnrichment: fallback };
  }
}

/**
 * Resuelve una entidad por kind e id y la normaliza para markdownService,
 * incluyendo el aiEnrichment ya almacenado en BD.
 */
export async function getEntityByKindId(kind, id) {
  if (!KINDS.includes(kind) || !id) return null;

  const parseAI = (raw) => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  switch (kind) {
    case "link": {
      const link = await prisma.link.findUnique({ where: { id } });
      if (!link) return null;
      return {
        kind: "link",
        title: link.title ?? link.url,
        type: link.type,
        url: link.url,
        metadata: link.metadata ? JSON.parse(link.metadata) : null,
        aiEnrichment: parseAI(link.aiEnrichment),
        createdAt: link.createdAt,
      };
    }
    case "note": {
      const note = await prisma.note.findUnique({ where: { id } });
      if (!note) return null;
      return {
        kind: "note",
        title: note.content?.slice(0, 60) ?? "Nota",
        type: note.type,
        content: note.content,
        aiEnrichment: parseAI(note.aiEnrichment),
        createdAt: note.createdAt,
      };
    }
    case "file": {
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) return null;
      return {
        kind: "file",
        title: file.filename ?? "Archivo",
        type: file.type,
        filename: file.filename,
        filePath: file.filePath,
        size: file.size,
        aiEnrichment: parseAI(file.aiEnrichment),
        createdAt: file.createdAt,
      };
    }
    case "photo": {
      const photo = await prisma.photo.findUnique({ where: { id } });
      if (!photo) return null;
      return {
        kind: "photo",
        title: photo.filename ?? "Foto",
        type: photo.type,
        filename: photo.filename,
        filePath: photo.filePath,
        size: photo.size,
        aiEnrichment: parseAI(photo.aiEnrichment),
        createdAt: photo.createdAt,
      };
    }
    case "audio": {
      const audio = await prisma.audio.findUnique({ where: { id } });
      if (!audio) return null;
      const ai = parseAI(audio.aiEnrichment);
      return {
        kind: "audio",
        title: ai?.title ?? `Audio (${audio.type})`,
        type: audio.type,
        filePath: audio.filePath,
        content: audio.transcription?.trim() ? audio.transcription : null,
        aiEnrichment: ai,
        createdAt: audio.createdAt,
      };
    }
    case "video": {
      const video = await prisma.video.findUnique({ where: { id } });
      if (!video) return null;
      const ai = parseAI(video.aiEnrichment);
      return {
        kind: "video",
        title: ai?.title ?? video.title ?? "Vídeo",
        type: video.type,
        filePath: video.filePath,
        aiEnrichment: ai,
        createdAt: video.createdAt,
      };
    }
    default:
      return null;
  }
}

/**
 * Genera un nombre de fichero único para el Markdown (slug + id corto).
 */
function slugifyFilename(title, id) {
  const slug =
    (title ?? "item")
      .toString()
      .replace(/[^a-z0-9\u00C0-\u024F\s-]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "item";
  const shortId = id.slice(-6);
  return `${slug}-${shortId}.md`;
}

/**
 * Procesa un ítem: resuelve entidad, genera MD enriquecido, escribe en knowledge y actualiza Prisma.
 */
export async function processItem(item, destination) {
  const { kind, id } = item;
  console.log(`[Process] Procesando ${kind} ${id} -> destino: ${destination}`);
  
  let entity = await getEntityByKindId(kind, id);
  if (!entity) {
    console.error(`[Process] ❌ Entidad no encontrada: ${kind} ${id}`);
    return { kind, id, error: "Entidad no encontrada o no procesable" };
  }
  console.log(`[Process] ✅ Entidad encontrada: ${kind} ${id}`);
  console.log(`[Process] Título: ${entity.title}`);
  console.log(`[Process] Tiene aiEnrichment: ${!!entity.aiEnrichment}`);

  entity = await ensureEnrichment(kind, id, entity);
  console.log(`[Process] Después de ensureEnrichment, aiEnrichment:`, entity.aiEnrichment ? "presente" : "ausente");

  const resolvedTitle = entity.aiEnrichment?.title ?? entity.title;
  console.log(`[Process] Título resuelto: ${resolvedTitle}`);
  
  const content = buildMarkdownContent(entity);
  console.log(`[Process] Contenido Markdown generado: ${content.length} caracteres`);
  
  const filename = slugifyFilename(resolvedTitle, id);
  console.log(`[Process] Nombre de archivo: ${filename}`);
  
  const processedPath = writeMarkdown(destination, filename, content);
  console.log(`[Process] ✅ Archivo escrito en: ${processedPath}`);

  const updatePayload = { inboxStatus: "processed", processedPath };
  switch (kind) {
    case "link":
      await prisma.link.update({ where: { id }, data: updatePayload });
      break;
    case "note":
      await prisma.note.update({ where: { id }, data: updatePayload });
      break;
    case "file":
      await prisma.file.update({ where: { id }, data: updatePayload });
      break;
    case "photo":
      await prisma.photo.update({ where: { id }, data: updatePayload });
      break;
    case "audio":
      await prisma.audio.update({ where: { id }, data: updatePayload });
      break;
    case "video":
      await prisma.video.update({ where: { id }, data: updatePayload });
      break;
    default:
      return { kind, id, error: "Tipo de entidad no soportado" };
  }

  return { kind, id, processedPath };
}
