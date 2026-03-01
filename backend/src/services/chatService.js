/**
 * chatService.js — Chat con contexto completo de la app para Riki Brain.
 * Principal: Azure OpenAI Responses API (gpt-5.1-chat). Fallback: Gemini.
 * Recupera: bóveda, calendario, temas, fábrica de ideas (pendientes).
 */

import prisma from "../lib/prisma.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;

const AZURE_CHAT_URL = (process.env.AZURE_CHAT_RESPONSES_URL ?? "").trim();
const AZURE_CHAT_API_KEY = process.env.AZURE_CHAT_API_KEY ?? "";
const AZURE_CHAT_MODEL = (process.env.AZURE_CHAT_MODEL ?? "gpt-5.1-chat").trim();
const isAzureChatConfigured = AZURE_CHAT_URL.length > 0 && AZURE_CHAT_API_KEY.length > 0 && !AZURE_CHAT_API_KEY.toLowerCase().includes("your-");

const MAX_SUMMARY_CHARS = 220;
const MAX_CALENDAR_EVENTS = 30;
const MAX_TOPICS = 25;
// Cuántos ítems incluir por tipo en la muestra (reparto equilibrado para que PDFs/archivos no queden ocultos)
const PER_KIND_TAKE = { note: 35, link: 35, file: 50, photo: 25, audio: 25, video: 25 };
const MAX_ITEMS_TOTAL = 80;

function parseAiEnrichment(jsonStr) {
  if (!jsonStr) return null;
  try {
    return typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
  } catch {
    return null;
  }
}

/** Etiqueta legible por tipo de archivo (PDF, Word, etc.) para que el modelo sepa qué hay. */
function fileTypeLabel(type) {
  if (!type || typeof type !== "string") return "Archivo";
  const t = type.toLowerCase();
  if (t === "pdf") return "Archivo PDF";
  if (t === "word" || t === "doc" || t === "docx") return "Archivo Word";
  if (t === "spreadsheet" || t.includes("xls")) return "Hoja de cálculo";
  if (t === "presentation" || t.includes("ppt")) return "Presentación";
  if (t === "image" || t === "photo") return "Imagen";
  return `Archivo ${type}`;
}

function toContextLine(item) {
  const ai = parseAiEnrichment(item.aiEnrichment);
  const title = (ai?.title ?? item.title ?? item.filename ?? item.url ?? "Sin título").slice(0, 100);
  const rawSummary = ai?.summary ?? item.content?.slice(0, 350) ?? "";
  const summary = rawSummary.slice(0, MAX_SUMMARY_CHARS) + (rawSummary.length > MAX_SUMMARY_CHARS ? "…" : "");
  let kindLabel;
  if (item.kind === "file") {
    kindLabel = fileTypeLabel(item.type);
    const fname = (item.filename || "").trim();
    if (fname) kindLabel += ` («${fname.slice(-40)}»)`;
  } else {
    kindLabel = item.kind === "note" ? "Nota" : item.kind === "link" ? "Enlace" : item.kind === "photo" ? "Foto" : item.kind === "audio" ? "Audio" : item.kind === "video" ? "Vídeo" : item.kind;
  }
  return `[${kindLabel}] ${title}\n${summary}`.trim();
}

function toCatalogItem(item) {
  const ai = parseAiEnrichment(item.aiEnrichment);
  const title = ai?.title ?? item.title ?? item.filename ?? item.url ?? "Sin título";
  const topics = Array.isArray(ai?.topics) ? ai.topics : [];
  return { id: item.id, kind: item.kind, title: String(title).slice(0, 120), topics };
}

/**
 * Resumen real de la base de datos: conteos en el baúl (procesados), en la fábrica (pendientes) y totales.
 * Así el modelo sabe cuántos enlaces/notas/archivos hay en total, no solo los ya procesados.
 */
async function getDatabaseSummary() {
  const whereProcessed = { inboxStatus: "processed" };
  const wherePending = { inboxStatus: "pending" };

  const [
    notesProcessed, linksProcessed, filesProcessed, photosProcessed, audiosProcessed, videosProcessed,
    notesPending, linksPending, filesPending, photosPending, audiosPending, videosPending,
    filesByType, favoritesCount,
  ] = await Promise.all([
    prisma.note.count({ where: whereProcessed }),
    prisma.link.count({ where: whereProcessed }),
    prisma.file.count({ where: whereProcessed }),
    prisma.photo.count({ where: whereProcessed }),
    prisma.audio.count({ where: whereProcessed }),
    prisma.video.count({ where: whereProcessed }),
    prisma.note.count({ where: wherePending }),
    prisma.link.count({ where: wherePending }),
    prisma.file.count({ where: wherePending }),
    prisma.photo.count({ where: wherePending }),
    prisma.audio.count({ where: wherePending }),
    prisma.video.count({ where: wherePending }),
    prisma.file.groupBy({ by: ["type"], where: whereProcessed, _count: { type: true } }),
    prisma.favorite.count().catch(() => 0),
  ]);

  const totalProcessed = notesProcessed + linksProcessed + filesProcessed + photosProcessed + audiosProcessed + videosProcessed;
  const totalPending = notesPending + linksPending + filesPending + photosPending + audiosPending + videosPending;
  const totalAll = totalProcessed + totalPending;

  const baúlParts = [];
  if (notesProcessed) baúlParts.push(`${notesProcessed} nota(s)`);
  if (linksProcessed) baúlParts.push(`${linksProcessed} enlace(s)`);
  if (filesProcessed > 0) {
    const typeParts = filesByType.map((g) => `${g._count.type} ${fileTypeLabel(g.type).replace(/^Archivo /, "").toLowerCase()}`).filter(Boolean);
    baúlParts.push(`${filesProcessed} archivo(s)${typeParts.length ? ` (${typeParts.join(", ")})` : ""}`);
  }
  if (photosProcessed) baúlParts.push(`${photosProcessed} foto(s)`);
  if (audiosProcessed) baúlParts.push(`${audiosProcessed} audio(s)`);
  if (videosProcessed) baúlParts.push(`${videosProcessed} vídeo(s)`);

  let text = "";
  if (totalProcessed > 0) {
    text += `En el baúl (ya procesados): ${totalProcessed} ítem(s). Desglose: ${baúlParts.join("; ")}.`;
  }
  if (totalPending > 0) {
    const pendParts = [];
    if (notesPending) pendParts.push(`${notesPending} notas`);
    if (linksPending) pendParts.push(`${linksPending} enlaces`);
    if (filesPending) pendParts.push(`${filesPending} archivos`);
    if (photosPending) pendParts.push(`${photosPending} fotos`);
    if (audiosPending) pendParts.push(`${audiosPending} audios`);
    if (videosPending) pendParts.push(`${videosPending} vídeos`);
    text += (text ? " " : "") + `En la fábrica de ideas (pendientes): ${totalPending} (${pendParts.join(", ")}).`;
  }
  if (totalAll > 0) {
    text += (text ? " " : "") + `Total guardados en la app: ${totalAll} ítem(s).`;
    const linksTotal = linksProcessed + linksPending;
    const notesTotal = notesProcessed + notesPending;
    const filesTotal = filesProcessed + filesPending;
    if (linksTotal) text += ` Enlaces en total: ${linksTotal}.`;
    if (notesTotal) text += ` Notas en total: ${notesTotal}.`;
    if (filesTotal) text += ` Archivos en total: ${filesTotal}.`;
  }
  if (favoritesCount) text += (text ? " " : "") + `Favoritos: ${favoritesCount}.`;
  if (!text) return "La base de datos no tiene aún ítems guardados.";
  return text.trim();
}

/**
 * Recupera contexto de la bóveda con:
 * 1) Resumen real de la BD (conteos y tipos de archivo, p. ej. "120 PDFs").
 * 2) Muestra equilibrada por tipo (muchos archivos/PDFs) y búsqueda por palabras clave (incl. tipo y nombre de fichero).
 */
export async function getChatContext(userMessage) {
  const messageLower = (userMessage || "").trim().toLowerCase();
  const keywords = messageLower.split(/\s+/).filter((w) => w.length > 1);
  const wantsFiles = /\b(pdf|pdfs|documento|documentos|archivo|archivos|fichero|word|excel)\b/.test(messageLower);

  const whereProcessed = { inboxStatus: "processed" };

  const [dbSummary, notes, links, files, photos, audios, videos] = await Promise.all([
    getDatabaseSummary(),
    prisma.note.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.note }),
    prisma.link.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.link }),
    prisma.file.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.file }),
    prisma.photo.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.photo }),
    prisma.audio.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.audio }),
    prisma.video.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: PER_KIND_TAKE.video }),
  ]);

  const lower = (s) => (s ?? "").toString().toLowerCase();
  const matchesKeyword = (item) => {
    const ai = parseAiEnrichment(item.aiEnrichment);
    const title = lower(ai?.title ?? item.title ?? item.filename ?? item.url);
    const summary = lower(ai?.summary ?? "");
    const content = lower(item.content ?? "");
    const typeStr = lower(item.type ?? "");
    const filenameStr = lower(item.filename ?? "");
    const searchable = `${title} ${summary} ${content} ${typeStr} ${filenameStr}`;
    return keywords.some((k) => searchable.includes(k));
  };

  let noteItems = notes.map((n) => ({ ...n, kind: "note", title: null, content: n.content }));
  let linkItems = links.map((l) => ({ ...l, kind: "link", content: null }));
  let fileItems = files.map((f) => ({ ...f, kind: "file", title: null, content: null }));
  let photoItems = photos.map((p) => ({ ...p, kind: "photo", title: null, content: null }));
  let audioItems = audios.map((a) => ({ ...a, kind: "audio", title: null, content: null }));
  let videoItems = videos.map((v) => ({ ...v, kind: "video", content: null }));

  if (keywords.length > 0) {
    const filterKind = (arr) => (arr.length > 0 && arr.some(matchesKeyword) ? arr.filter(matchesKeyword) : arr);
    noteItems = filterKind(noteItems);
    linkItems = filterKind(linkItems);
    fileItems = filterKind(fileItems);
    photoItems = filterKind(photoItems);
    audioItems = filterKind(audioItems);
    videoItems = filterKind(videoItems);
  }

  // Muestra equilibrada: priorizar archivos si el usuario pregunta por PDFs/documentos
  const cap = (arr, n) => arr.slice(0, n);
  const fileCap = wantsFiles ? Math.min(fileItems.length, 40) : Math.min(fileItems.length, 25);
  const noteCap = Math.min(noteItems.length, 18);
  const linkCap = Math.min(linkItems.length, 18);
  const restCap = 8;
  const balanced = [
    ...cap(noteItems, noteCap),
    ...cap(linkItems, linkCap),
    ...cap(fileItems, fileCap),
    ...cap(photoItems, restCap),
    ...cap(audioItems, restCap),
    ...cap(videoItems, restCap),
  ].slice(0, MAX_ITEMS_TOTAL);

  const contextText =
    `=== RESUMEN DE LA BASE DE DATOS (conteos reales) ===\n${dbSummary}\n\n=== MUESTRA DE CONTENIDO (título y resumen por ítem) ===\n` +
    balanced.map(toContextLine).join("\n\n");
  const catalog = balanced.map(toCatalogItem);
  return { contextText, catalog };
}

/** Eventos de calendario (próximos o todos si hay pocos). */
async function getCalendarContext() {
  try {
    const events = await prisma.calendarEvent.findMany({
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: MAX_CALENDAR_EVENTS,
    });
    if (events.length === 0) return "No hay eventos en el calendario.";
    return events
      .map((e) => {
        const when = e.time ? `${e.date} ${e.time}` : e.date;
        return `- ${e.title} (${when})${e.description ? ": " + e.description.slice(0, 80) : ""}`;
      })
      .join("\n");
  } catch {
    return "Calendario no disponible.";
  }
}

/** Resúmenes por tema (TopicSummary). */
async function getTopicsContext() {
  try {
    const topics = await prisma.topicSummary.findMany({
      orderBy: { itemCount: "desc" },
      take: MAX_TOPICS,
    });
    if (topics.length === 0) return "Aún no hay temas con resumen.";
    return topics
      .map((t) => {
        const sum = (t.summary || "").slice(0, 200) + ((t.summary || "").length > 200 ? "…" : "");
        return `- **${t.topic}** (${t.itemCount} ítem(s)): ${sum}`;
      })
      .join("\n");
  } catch {
    return "Temas no disponibles.";
  }
}

/** Conteo de ítems pendientes en la fábrica de ideas (inbox). */
async function getPendingContext() {
  try {
    const [notes, links, files, photos, audios, videos] = await Promise.all([
      prisma.note.count({ where: { inboxStatus: "pending" } }),
      prisma.link.count({ where: { inboxStatus: "pending" } }),
      prisma.file.count({ where: { inboxStatus: "pending" } }),
      prisma.photo.count({ where: { inboxStatus: "pending" } }),
      prisma.audio.count({ where: { inboxStatus: "pending" } }),
      prisma.video.count({ where: { inboxStatus: "pending" } }),
    ]);
    const parts = [];
    if (notes) parts.push(`${notes} nota(s)`);
    if (links) parts.push(`${links} enlace(s)`);
    if (files) parts.push(`${files} archivo(s)`);
    if (photos) parts.push(`${photos} foto(s)`);
    if (audios) parts.push(`${audios} audio(s)`);
    if (videos) parts.push(`${videos} vídeo(s)`);
    if (parts.length === 0) return "No hay ítems pendientes en la fábrica de ideas.";
    return `Pendientes de procesar: ${parts.join(", ")}.`;
  } catch {
    return "Estado del inbox no disponible.";
  }
}

/**
 * Contexto completo de la app para el chat: bóveda, calendario, temas, pendientes.
 * @returns {Promise<{ vault: { contextText, catalog }, calendarText: string, topicsText: string, pendingText: string }>}
 */
export async function getFullAppContext(userMessage) {
  const [vault, calendarText, topicsText, pendingText] = await Promise.all([
    getChatContext(userMessage),
    getCalendarContext(),
    getTopicsContext(),
    getPendingContext(),
  ]);
  return { vault, calendarText, topicsText, pendingText };
}

/**
 * Extrae JSON de la respuesta (quita markdown code block si viene envuelto).
 */
function extractJsonFromResponse(raw) {
  let text = (raw || "").trim();
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) text = codeBlock[1].trim();
  return text;
}

/**
 * Parsea el texto de la respuesta desde el formato de Azure Responses API.
 * response.output[] -> type "message" -> content[] -> type "output_text" -> text
 */
function parseAzureResponsesOutput(data) {
  const output = data?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block?.type === "output_text" && typeof block.text === "string") {
          return block.text.trim();
        }
      }
    }
  }
  return null;
}

/**
 * Llama a Azure OpenAI Responses API (gpt-5.1-chat). Devuelve el texto de la respuesta o null si falla.
 */
async function getAzureChatReply(promptFinal) {
  if (!isAzureChatConfigured) return null;
  const res = await fetch(AZURE_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_CHAT_API_KEY,
    },
    body: JSON.stringify({
      model: AZURE_CHAT_MODEL,
      input: promptFinal,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure Responses API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = parseAzureResponsesOutput(data);
  if (!text) throw new Error("Respuesta de Azure sin output_text");
  return text;
}

/**
 * Responde con Gemini usando el contexto completo de la app. Devuelve el texto en bruto de la respuesta.
 */
async function getGeminiChatReply(promptFinal) {
  if (!geminiModel) return null;
  const result = await geminiModel.generateContent(promptFinal);
  const response = result.response;
  if (!response?.text) throw new Error("Respuesta vacía de Gemini");
  return response.text();
}

/**
 * Construye el prompt completo (sistema + contexto + usuario) para el chat.
 */
function buildChatPrompt(vault, calendarText, topicsText, pendingText, userMessage) {
  const systemDescription = `Eres Riki Brain, el asistente del Cerebro Digital. Tienes el contexto real de la aplicación:

1) RESUMEN DE LA BASE DE DATOS: conteos reales. Incluye (a) baúl = ya procesados, (b) fábrica de ideas = pendientes, (c) total guardados y "Enlaces en total", "Notas en total", "Archivos en total". Cuando pregunten "cuántos enlaces tengo" usa el total (baúl + pendientes), no solo el baúl.
2) MUESTRA DE CONTENIDO: una selección de ítems con título y resumen. Es solo una muestra; el total real está en el resumen. No digas "no hay PDFs" si en el resumen aparece que hay muchos PDFs.
3) CALENDARIO: eventos.
4) TEMAS: resúmenes por tema con cantidad de ítems.
5) FÁBRICA DE IDEAS: pendientes de procesar.

Usa siempre el resumen para dar cifras correctas ("tienes X PDFs", "hay Y notas"). Si preguntan por documentos o PDFs, confía en el desglose del resumen. Responde en el mismo idioma que el usuario. Sé conciso y amigable.`;

  const contextBlock = `
--- CONTEXTO COMPLETO DE LA APP (base de datos + muestra) ---

${vault.contextText || "Ningún ítem en la base de datos."}

**Calendario:**
${calendarText}

**Temas:**
${topicsText}

**Fábrica de ideas:**
${pendingText}
--- FIN CONTEXTO ---`;

  return `${systemDescription}
${contextBlock}

El usuario dice: "${userMessage}"

Responde ÚNICAMENTE con un JSON válido (nada más, sin markdown ni texto extra):
{"message": "Tu respuesta aquí"}`;
}

/**
 * Responde al usuario: principal Azure (gpt-5.1-chat), fallback Gemini.
 * Devuelve { message }.
 */
export async function getRickyBrainReply(userMessage) {
  if (!isAzureChatConfigured && !geminiModel) {
    throw new Error("Configura AZURE_CHAT_API_KEY y AZURE_CHAT_RESPONSES_URL, o GEMINI_API_KEY en .env");
  }

  const { vault, calendarText, topicsText, pendingText } = await getFullAppContext(userMessage);
  const promptFinal = buildChatPrompt(vault, calendarText, topicsText, pendingText, userMessage);

  let raw = null;
  let usedAzure = false;

  if (isAzureChatConfigured) {
    try {
      raw = await getAzureChatReply(promptFinal);
      usedAzure = true;
    } catch (err) {
      console.warn("[Chat] Azure Responses API falló, usando Gemini:", err.message);
    }
  }

  if (raw == null && geminiModel) {
    raw = await getGeminiChatReply(promptFinal);
  }

  if (raw == null || !raw.trim()) {
    throw new Error("No se pudo obtener respuesta del chat. Revisa la configuración de Azure o Gemini.");
  }

  const jsonStr = extractJsonFromResponse(raw);
  try {
    const parsed = JSON.parse(jsonStr);
    const message = typeof parsed.message === "string" ? parsed.message.trim() : raw;
    return { message };
  } catch {
    return { message: raw };
  }
}

export function isChatEnabled() {
  return isAzureChatConfigured || !!GEMINI_API_KEY;
}
