import prisma from "../lib/prisma.js";
import { buildMarkdownContent, writeMarkdown } from "./markdownService.js";

const KINDS = ["link", "note", "file", "audio"];

/**
 * Resuelve una entidad por kind e id y la normaliza al formato esperado por markdownService.
 * @param {string} kind - 'link' | 'note' | 'file' | 'audio'
 * @param {string} id - id del registro
 * @returns {Promise<{ title, type, content?, url?, createdAt } | null>} Objeto normalizado o null si no existe
 */
export async function getEntityByKindId(kind, id) {
  if (!KINDS.includes(kind) || !id) return null;

  switch (kind) {
    case "link": {
      const link = await prisma.link.findUnique({ where: { id } });
      if (!link) return null;
      return {
        title: link.title ?? link.url,
        type: link.type,
        url: link.url,
        createdAt: link.createdAt,
      };
    }
    case "note": {
      const note = await prisma.note.findUnique({ where: { id } });
      if (!note) return null;
      return {
        title: note.content?.slice(0, 50) ?? "Nota",
        type: note.type,
        content: note.content,
        createdAt: note.createdAt,
      };
    }
    case "file": {
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) return null;
      return {
        title: file.filename ?? "Archivo",
        type: file.type,
        content: `Archivo: ${file.filePath}`,
        createdAt: file.createdAt,
      };
    }
    case "audio": {
      const audio = await prisma.audio.findUnique({ where: { id } });
      if (!audio) return null;
      const content = audio.transcription?.trim()
        ? audio.transcription
        : `Audio: ${audio.filePath}`;
      return {
        title: `Audio (${audio.type})`,
        type: audio.type,
        content,
        createdAt: audio.createdAt,
      };
    }
    default:
      return null;
  }
}

/**
 * Genera un nombre de fichero único para el Markdown (slug + id corto).
 * @param {string} title
 * @param {string} id
 * @returns {string} filename sin extensión, seguro para fs
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
 * Procesa un ítem: resuelve entidad, genera MD, escribe en knowledge y actualiza Prisma.
 * @param {{ kind: string, id: string }} item
 * @param {string} destination
 * @returns {{ kind: string, id: string, processedPath?: string, error?: string }}
 */
export async function processItem(item, destination) {
  const { kind, id } = item;
  const entity = await getEntityByKindId(kind, id);
  if (!entity) {
    return { kind, id, error: "Entidad no encontrada o no procesable" };
  }

  const content = buildMarkdownContent(entity);
  const filename = slugifyFilename(entity.title, id);
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
    default:
      return { kind, id, error: "Tipo de entidad no soportado" };
  }

  return { kind, id, processedPath };
}
