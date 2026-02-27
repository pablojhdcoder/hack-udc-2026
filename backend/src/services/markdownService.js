import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "..", "..", "knowledge");

/**
 * Escribe un fichero Markdown en knowledge/{destination}/
 */
export function writeMarkdown(destination, filename, content) {
  const dir = join(KNOWLEDGE_DIR, destination);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fullPath = join(dir, filename);
  writeFileSync(fullPath, content, "utf-8");
  return join(destination, filename);
}

/**
 * Genera el contenido Markdown para un ítem, incluyendo datos de enriquecimiento IA.
 * @param {object} item - { kind, type, content?, url?, title?, createdAt, aiEnrichment? }
 */
export function buildMarkdownContent(item) {
  const ai = item.aiEnrichment ?? null;

  const resolvedTitle = ai?.title
    ?? item.title
    ?? item.content?.slice(0, 60)
    ?? item.url
    ?? "Sin título";

  const tags = ai?.tags?.length
    ? ai.tags.map((t) => `"${t}"`).join(", ")
    : null;

  const topics = ai?.topics?.length
    ? ai.topics.join(", ")
    : null;

  // ── Frontmatter ──
  const frontmatterLines = [
    "---",
    `title: "${resolvedTitle.replace(/"/g, "'")}"`,
    `type: ${item.type}`,
    `kind: ${item.kind ?? "unknown"}`,
    `date: ${new Date(item.createdAt).toISOString()}`,
  ];

  if (tags) frontmatterLines.push(`tags: [${tags}]`);
  if (topics) frontmatterLines.push(`topics: [${topics.split(", ").map((t) => `"${t}"`).join(", ")}]`);
  if (ai?.language) frontmatterLines.push(`language: ${ai.language}`);
  if (ai?.category) frontmatterLines.push(`category: "${ai.category}"`);
  if (ai?.sentiment) frontmatterLines.push(`sentiment: ${ai.sentiment}`);
  if (item.url) frontmatterLines.push(`url: "${item.url}"`);
  if (ai?.enrichedAt) frontmatterLines.push(`aiEnrichedAt: ${ai.enrichedAt}`);

  frontmatterLines.push("---", "");

  // ── Cuerpo ──
  const bodyParts = [];

  // Título principal
  bodyParts.push(`# ${resolvedTitle}`, "");

  // Resumen IA
  if (ai?.summary) {
    bodyParts.push("## Resumen", "", ai.summary, "");
  }

  // Puntos clave IA
  if (ai?.keyPoints?.length) {
    bodyParts.push("## Puntos clave", "");
    ai.keyPoints.forEach((kp) => bodyParts.push(`- ${kp}`));
    bodyParts.push("");
  }

  // Transcripción (audio): IA o campo guardado en BD
  const transcriptionText = ai?.transcription ?? (item.kind === "audio" ? item.content : null);
  if (transcriptionText) {
    bodyParts.push("## Transcripción", "", transcriptionText, "");
  }

  // Enlace (links)
  if (item.url) {
    bodyParts.push("## Enlace", "", `[${resolvedTitle}](${item.url})`, "");
    if (item.metadata?.description) {
      bodyParts.push("> " + item.metadata.description, "");
    }
  }

  // Contenido original (notas y ficheros de texto)
  if (item.content && item.kind !== "audio") {
    bodyParts.push("## Contenido original", "", item.content, "");
  }

  // Info del fichero
  if (item.kind === "file" && item.filePath) {
    bodyParts.push("## Fichero", "", `- **Ruta:** \`${item.filePath}\``);
    if (item.filename) bodyParts.push(`- **Nombre:** ${item.filename}`);
    if (item.size) bodyParts.push(`- **Tamaño:** ${(item.size / 1024).toFixed(1)} KB`);
    bodyParts.push("");
  }

  // Tags como footer visual
  if (ai?.tags?.length) {
    bodyParts.push("---", "");
    bodyParts.push(ai.tags.map((t) => `\`${t}\``).join(" "));
  }

  return frontmatterLines.join("\n") + bodyParts.join("\n");
}
