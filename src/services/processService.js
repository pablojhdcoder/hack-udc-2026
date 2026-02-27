import prisma from "../lib/prisma.js";
import { buildMarkdownContent, writeMarkdown } from "./markdownService.js";

const KINDS = ["link", "note", "file", "audio", "video"];

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
      return {
        kind: "video",
        title: video.filename ?? "Video",
        type: video.type,
        filename: video.filename,
        filePath: video.filePath,
        size: video.size,
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
  const entity = await getEntityByKindId(kind, id);
  if (!entity) {
    return { kind, id, error: "Entidad no encontrada o no procesable" };
  }

  const resolvedTitle = entity.aiEnrichment?.title ?? entity.title;
  const content = buildMarkdownContent(entity);
  const filename = slugifyFilename(resolvedTitle, id);
  const processedPath = writeMarkdown(destination, filename, content);

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
