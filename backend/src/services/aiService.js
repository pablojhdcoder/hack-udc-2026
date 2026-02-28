/**
 * aiService.js — Enriquecimiento de items con Azure OpenAI (GPT-4o + Whisper)
 *
 * Soporta:
 *   - Azure AI Foundry/Studio (services.ai.azure.com, api/projects) → API v1, sin api-version
 *   - Azure OpenAI clásico (openai.azure.com) → API con api-version
 *
 * Requiere en .env:
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
 *   AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_WHISPER_DEPLOYMENT
 *   (AZURE_OPENAI_API_VERSION solo para recurso clásico; opcional AZURE_OPENAI_USE_V1=true para forzar v1)
 */

import { createReadStream, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { extractFileContent } from "./fileExtractService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "") ?? "";
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
const WHISPER_DEPLOYMENT = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? "whisper";
const API_KEY = process.env.AZURE_OPENAI_API_KEY ?? "";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? "2024-02-15-preview";

// Classic Azure OpenAI (.openai.azure.com) requires ?api-version=...
// AI Foundry (/api/projects/...) does NOT. Detect automatically.
const IS_FOUNDRY = ENDPOINT.includes("/api/projects/");
function apiUrl(path) {
  const base = `${ENDPOINT}${path}`;
  return IS_FOUNDRY ? base : `${base}?api-version=${API_VERSION}`;
}

export function isAIEnabled() {
  return !!(ENDPOINT && API_KEY);
}

// ──────────────────────────────────────────────
// Llamada directa a Azure AI Foundry via fetch
// (evitamos la SDK de OpenAI que añade api-version automáticamente)
// ──────────────────────────────────────────────

async function azureChat(messages, maxTokens = 800) {
  const url = apiUrl(`/openai/deployments/${DEPLOYMENT}/chat/completions`);
  console.log(`[azureChat] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY,
    },
    body: JSON.stringify({
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Respuesta vacía del modelo");

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`JSON inválido en respuesta IA: ${err.message}`);
  }
}

// ──────────────────────────────────────────────
// Esquema de enriquecimiento estándar esperado:
// {
//   title, summary, tags, topics, topic, language, keyPoints,
//   sentiment?, category?, enrichedAt
// }
// topic = 1-2 palabras, consistente para agrupar contenido relacionado
// ──────────────────────────────────────────────

const TOPIC_INSTRUCTION = `IMPORTANTE - Campo "topic": debes incluir SIEMPRE un campo "topic" con UNA o DOS palabras como máximo (sustantivo común o frase muy corta). Este topic debe ser CONSISTENTE para agrupar contenido relacionado: usa el mismo topic para cosas que traten del mismo ámbito. Ejemplos: un documento sobre un perro y otro sobre comida para perros → ambos "perro" o "animales"; recetas y ingredientes de cocina → "cocina"; apuntes de una asignatura → el nombre de la asignatura o "estudio". Usa el idioma del contenido. Preferir términos amplios y reutilizables.`;

const SYSTEM_PROMPT = `Eres un asistente experto en análisis y clasificación de contenido digital para un "Second Brain" personal.
Tu tarea es extraer metadatos ricos y estructurados del contenido que se te proporciona.
Responde SIEMPRE con un objeto JSON válido, sin texto adicional fuera del JSON.
Sé conciso pero completo. Los tags deben estar en minúsculas y sin espacios (usa guiones si hace falta).
${TOPIC_INSTRUCTION}`;

/** Normaliza topic a 1-2 palabras (el modelo a veces devuelve más). */
function normalizeTopic(topic) {
  if (topic == null || typeof topic !== "string") return null;
  const trimmed = topic.trim().slice(0, 80);
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.slice(0, 2).join(" ") || null;
}

function withTimestamp(data) {
  const topic = normalizeTopic(data.topic ?? data.topics?.[0]);
  return { ...data, topic: topic || data.topic, enrichedAt: new Date().toISOString() };
}

function callChat(messages, maxTokens = 800) {
  return azureChat(
    [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    maxTokens
  );
}

// ──────────────────────────────────────────────
// Enriquecer NOTA (texto plano)
// ──────────────────────────────────────────────

export async function enrichNote(content) {
  const prompt = `Analiza la siguiente nota y extrae metadatos estructurados.

NOTA:
"""
${content.slice(0, 4000)}
"""

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título representativo (máx 60 caracteres)",
  "summary": "resumen en 2-3 frases",
  "tags": ["tag1", "tag2", ...],
  "topics": ["tema1", "tema2"],
  "topic": "una o dos palabras para agrupar con contenido relacionado (ej: perro, cocina, trabajo)",
  "language": "es|en|...",
  "keyPoints": ["punto1", "punto2", ...],
  "sentiment": "positivo|negativo|neutro",
  "category": "categoría amplia"
}`;

  const result = await callChat([{ role: "user", content: prompt }]);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer LINK (URL + preview OG existente)
// ──────────────────────────────────────────────

export async function enrichLink(url, existingPreview = {}) {
  const previewContext = Object.keys(existingPreview).length > 0
    ? `Metadatos Open Graph ya extraídos:\n- Título: ${existingPreview.title ?? "N/A"}\n- Descripción: ${existingPreview.description ?? "N/A"}`
    : "No hay metadatos previos disponibles.";

  const prompt = `Analiza el siguiente enlace y sus metadatos disponibles para clasificarlo y enriquecerlo.

URL: ${url}
${previewContext}

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título representativo",
  "summary": "resumen del recurso en 2-3 frases",
  "tags": ["tag1", "tag2", ...],
  "topics": ["tema1", "tema2"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "es|en|...",
  "keyPoints": ["punto clave 1", "punto clave 2"],
  "category": "categoría amplia (tecnología, noticias, tutorial, etc.)",
  "resourceType": "artículo|vídeo|podcast|repositorio|herramienta|foro|otro"
}`;

  const result = await callChat([{ role: "user", content: prompt }]);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer FICHERO (PDF, Word, texto, imagen)
// ──────────────────────────────────────────────

export async function enrichFile(filePath, type, filename) {
  const absolutePath = filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/)
    ? filePath
    : resolve(process.cwd(), filePath);

  const extracted = await extractFileContent(absolutePath, type);

  // Imagen → usar GPT-4o Vision
  if (extracted.base64 && !extracted.text) {
    return enrichImageWithVision(extracted.base64, extracted.mimeType, filename);
  }

  // Texto extraído (PDF, Word, txt, md)
  if (extracted.text) {
    return enrichTextContent(extracted.text, type, filename, extracted.pageCount);
  }

  // Fallback: sólo usar nombre de fichero y tipo para inferir
  return enrichFileByMetadata(filename, type);
}

async function enrichTextContent(text, type, filename, pageCount) {
  const prompt = `Analiza el siguiente contenido de un fichero (tipo: ${type}, nombre: "${filename}"${pageCount ? `, ${pageCount} páginas` : ""}) y extrae metadatos estructurados.

CONTENIDO:
"""
${text.slice(0, 6000)}
"""

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título del documento",
  "summary": "resumen en 2-3 frases",
  "tags": ["tag1", "tag2", ...],
  "topics": ["tema1", "tema2"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "es|en|...",
  "keyPoints": ["punto clave 1", "punto clave 2", ...],
  "category": "categoría amplia",
  "documentType": "informe|artículo|manual|presentación|código|otro"
}`;

  const result = await callChat([{ role: "user", content: prompt }], 1000);
  return withTimestamp(result);
}

async function enrichImageWithVision(base64, mimeType, filename) {
  const url = apiUrl(`/openai/deployments/${DEPLOYMENT}/chat/completions`);
  console.log(`[enrichImageWithVision] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": API_KEY,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analiza esta imagen (nombre de fichero: "${filename}") y extrae metadatos estructurados.

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título descriptivo de la imagen",
  "summary": "descripción detallada en 2-3 frases",
  "tags": ["tag1", "tag2"],
  "topics": ["tema1", "tema2"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "es|en|...",
  "keyPoints": ["elemento destacado 1", "elemento destacado 2"],
  "category": "screenshot|fotografía|diagrama|infografía|otro",
  "containsText": true,
  "dominantColors": ["color1", "color2"]
}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure OpenAI vision error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Respuesta vacía del modelo (visión)");

  try {
    return withTimestamp(JSON.parse(raw));
  } catch (err) {
    throw new Error(`JSON inválido en respuesta IA (visión): ${err.message}`);
  }
}

async function enrichFileByMetadata(filename, type) {
  const prompt = `Infiere metadatos de un fichero basándote únicamente en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título inferido del fichero",
  "summary": "descripción breve basada en nombre y tipo",
  "tags": ["tag1", "tag2"],
  "topics": ["tema inferido"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "desconocido",
  "keyPoints": [],
  "category": "categoría inferida"
}`;

  const result = await callChat([{ role: "user", content: prompt }], 400);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer VIDEO (por nombre/tipo; sin extracción de contenido)
// ──────────────────────────────────────────────

export async function enrichVideo(filename, type) {
  const prompt = `Infiere metadatos de un vídeo basándote en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título inferido del vídeo",
  "summary": "descripción breve basada en nombre y tipo",
  "tags": ["tag1", "tag2", ...],
  "topics": ["tema inferido"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "desconocido",
  "keyPoints": [],
  "category": "vídeo|presentación|tutorial|grabación|otro"
}`;

  const result = await callChat([{ role: "user", content: prompt }], 500);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Transcribir y enriquecer AUDIO (Whisper + GPT-4o)
// ──────────────────────────────────────────────

export async function enrichAudio(filePath, type) {
  const absolutePath = filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/)
    ? filePath
    : resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return withTimestamp({ error: "Fichero de audio no encontrado", transcription: null });
  }

  let transcription = null;

  try {
    const whisperUrl = apiUrl(`/openai/deployments/${WHISPER_DEPLOYMENT}/audio/transcriptions`);
    console.log(`[enrichAudio] POST ${whisperUrl}`);

    const formData = new FormData();
    const fileBlob = new Blob([await import("fs").then(m => m.promises.readFile(absolutePath))]);
    formData.append("file", fileBlob, absolutePath.split("/").pop());
    formData.append("response_format", "verbose_json");

    const whisperRes = await fetch(whisperUrl, {
      method: "POST",
      headers: { "api-key": API_KEY },
      body: formData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      throw new Error(`Whisper error ${whisperRes.status}: ${errText}`);
    }

    const whisperData = await whisperRes.json();
    transcription = typeof whisperData === "string" ? whisperData : (whisperData?.text ?? null);
  } catch (err) {
    console.warn("[aiService] Whisper transcription failed:", err.message);
    return withTimestamp({ transcription: null, error: `Transcripción fallida: ${err.message}` });
  }

  if (!transcription || transcription.trim().length === 0) {
    return withTimestamp({ transcription: "", summary: "Audio sin contenido audible detectado." });
  }

  const prompt = `Analiza la siguiente transcripción de un audio (tipo: ${type}) y extrae metadatos estructurados.

TRANSCRIPCIÓN:
"""
${transcription.slice(0, 5000)}
"""

Devuelve un JSON con la siguiente estructura exacta:
{
  "title": "título descriptivo del audio",
  "summary": "resumen en 2-3 frases",
  "tags": ["tag1", "tag2", ...],
  "topics": ["tema1", "tema2"],
  "topic": "una o dos palabras para agrupar con contenido relacionado",
  "language": "es|en|...",
  "keyPoints": ["punto clave 1", "punto clave 2"],
  "sentiment": "positivo|negativo|neutro",
  "category": "nota de voz|reunión|podcast|clase|otro"
}`;

  const analysis = await callChat([{ role: "user", content: prompt }], 800);
  return withTimestamp({ ...analysis, transcription });
}
