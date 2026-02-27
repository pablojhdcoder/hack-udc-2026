import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "..", "..", "knowledge");

/**
 * Escribe un fichero Markdown en knowledge/{destination}/
 * @param {string} destination - Carpeta relativa (ej. "estudio/SI")
 * @param {string} filename - Nombre del fichero (ej. "nota-1.md")
 * @param {string} content - Contenido del Markdown
 * @returns {string} Ruta relativa al fichero generado
 */
export function writeMarkdown(destination, filename, content) {
  const dir = join(KNOWLEDGE_DIR, destination);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fullPath = join(dir, filename);
  writeFileSync(fullPath, content, "utf-8");
  return join(destination, filename);
}

/**
 * Genera el contenido Markdown para un ítem (link, note, etc.)
 * @param {object} item - { kind, type, content/url/title, createdAt, ... }
 * @returns {string} Contenido del .md
 */
export function buildMarkdownContent(item) {
  const frontmatter = [
    "---",
    `title: ${item.title ?? item.content?.slice(0, 50) ?? item.url ?? "Sin título"}`,
    `type: ${item.type}`,
    `date: ${item.createdAt}`,
    "---",
    "",
  ].join("\n");

  let body = "";
  if (item.url) body += `\n[Enlace](${item.url})\n`;
  if (item.content) body += `\n${item.content}\n`;

  return frontmatter + (body || "\n");
}
