/**
 * aiService.js — Enriquecimiento de items con IA
 *
 * Estrategia para enriquecimiento (notas, links, ficheros, vídeos, audio):
 *   1. Intenta con Azure OpenAI (primario). Si supera el timeout o falla → fallback a Gemini.
 *   2. Gemini actúa siempre como respaldo.
 *
 * Para vídeo y audio grande se usa la Gemini File API (subida del fichero a los servidores
 * de Google, procesamiento y análisis). Para audio pequeño se usa inline base64.
 *
 * Para el chat conversacional: ver routes/chat.js (usa Gemini exclusivamente).
 *
 * NOTA sobre inicialización (ESM + dotenv):
 *   En Node.js ESM todos los módulos se evalúan antes de que el código del módulo padre
 *   se ejecute, por lo que dotenv.config() en index.js todavía no ha corrido al cargar este
 *   módulo. Se usan lazy singletons: los clientes se crean la primera vez que se necesitan.
 */

import { readFile } from "fs/promises";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { extractFileContent } from "./fileExtractService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Timeout en ms para Azure antes de activar el fallback a Gemini
const AZURE_TIMEOUT_MS = 15_000;

// Límite para usar inline base64 en audio (20 MB). Encima se usa File API.
const AUDIO_INLINE_MAX_BYTES = 20 * 1024 * 1024;

// ─── Lazy singletons ────────────────────────────────────────────────────────

let _azureClient = undefined;
let _geminiModel = undefined;
let _geminiFileManager = undefined;

function getAzureClient() {
  if (_azureClient !== undefined) return _azureClient;

  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "");
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";

  if (!endpoint || !apiKey) {
    _azureClient = null;
    return null;
  }

  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-02-15-preview";

  _azureClient = new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${deployment}`,
    defaultQuery: { "api-version": apiVersion },
    defaultHeaders: { "api-key": apiKey },
  });

  console.log("[AI] Azure OpenAI client inicializado (deployment:", deployment, ")");
  return _azureClient;
}

function getGeminiModel() {
  if (_geminiModel !== undefined) return _geminiModel;

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    _geminiModel = null;
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  _geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  console.log("[AI] Gemini model inicializado");
  return _geminiModel;
}

function getGeminiFileManager() {
  if (_geminiFileManager !== undefined) return _geminiFileManager;

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    _geminiFileManager = null;
    return null;
  }

  _geminiFileManager = new GoogleAIFileManager(apiKey);
  return _geminiFileManager;
}

function getAzureDeployment() {
  return process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
}

// ──────────────────────────────────────────────
// API pública de disponibilidad
// ──────────────────────────────────────────────

export function isAIEnabled() {
  return !!(process.env.AZURE_OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

// ──────────────────────────────────────────────
// Utilidades internas
// ──────────────────────────────────────────────

function stripJsonWrapper(text) {
  if (!text || typeof text !== "string") return text;
  let s = text.trim();
  const jsonBlock = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(s);
  if (jsonBlock) s = jsonBlock[1].trim();
  return s;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout tras ${ms}ms`)), ms)
    ),
  ]);
}

function withTimestamp(data) {
  return { ...data, enrichedAt: new Date().toISOString() };
}

function resolveAbsolutePath(filePath) {
  if (!filePath) return null;
  return filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/)
    ? filePath
    : resolve(process.cwd(), filePath);
}

// ──────────────────────────────────────────────
// Azure OpenAI — generación de JSON
// ──────────────────────────────────────────────

async function azureGenerateContent(messages, maxTokens = 1024) {
  const client = getAzureClient();
  if (!client) throw new Error("Azure OpenAI no configurado (faltan AZURE_OPENAI_ENDPOINT o AZURE_OPENAI_API_KEY)");

  const completion = await client.chat.completions.create({
    model: getAzureDeployment(),
    messages,
    temperature: 0.1,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("Respuesta vacía de Azure OpenAI");

  const cleaned = stripJsonWrapper(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`JSON inválido en respuesta Azure: ${err.message}. Raw: ${raw.slice(0, 200)}`);
  }
}

// ──────────────────────────────────────────────
// Gemini — generación de JSON (inline)
// ──────────────────────────────────────────────

async function geminiGenerateContent(parts, maxOutputTokens = 1024) {
  const model = getGeminiModel();
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
  if (!response?.text) throw new Error("Respuesta vacía de Gemini");

  const raw = response.text();
  const cleaned = stripJsonWrapper(raw);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`JSON inválido en respuesta Gemini: ${err.message}. Raw: ${raw.slice(0, 200)}`);
  }
}

// ──────────────────────────────────────────────
// Gemini File API — sube un fichero, espera procesamiento,
// genera contenido y borra el fichero remoto.
// ──────────────────────────────────────────────

const FILE_API_MIME_MAP = {
  // Vídeo
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  m4v: "video/mp4",
  // Audio
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
};

async function geminiFileAPIGenerateContent(absolutePath, filename, promptText, maxOutputTokens = 1536) {
  const fileManager = getGeminiFileManager();
  const model = getGeminiModel();
  if (!fileManager || !model) throw new Error("GEMINI_API_KEY no configurada");

  const ext = absolutePath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = FILE_API_MIME_MAP[ext] ?? "application/octet-stream";

  console.log(`[AI] File API: subiendo '${filename}' (${mimeType})...`);
  const upload = await fileManager.uploadFile(absolutePath, { mimeType, displayName: filename });
  let file = upload.file;

  // Esperar hasta que Gemini procese el fichero (máx. 90 s)
  const deadline = Date.now() + 90_000;
  while (file.state === "PROCESSING") {
    if (Date.now() > deadline) {
      await fileManager.deleteFile(file.name).catch(() => {});
      throw new Error("Timeout esperando procesamiento en Gemini File API");
    }
    await new Promise((r) => setTimeout(r, 3_000));
    file = await fileManager.getFile(file.name);
  }

  if (file.state === "FAILED") {
    await fileManager.deleteFile(file.name).catch(() => {});
    throw new Error(`Gemini File API rechazó el fichero (state=FAILED): ${filename}`);
  }

  console.log(`[AI] File API: '${filename}' procesado, generando análisis...`);

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: promptText },
          { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    });

    const raw = result.response?.text?.() ?? "";
    if (!raw) throw new Error("Respuesta vacía de Gemini File API");
    const cleaned = stripJsonWrapper(raw);
    return JSON.parse(cleaned);
  } finally {
    // Limpiar el fichero remoto siempre, incluso si falla la generación
    await fileManager.deleteFile(file.name).catch((e) =>
      console.warn("[AI] No se pudo borrar fichero remoto:", e.message)
    );
  }
}

// ──────────────────────────────────────────────
// Orquestador: Azure primero (con timeout) → Gemini como fallback
// ──────────────────────────────────────────────

async function enrichWithFallback(azureFn, geminiFn) {
  if (getAzureClient()) {
    try {
      return await withTimeout(azureFn(), AZURE_TIMEOUT_MS);
    } catch (err) {
      console.warn(`[AI] Azure falló (${err.message}), usando Gemini como fallback...`);
    }
  }

  if (!getGeminiModel()) {
    throw new Error("No hay proveedor de IA disponible. Configura AZURE_OPENAI_API_KEY o GEMINI_API_KEY en .env");
  }

  return geminiFn();
}

// ──────────────────────────────────────────────
// Prompts compartidos
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

const AUDIO_JSON_SCHEMA = `{
  "transcription": "texto transcrito completo",
  "title": "título representativo (máx 30 caracteres)",
  "summary": "resumen breve en 2-3 frases",
  "topics": ["tema-específico-1", "tema-específico-2", "tema-específico-3"],
  "language": "es|en|...",
  "category": "categoría amplia y descriptiva"
}`;

function buildUserPrompt(instruction) {
  return `${instruction}

${TOPICS_INSTRUCTION}

Devuelve un JSON con la siguiente estructura exacta:
${JSON_SCHEMA}`;
}

// ──────────────────────────────────────────────
// Enriquecer NOTA (texto plano)
// ──────────────────────────────────────────────

export async function enrichNote(content) {
  const instruction = `Analiza la siguiente nota y extrae metadatos estructurados.

NOTA:
"""
${content.slice(0, 4000)}
"""`;

  const azureFn = () =>
    azureGenerateContent([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(instruction) },
    ]);

  const geminiFn = () =>
    geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }]);

  const result = await enrichWithFallback(azureFn, geminiFn);
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

  const instruction = `Analiza el siguiente enlace y sus metadatos disponibles para clasificarlo.

URL: ${url}
${previewContext}`;

  const azureFn = () =>
    azureGenerateContent([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(instruction) },
    ]);

  const geminiFn = () =>
    geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }]);

  const result = await enrichWithFallback(azureFn, geminiFn);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer FICHERO (PDF, Word, texto, imagen)
// ──────────────────────────────────────────────

export async function enrichFile(filePath, type, filename) {
  const absolutePath = resolveAbsolutePath(filePath);

  const extracted = await extractFileContent(absolutePath, type);

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
  const instruction = `Analiza el siguiente contenido de un fichero (tipo: ${type}, nombre: "${filename}"${pageCount ? `, ${pageCount} páginas` : ""}) y extrae metadatos estructurados.

CONTENIDO:
"""
${text.slice(0, 6000)}
"""`;

  const azureFn = () =>
    azureGenerateContent([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(instruction) },
    ]);

  const geminiFn = () =>
    geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }], 1024);

  const result = await enrichWithFallback(azureFn, geminiFn);
  return withTimestamp(result);
}

async function enrichImageWithVision(base64, mimeType, filename) {
  const instruction = `Analiza esta imagen (nombre de fichero: "${filename}") y extrae metadatos estructurados.`;

  const azureFn = () =>
    azureGenerateContent([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt(instruction) },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ]);

  const geminiFn = () =>
    geminiGenerateContent(
      [
        { text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` },
        { inlineData: { mimeType, data: base64 } },
      ],
      1024
    );

  const result = await enrichWithFallback(azureFn, geminiFn);
  return withTimestamp(result);
}

async function enrichFileByMetadata(filename, type) {
  const instruction = `Infiere metadatos de un fichero basándote únicamente en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"`;

  const azureFn = () =>
    azureGenerateContent(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(instruction) },
      ],
      512
    );

  const geminiFn = () =>
    geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }], 512);

  const result = await enrichWithFallback(azureFn, geminiFn);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer VÍDEO
//
// Estrategia:
//   1. Gemini File API: sube el vídeo y analiza el contenido real (transcripción visual,
//      descripción de escenas, tema, contexto…).
//   2. Fallback: enriquecimiento solo por metadatos (nombre/tipo) con Azure o Gemini.
// ──────────────────────────────────────────────

/**
 * @param {string} filePath  - ruta relativa o absoluta al fichero de vídeo
 * @param {string} filename  - nombre original del fichero (para mostrar y prompt)
 * @param {string} type      - tipo/extensión del vídeo
 */
export async function enrichVideo(filePath, filename, type) {
  const absolutePath = filePath ? resolveAbsolutePath(filePath) : null;

  if (absolutePath && existsSync(absolutePath) && getGeminiFileManager()) {
    try {
      const instruction = `Analiza este vídeo y extrae metadatos estructurados.
Describe el contenido visual, los temas tratados, el contexto y cualquier información relevante que puedas extraer.`;
      const promptText = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}`;

      const data = await geminiFileAPIGenerateContent(absolutePath, filename, promptText, 1024);
      console.log(`[AI] Vídeo '${filename}' enriquecido con File API.`);
      return withTimestamp(data);
    } catch (err) {
      console.warn(`[AI] Gemini File API para vídeo falló (${err.message}), usando metadata como fallback...`);
    }
  }

  // Fallback: inferencia solo por nombre y tipo
  return enrichVideoByMetadata(filename, type);
}

async function enrichVideoByMetadata(filename, type) {
  const instruction = `Infiere metadatos de un vídeo basándote en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${type}"`;

  const azureFn = () =>
    azureGenerateContent(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(instruction) },
      ],
      512
    );

  const geminiFn = () =>
    geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }], 512);

  const result = await enrichWithFallback(azureFn, geminiFn);
  return withTimestamp(result);
}

// ──────────────────────────────────────────────
// Enriquecer AUDIO
//
// Estrategia:
//   1. Si el fichero es pequeño (< 20 MB): inline base64 directo a Gemini (más rápido).
//   2. Si es grande o falla el inline: Gemini File API (subida + análisis).
//   3. Si todo falla: devuelve enriquecimiento con error para no bloquear el flujo.
// ──────────────────────────────────────────────

const AUDIO_MIME_MAP = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
};

const AUDIO_PROMPT_SUFFIX = `\n\nTranscribe el audio adjunto y analiza su contenido.
Devuelve un JSON con la siguiente estructura exacta:
${AUDIO_JSON_SCHEMA}`;

export async function enrichAudio(filePath, type) {
  const absolutePath = resolveAbsolutePath(filePath);

  if (!existsSync(absolutePath)) {
    return withTimestamp({ error: "Fichero de audio no encontrado", transcription: null });
  }

  const ext = (type || "").toLowerCase().replace(".", "") || absolutePath.split(".").pop()?.toLowerCase();
  const mimeType = AUDIO_MIME_MAP[ext] || "audio/mpeg";
  const filename = absolutePath.split(/[\\/]/).pop() ?? "audio";

  // ── Intento 1: inline base64 (para ficheros pequeños / notas de voz) ──
  let fileSize = 0;
  try {
    fileSize = statSync(absolutePath).size;
  } catch {
    return withTimestamp({ error: "No se pudo leer el fichero de audio", transcription: null });
  }

  if (fileSize <= AUDIO_INLINE_MAX_BYTES) {
    try {
      const buffer = await readFile(absolutePath);
      const base64 = buffer.toString("base64");
      const prompt = `${SYSTEM_PROMPT}${AUDIO_PROMPT_SUFFIX}`;
      const parts = [
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ];
      const result = await geminiGenerateContent(parts, 2048);
      console.log(`[AI] Audio '${filename}' transcrito/analizado (inline).`);
      return withTimestamp({ ...result, transcription: result.transcription ?? null });
    } catch (err) {
      console.warn(`[AI] Audio inline falló (${err.message}), probando File API...`);
    }
  } else {
    console.log(`[AI] Audio '${filename}' es grande (${Math.round(fileSize / 1024 / 1024)} MB), usando File API...`);
  }

  // ── Intento 2: Gemini File API ──
  if (getGeminiFileManager()) {
    try {
      const prompt = `${SYSTEM_PROMPT}${AUDIO_PROMPT_SUFFIX}`;
      const data = await geminiFileAPIGenerateContent(absolutePath, filename, prompt, 2048);
      console.log(`[AI] Audio '${filename}' transcrito/analizado (File API).`);
      return withTimestamp({ ...data, transcription: data.transcription ?? null });
    } catch (err) {
      console.warn(`[AI] Audio File API también falló: ${err.message}`);
    }
  }

  return withTimestamp({
    transcription: null,
    error: "No se pudo transcribir/analizar el audio (inline y File API fallaron)",
  });
}

// ──────────────────────────────────────────────
// Detectar EVENTOS DE CALENDARIO en un texto
//
// Analiza si el contenido contiene fechas, citas, recordatorios, deadlines,
// reuniones o cualquier evento que debería ir al calendario.
// Devuelve un array de eventos (puede ser vacío si no hay nada relevante).
// ──────────────────────────────────────────────

const CALENDAR_SCHEMA = `[
  {
    "title": "título breve del evento (máx 50 caracteres)",
    "date": "YYYY-MM-DD",
    "time": "HH:MM o null si no se especifica hora",
    "description": "descripción/contexto en 1-2 frases"
  }
]`;

const CURRENT_DATE_STR = () => new Date().toISOString().slice(0, 10);

/**
 * Analiza el contenido de un ítem y extrae eventos de calendario detectados.
 * @param {string} content - Texto a analizar (nota, título+URL, etc.)
 * @returns {Promise<Array<{title, date, time, description}>>} Array vacío si no hay eventos.
 */
export async function detectCalendarEvents(content) {
  const instruction = `Analiza el siguiente texto y detecta si contiene eventos de calendario: citas, reuniones, recordatorios, deadlines, cumpleaños, eventos, plazos u otras fechas importantes.

Fecha actual: ${CURRENT_DATE_STR()}

TEXTO:
"""
${content.slice(0, 3000)}
"""

Si el texto contiene uno o varios eventos de calendario, extráelos.
Si NO contiene ningún evento con fecha concreta, devuelve un array vacío: [].

IMPORTANTE:
- Solo extrae eventos con una fecha identificable (explícita o claramente deducible del contexto).
- Si hay una hora, inclúyela en formato HH:MM de 24h.
- Si no hay hora, usa null.
- Las fechas relativas ("mañana", "el lunes", "la próxima semana") deben convertirse a fecha absoluta YYYY-MM-DD usando la fecha actual como referencia.
- No inventes fechas que no aparezcan en el texto.

Responde ÚNICAMENTE con un array JSON válido:
${CALENDAR_SCHEMA}`;

  const azureFn = async () => {
    const client = getAzureClient();
    if (!client) throw new Error("Azure no disponible");
    const completion = await client.chat.completions.create({
      model: getAzureDeployment(),
      messages: [
        { role: "system", content: "Eres un asistente que extrae eventos de calendario de textos. Responde siempre con un array JSON válido." },
        { role: "user", content: instruction },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });
    const raw = stripJsonWrapper(completion.choices?.[0]?.message?.content ?? "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  };

  const geminiFn = async () => {
    const model = getGeminiModel();
    if (!model) throw new Error("Gemini no disponible");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: instruction }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: "application/json" },
    });
    const raw = stripJsonWrapper(result.response?.text?.() ?? "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  };

  try {
    if (getAzureClient()) {
      try {
        return await withTimeout(azureFn(), AZURE_TIMEOUT_MS);
      } catch (err) {
        console.warn(`[AI] detectCalendarEvents Azure falló (${err.message}), usando Gemini...`);
      }
    }
    if (getGeminiModel()) {
      return await geminiFn();
    }
  } catch (err) {
    console.warn("[AI] detectCalendarEvents falló:", err.message);
  }
  return [];
}
