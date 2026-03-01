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
import { existsSync, statSync, createReadStream as fsCreateReadStream } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { extractFileContent } from "./fileExtractService.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Timeout en ms para Azure antes de activar el fallback a Gemini
const AZURE_TIMEOUT_MS = 15_000;

// ─── Lazy singletons ────────────────────────────────────────────────────────

let _azureClient = undefined;
let _azureWhisperClient = undefined;
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

/**
 * Cliente para transcripción de audio con Whisper.
 *
 * Prioridad:
 *   1. Azure Whisper: requiere AZURE_WHISPER_DEPLOYMENT configurado explícitamente
 *      (y AZURE_WHISPER_ENDPOINT / AZURE_WHISPER_API_KEY opcionales).
 *   2. OpenAI estándar: si OPENAI_API_KEY está configurado (usa api.openai.com).
 *
 * Si ninguno está disponible devuelve null (sin transcripción).
 */
function getAzureWhisperClient() {
  if (_azureWhisperClient !== undefined) return _azureWhisperClient;

  // ── Opción 1: Azure Whisper (sólo si hay deployment explícito) ──
  const azureDeployment = process.env.AZURE_WHISPER_DEPLOYMENT || process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT || "";
  if (azureDeployment) {
    const endpoint = (
      process.env.AZURE_WHISPER_ENDPOINT ||
      process.env.AZURE_OPENAI_ENDPOINT ||
      ""
    ).replace(/\/$/, "");
    const apiKey =
      process.env.AZURE_WHISPER_API_KEY ||
      process.env.AZURE_OPENAI_API_KEY ||
      "";
    const apiVersion =
      process.env.AZURE_WHISPER_API_VERSION ||
      process.env.AZURE_OPENAI_API_VERSION ||
      "2024-06-01";

    if (endpoint && apiKey) {
      _azureWhisperClient = {
        client: new OpenAI({
          apiKey,
          baseURL: `${endpoint}/openai/deployments/${azureDeployment}`,
          defaultQuery: { "api-version": apiVersion },
          defaultHeaders: { "api-key": apiKey },
        }),
        deployment: azureDeployment,
        isAzure: true,
      };
      console.log("[AI] Azure Whisper client inicializado (deployment:", azureDeployment, ")");
      return _azureWhisperClient;
    }
  }

  // ── Opción 2: OpenAI estándar ──
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  if (openaiKey) {
    _azureWhisperClient = {
      client: new OpenAI({ apiKey: openaiKey }),
      deployment: "whisper-1",
      isAzure: false,
    };
    console.log("[AI] OpenAI Whisper client inicializado");
    return _azureWhisperClient;
  }

  _azureWhisperClient = null;
  return null;
}

function getGeminiModel() {
  if (_geminiModel !== undefined) return _geminiModel;

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    _geminiModel = null;
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  _geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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
// Reintentos para errores 429 de Gemini
// ──────────────────────────────────────────────

const GEMINI_MAX_RETRIES = 3;

/**
 * Extrae el delay sugerido del cuerpo del error 429 de Gemini.
 * Formato: "Please retry in 38.723195058s."
 * Devuelve ms con un margen de +2 s, o null si no se puede parsear.
 */
function parseGeminiRetryDelayMs(err) {
  const msg = err?.message ?? "";
  const match = /Please retry in ([0-9.]+)s/i.exec(msg);
  if (match) {
    const seconds = parseFloat(match[1]);
    if (!isNaN(seconds)) return Math.ceil(seconds * 1000) + 2_000;
  }
  return null;
}

function isGeminiRateLimitError(err) {
  const msg = err?.message ?? "";
  return (
    err?.status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota") ||
    msg.includes("Too Many Requests")
  );
}

/**
 * Envuelve una llamada a la API de Gemini con reintentos automáticos en caso de 429.
 * Usa el retryDelay que indica la propia API; si no está presente aplica backoff exponencial.
 */
async function withGeminiRetry(fn, label = "Gemini") {
  let lastErr;
  for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isGeminiRateLimitError(err)) throw err; // error no retriable

      const apiDelay = parseGeminiRetryDelayMs(err);
      const delay = apiDelay ?? Math.min(15_000 * attempt, 90_000); // backoff exponencial
      console.warn(
        `[AI] ${label}: límite de tasa (429), intento ${attempt}/${GEMINI_MAX_RETRIES}. ` +
        `Esperando ${Math.round(delay / 1000)} s antes de reintentar...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ──────────────────────────────────────────────
// Gemini — generación de JSON (inline)
// ──────────────────────────────────────────────

async function geminiGenerateContent(parts, maxOutputTokens = 1024) {
  const model = getGeminiModel();
  if (!model) throw new Error("GEMINI_API_KEY no configurada");

  return withGeminiRetry(async () => {
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
  }, "Gemini inline");
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
    // El fichero ya está subido: solo reintentamos generateContent en caso de 429
    return await withGeminiRetry(async () => {
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
    }, `File API '${filename}'`);
  } finally {
    // Limpiar el fichero remoto siempre, incluso si todos los reintentos fallan
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
  const hasPreview = Object.keys(existingPreview).length > 0;
  const previewContext = hasPreview
    ? `Metadatos Open Graph ya extraídos:\n- Título: ${existingPreview.title ?? "N/A"}\n- Descripción: ${existingPreview.description ?? "N/A"}`
    : "No hay metadatos previos disponibles.";

  // Si Firecrawl extrajo markdown, incluirlo como contexto rico (truncado a 6000 chars)
  const markdownContext = existingPreview.markdown
    ? `\n\nContenido completo de la página (markdown):\n"""\n${existingPreview.markdown.slice(0, 6000)}\n"""`
    : "";

  const instruction = `Analiza el siguiente enlace y su contenido para clasificarlo y generar metadatos ricos.

URL: ${url}
${previewContext}${markdownContext}`;

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
  const ext = extname(absolutePath).toLowerCase().replace(/^\./, "");
  const effectiveType = !type || type === "unknown" || type === "file" ? ext || type : type;

  const extracted = await extractFileContent(absolutePath, effectiveType);

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
  const isPdf = type === "pdf";
  const charLimit = isPdf ? 10000 : 6000;
  const instruction = `Analiza el siguiente contenido EXTRAÍDO del interior del documento (tipo: ${type}, nombre del fichero: "${filename}"${pageCount ? `, ${pageCount} páginas` : ""}) y extrae metadatos estructurados.

IMPORTANTE: El "title" debe reflejar el TEMA o asunto del contenido (ej. "Sistemas operativos - Procesos"), no el nombre del archivo. El "summary" debe describir ÚNICAMENTE las ideas, temas y conclusiones del texto. NO describas el formato del archivo (evita frases como "documento PDF", "archivo titulado...", "posiblemente relacionado con...").

CONTENIDO DEL DOCUMENTO:
"""
${text.slice(0, charLimit)}
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
  const instruction = `Solo tienes el nombre y tipo del archivo (no se pudo extraer el contenido del interior).

Nombre: "${filename}"
Tipo: "${type}"

Genera un "title" corto a partir del nombre del fichero. En "summary" escribe UNA frase indicando que el contenido no pudo extraerse automáticamente y que se puede abrir el archivo para revisarlo. NO inventes temas, temas de curso ni descripciones del contenido. Topics y category deben ser genéricos (ej. "documento", "archivo").`;

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
// Estrategia en cascada:
//   1. Azure Whisper: transcribe la pista de audio del vídeo (mp4/webm/etc.) y
//      genera metadatos ricos a partir de la transcripción.
//   2. Gemini File API (análisis visual): si no hay transcripción de audio, sube
//      el vídeo y pide a Gemini que describa visualmente su contenido. La descripción
//      visual se guarda en el campo `transcription` para mostrarse en la UI.
//   3. Metadata-only: último recurso, solo nombre y tipo del fichero.
// ──────────────────────────────────────────────

// Formatos de vídeo que Whisper acepta para transcripción de la pista de audio
const VIDEO_WHISPER_EXTS = new Set(["mp4", "mpeg", "mpga", "m4a", "wav", "webm", "mp3"]);

// Schema extendido para análisis visual de vídeo (incluye descripción visual)
const VIDEO_VISUAL_JSON_SCHEMA = `{
  "title": "título representativo (máx 30 caracteres)",
  "summary": "resumen breve en 2-3 frases",
  "topics": ["tema-específico-1", "tema-específico-2", "tema-específico-3"],
  "language": "es|en|...",
  "category": "categoría amplia y descriptiva",
  "visualDescription": "descripción detallada de lo que se ve en el vídeo: escenas, personas, objetos, acciones, texto visible, contexto visual, etc. Mínimo 3-5 frases."
}`;

/**
 * @param {string} filePath  - ruta relativa o absoluta al fichero de vídeo
 * @param {string} filename  - nombre original del fichero (para mostrar y prompt)
 * @param {string} type      - tipo/extensión del vídeo
 */
export async function enrichVideo(filePath, filename, type) {
  const absolutePath = filePath ? resolveAbsolutePath(filePath) : null;
  const ext = (filename || "").split(".").pop()?.toLowerCase() ?? "";

  // ── Paso 1: Azure Whisper (transcripción de la pista de audio del vídeo) ──
  if (absolutePath && existsSync(absolutePath) && VIDEO_WHISPER_EXTS.has(ext)) {
    const transcription = await transcribeWithAzureWhisper(absolutePath, filename);
    if (transcription) {
      console.log(`[AI] Vídeo '${filename}' transcrito con Azure Whisper.`);
      const instruction = `Analiza el siguiente texto, que es la transcripción del audio de un vídeo llamado "${filename}".
Extrae metadatos estructurados sobre su contenido, tema, contexto y cualquier información relevante.

TRANSCRIPCIÓN:
"""
${transcription.slice(0, 4000)}
"""`;

      const azureFn = () =>
        azureGenerateContent(
          [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(instruction) },
          ],
          768
        );

      const geminiFn = () =>
        geminiGenerateContent([{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(instruction)}` }], 768);

      try {
        const metadata = await enrichWithFallback(azureFn, geminiFn);
        return withTimestamp({ ...metadata, transcription });
      } catch (err) {
        console.warn(`[AI] Metadatos desde transcripción de vídeo fallaron (${err.message}), continuando...`);
      }
    }
  }

  // ── Paso 2: Gemini File API — análisis visual completo ──
  // Sin transcripción de audio, pedimos a Gemini que describa visualmente el vídeo.
  // La descripción visual se guarda en `transcription` para mostrarse en la UI.
  if (absolutePath && existsSync(absolutePath) && getGeminiFileManager()) {
    try {
      const promptText = `${SYSTEM_PROMPT}

Analiza este vídeo visualmente e interpreta su contenido completo.
Observa las escenas, personas, objetos, acciones, texto visible, ambiente, colores y cualquier elemento relevante.

${TOPICS_INSTRUCTION}

Devuelve un JSON con la siguiente estructura exacta:
${VIDEO_VISUAL_JSON_SCHEMA}`;

      const raw = await geminiFileAPIGenerateContent(absolutePath, filename, promptText, 1400);

      // Extraer visualDescription y usarla como transcription en la UI
      const { visualDescription, ...metadata } = raw;
      const transcription = visualDescription?.trim() || null;

      console.log(`[AI] Vídeo '${filename}' analizado visualmente con Gemini File API.${transcription ? " Descripción visual generada." : ""}`);
      return withTimestamp({ ...metadata, transcription });
    } catch (err) {
      console.warn(`[AI] Gemini File API para vídeo falló (${err.message}), usando metadata como fallback...`);
    }
  }

  // ── Paso 3: Metadata-only (inferencia por nombre y tipo) ──
  console.log(`[AI] Vídeo '${filename}': usando inferencia por metadata.`);
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
//   1. Azure Whisper → transcripción del audio.
//   2. Azure chat completion → title/summary/topics/category a partir de la transcripción.
//   3. Si Azure Whisper no está disponible o falla → devuelve metadatos inferidos por nombre.
//   (Se elimina la dependencia de Gemini para audio, que causaba errores 429.)
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

/**
 * Transcribe un fichero de audio usando Azure OpenAI Whisper.
 * Devuelve el texto transcrito o null si falla / no está disponible.
 */
async function transcribeWithAzureWhisper(absolutePath, filename) {
  const whisper = getAzureWhisperClient();
  if (!whisper) return null;

  try {
    const { createReadStream } = await import("fs");
    const fileStream = createReadStream(absolutePath);
    // El cliente ya tiene el baseURL apuntando al deployment de Whisper,
    // por lo que usamos model="" (Azure ignora el campo model en el path).
    const response = await whisper.client.audio.transcriptions.create({
      model: whisper.deployment,
      file: fileStream,
      response_format: "text",
    });
    // La respuesta puede ser string directamente o { text: "..." }
    const transcription =
      typeof response === "string" ? response : response?.text ?? null;
    return transcription?.trim() || null;
  } catch (err) {
    console.warn(`[AI] Azure Whisper transcripción falló (${err.message})`);
    return null;
  }
}

export async function enrichAudio(filePath, type) {
  const absolutePath = resolveAbsolutePath(filePath);

  if (!existsSync(absolutePath)) {
    return withTimestamp({ error: "Fichero de audio no encontrado", transcription: null });
  }

  const filename = absolutePath.split(/[\\/]/).pop() ?? "audio";

  // ── Paso 1: Transcripción con Azure Whisper ──
  let transcription = null;
  try {
    transcription = await transcribeWithAzureWhisper(absolutePath, filename);
    if (transcription) {
      console.log(`[AI] Audio '${filename}' transcrito con Azure Whisper.`);
    } else {
      console.log(`[AI] Azure Whisper no disponible o sin resultado para '${filename}'.`);
    }
  } catch (err) {
    console.warn(`[AI] Error inesperado en Azure Whisper: ${err.message}`);
  }

  // ── Paso 2: Metadatos (title/summary/topics/category) vía Azure chat ──
  const baseInstruction = transcription
    ? `Analiza el siguiente texto, que es la transcripción de un archivo de audio llamado "${filename}".

TRANSCRIPCIÓN:
"""
${transcription.slice(0, 4000)}
"""`
    : `Infiere metadatos de un archivo de audio basándote únicamente en su nombre y tipo.

Nombre: "${filename}"
Tipo: "${(type || "").toLowerCase()}"`;

  const azureFn = () =>
    azureGenerateContent(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(baseInstruction) },
      ],
      512
    );

  const geminiFn = () =>
    geminiGenerateContent(
      [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(baseInstruction)}` }],
      512
    );

  let metadata = {};
  try {
    metadata = await enrichWithFallback(azureFn, geminiFn);
  } catch (err) {
    console.warn(`[AI] No se pudieron obtener metadatos para audio '${filename}': ${err.message}`);
  }

  return withTimestamp({ ...metadata, transcription: transcription ?? null });
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
export async function detectCalendarEvents(content, { maxChars = 4000 } = {}) {
  const instruction = `Analiza el siguiente texto y detecta si contiene eventos de calendario: citas médicas, consultas, reuniones, recordatorios, deadlines, cumpleaños, eventos, plazos u otras fechas importantes.

Fecha actual: ${CURRENT_DATE_STR()}

TEXTO:
"""
${content.slice(0, maxChars)}
"""

Si el texto contiene uno o varios eventos de calendario, extráelos.
Si NO contiene ningún evento con fecha concreta, devuelve un array vacío: [].

IMPORTANTE:
- Presta especial atención a citas médicas, consultas con especialistas, analíticas, pruebas diagnósticas y revisiones. Si el documento es de ese tipo, SIEMPRE extrae el evento.
- Solo extrae eventos con una fecha identificable (explícita o claramente deducible del contexto).
- Si hay una hora, inclúyela en formato HH:MM de 24h.
- Si no hay hora, usa null.
- Las fechas relativas ("mañana", "el lunes", "la próxima semana") deben convertirse a fecha absoluta YYYY-MM-DD usando la fecha actual como referencia.
- No inventes fechas que no aparezcan en el texto.
- En el campo "description" incluye detalles relevantes: médico, especialidad, lugar, sala, número de paciente, etc.

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

/**
 * Genera o mejora un resumen acumulativo para un tema.
 * @param {string} topic - El nombre del tema
 * @param {string|null} existingSummary - Resumen anterior (null si es nuevo)
 * @param {{ kind: string, title: string, summary?: string, content?: string }} newItem - Ítem recién procesado
 * @returns {Promise<string>} Resumen actualizado en prosa
 */
export async function updateTopicSummary(topic, existingSummary, newItem) {
  const itemInfo = [
    `Tipo: ${newItem.kind}`,
    `Título: ${newItem.title ?? "(sin título)"}`,
    newItem.summary ? `Resumen del ítem: ${newItem.summary}` : null,
    newItem.content ? `Contenido: ${String(newItem.content).slice(0, 600)}` : null,
  ].filter(Boolean).join("\n");

  const instruction = existingSummary
    ? `Tienes un resumen existente sobre el tema "${topic}":\n\n${existingSummary}\n\nSe ha añadido un nuevo ítem relacionado con este tema:\n${itemInfo}\n\nReescribe y mejora el resumen incorporando la nueva información. Devuelve solo el texto del resumen en prosa, sin títulos ni listas, en 2-4 párrafos.`
    : `Crea un resumen inicial sobre el tema "${topic}" basándote en este ítem:\n${itemInfo}\n\nDevuelve solo el texto del resumen en prosa, sin títulos ni listas, en 1-3 párrafos.`;

  const azureFn = async () => {
    const client = getAzureClient();
    if (!client) throw new Error("Azure no disponible");
    const completion = await client.chat.completions.create({
      model: getAzureDeployment(),
      messages: [
        { role: "system", content: "Eres un asistente experto en sintetizar y resumir conocimiento. Escribes en español de forma clara y concisa." },
        { role: "user", content: instruction },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });
    return completion.choices?.[0]?.message?.content?.trim() ?? "";
  };

  const geminiFn = async () => {
    const model = getGeminiModel();
    if (!model) throw new Error("Gemini no disponible");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: instruction }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
    });
    return result.response?.text?.()?.trim() ?? "";
  };

  try {
    if (getAzureClient()) {
      try {
        const text = await withTimeout(azureFn(), AZURE_TIMEOUT_MS);
        if (text) return text;
      } catch (err) {
        console.warn(`[AI] updateTopicSummary Azure falló (${err.message}), usando Gemini...`);
      }
    }
    if (getGeminiModel()) {
      const text = await geminiFn();
      if (text) return text;
    }
  } catch (err) {
    console.warn("[AI] updateTopicSummary falló:", err.message);
  }

  // Fallback: texto plano básico
  const base = existingSummary ? `${existingSummary}\n\n` : "";
  return `${base}[${newItem.kind}] ${newItem.title ?? "Sin título"}${newItem.summary ? `: ${newItem.summary}` : ""}`.trim();
}
