/**
 * aiService.js — Enriquecimiento de items con Google Gemini (gemini-1.5-pro)
 *
 * Soporta: notas, links, ficheros (texto e imágenes), vídeo (metadatos) y audio (transcripción + análisis).
 * Requiere en .env: GEMINI_API_KEY
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { extractFileContent } from "./fileExtractService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = dirname(fileURLToPath(import.meta.url));

const apiKey = process.env.GEMINI_API_KEY ?? "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-flash-latest" }) : null;

export function isAIEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

// ──────────────────────────────────────────────
// Helper: llamar a Gemini y devolver JSON parseado
// Limpia envolturas tipo ```json ... ``` antes de parsear
// ──────────────────────────────────────────────

function stripJsonWrapper(text) {
  if (!text || typeof text !== "string") return text;
  let s = text.trim();
  const jsonBlock = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(s);
  if (jsonBlock) s = jsonBlock[1].trim();
  return s;
}

async function geminiGenerateContent(parts, maxOutputTokens = 1024) {
  if (!model) throw new Error("GEMINI_API_KEY no configurada");
  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  });
  const response = result.response;
  if (!response?.text) throw new Error("Respuesta vacía del modelo");
  const raw = response.text();
  const cleaned = stripJsonWrapper(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`JSON inválido en respuesta IA: ${err.message}. Raw: ${raw.slice(0, 200)}`);
  }
}

// ──────────────────────────────────────────────
// Esquema de enriquecimiento (mismo que antes para el frontend)
// title, summary, topics, language, category, enrichedAt
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente experto en análisis y clasificación de contenido digital para un "Second Brain" personal.
Tu tarea es extraer metadatos mínimos y estructurados del contenido que se te proporciona.
Responde SIEMPRE con un objeto JSON válido, sin texto adicional fuera del JSON.`;

const TOPICS_INSTRUCTION = `IMPORTANTE - Campo "topics": incluye entre 3 y 5 palabras clave ESPECÍFICAS del contenido.
Cada topic debe representar un aspecto distinto (temática, tecnología, contexto, disciplina, etc.).
Las palabras NO deben ser redundantes, similares ni sinónimas entre sí — cada una debe aportar información nueva.
Sé específico: evita términos genéricos como "tecnología", "documento", "contenido" o "general".
Usa el idioma del contenido.`;

const JSON_SCHEMA = `{
  "title": "título representativo (máx 30 caracteres)",
  "summary": "resumen breve del contenido en 2-3 frases, en el mismo idioma que el contenido",
  "topics": ["tema-específico-1", "tema-específico-2", "tema-específico-3"],
  "language": "es|en|...",
  "category": "categoría amplia y descriptiva"
}`;

function withTimestamp(data) {
  return { ...data, enrichedAt: new Date().toISOString() };
}

function buildPrompt(instruction, extra = "") {
  return `${SYSTEM_PROMPT}

${instruction}

${TOPICS_INSTRUCTION}

Devuelve un JSON con la siguiente estructura exacta:
${JSON_SCHEMA}${extra ? "\n\n" + extra : ""}`;
}

// ──────────────────────────────────────────────
// Enriquecer NOTA (texto plano)
// ──────────────────────────────────────────────

export async function enrichNote(content) {
  const prompt = buildPrompt(
    `Analiza la siguiente nota y extrae metadatos estructurados.

NOTA:
"""
${content.slice(0, 4000)}
"""`
  );
  const result = await geminiGenerateContent([{ text: prompt }]);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer LINK (URL + preview OG existente)
// ──────────────────────────────────────────────

export async function enrichLink(url, existingPreview = {}) {
  const previewContext =
    Object.keys(existingPreview).length > 0
      ? `Metadatos Open Graph ya extraídos:\n- Título: ${existingPreview.title ?? "N/A"}\n- Descripción: ${existingPreview.description ?? "N/A"}`
      : "No hay metadatos previos disponibles.";

  const prompt = buildPrompt(
    `Analiza el siguiente enlace y sus metadatos disponibles para clasificarlo.

URL: ${url}
${previewContext}`
  );
  const result = await geminiGenerateContent([{ text: prompt }]);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer FICHERO (PDF, Word, texto, imagen)
// ──────────────────────────────────────────────

export async function enrichFile(filePath, type, filename) {
  const absolutePath =
    filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/) ? filePath : resolve(process.cwd(), filePath);

  const extracted = await extractFileContent(absolutePath, type);

  // Imagen → Gemini multimodal con inlineData
  const VISION_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (extracted.base64 && extracted.mimeType && VISION_MIMES.includes(extracted.mimeType)) {
    return enrichImageWithVision(extracted.base64, extracted.mimeType, filename);
  }

  if (extracted.text) {
    return enrichTextContent(extracted.text, type, filename, extracted.pageCount);
  }

  return enrichFileByMetadata(filename, type);
}

async function enrichTextContent(text, type, filename, pageCount) {
  const prompt = buildPrompt(
    `Analiza el siguiente contenido de un fichero (tipo: ${type}, nombre: "${filename}"${pageCount ? `, ${pageCount} páginas` : ""}) y extrae metadatos estructurados.

CONTENIDO:
"""
${text.slice(0, 6000)}
"""`
  );
  const result = await geminiGenerateContent([{ text: prompt }], 1024);
  return withTimestamp(result);
}

async function enrichImageWithVision(base64, mimeType, filename) {
  const prompt = buildPrompt(
    `Analiza esta imagen (nombre de fichero: "${filename}") y extrae metadatos estructurados.`
  );
  const parts = [
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
  ];
  const result = await geminiGenerateContent(parts, 1024);
  return withTimestamp(result);
}

async function enrichFileByMetadata(filename, type) {
  const prompt = buildPrompt(
    `Infiere metadatos de un fichero basándote únicamente en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"`
  );
  const result = await geminiGenerateContent([{ text: prompt }], 512);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer VIDEO (por nombre/tipo)
// ──────────────────────────────────────────────

export async function enrichVideo(filename, type) {
  const prompt = buildPrompt(
    `Infiere metadatos de un vídeo basándote en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"`
  );
  const result = await geminiGenerateContent([{ text: prompt }], 512);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Transcribir y enriquecer AUDIO (Gemini multimodal: audio → transcripción + análisis)
// ──────────────────────────────────────────────

const AUDIO_MIMES = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
};

export async function enrichAudio(filePath, type) {
  const absolutePath =
    filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/) ? filePath : resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return withTimestamp({ error: "Fichero de audio no encontrado", transcription: null });
  }

  const ext = (type || "").toLowerCase().replace(".", "") || absolutePath.split(".").pop()?.toLowerCase();
  const mimeType = AUDIO_MIMES[ext] || "audio/mpeg";

  try {
    const buffer = await readFile(absolutePath);
    const base64 = buffer.toString("base64");

    const prompt = `${SYSTEM_PROMPT}

Transcribe el audio que se adjunta y analiza su contenido. Devuelve un único JSON con:
- "transcription": texto completo de la transcripción.
- "title", "summary", "topics", "language", "category": según el esquema de abajo.

${TOPICS_INSTRUCTION}

Estructura exacta del JSON:
{
  "transcription": "texto transcrito completo",
  "title": "título (máx 30 caracteres)",
  "summary": "resumen en 2-3 frases",
  "topics": ["tema1", "tema2", "tema3"],
  "language": "es|en|...",
  "category": "categoría"
}`;

    const parts = [
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ];
    const result = await geminiGenerateContent(parts, 2048);
    return withTimestamp({ ...result, transcription: result.transcription ?? null });
  } catch (err) {
    console.warn("[aiService] Gemini audio failed:", err.message);
    return withTimestamp({
      transcription: null,
      error: `Transcripción/análisis fallido: ${err.message}`,
    });
  }
}
