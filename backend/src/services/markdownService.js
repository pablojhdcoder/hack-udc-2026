import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, "..", "..", "knowledge");

/**
 * Escribe un fichero Markdown en knowledge/{destination}/
 */
export function writeMarkdown(destination, filename, content) {
  console.log(`[Markdown] KNOWLEDGE_DIR: ${KNOWLEDGE_DIR}`);
  console.log(`[Markdown] destination: ${destination}`);
  console.log(`[Markdown] filename: ${filename}`);
  
  const dir = join(KNOWLEDGE_DIR, destination);
  console.log(`[Markdown] Directorio destino: ${dir}`);
  
  if (!existsSync(dir)) {
    console.log(`[Markdown] Creando directorio: ${dir}`);
    mkdirSync(dir, { recursive: true });
  }
  
  const fullPath = join(dir, filename);
  console.log(`[Markdown] Ruta completa: ${fullPath}`);
  
  writeFileSync(fullPath, content, "utf-8");
  console.log(`[Markdown] ✅ Archivo escrito exitosamente`);
  
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
  const topicValue = item.topic ?? ai?.topic;
  if (topicValue) frontmatterLines.push(`topic: "${String(topicValue).replace(/"/g, "'")}"`);
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

  // Transcripción (audio y vídeo): IA o campo guardado en BD
  const transcriptionText =
    ai?.transcription ??
    (item.kind === "audio" ? item.content : null) ??
    (item.kind === "video" ? item.transcription : null);
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

  // Foto
  if (item.kind === "photo" && item.filePath) {
    bodyParts.push("## Foto", "", `- **Ruta:** \`${item.filePath}\``);
    if (item.filename) bodyParts.push(`- **Nombre:** ${item.filename}`);
    if (item.size) bodyParts.push(`- **Tamaño:** ${(item.size / 1024).toFixed(1)} KB`);
    bodyParts.push("");
  }

  // Vídeo
  if (item.kind === "video" && item.filePath) {
    bodyParts.push("## Vídeo", "", `- **Ruta:** \`${item.filePath}\``);
    if (item.title) bodyParts.push(`- **Título:** ${item.title}`);
    bodyParts.push("");
  }

  // Tags como footer visual
  if (ai?.tags?.length) {
    bodyParts.push("---", "");
    bodyParts.push(ai.tags.map((t) => `\`${t}\``).join(" "));
  }

  return frontmatterLines.join("\n") + bodyParts.join("\n");
}
