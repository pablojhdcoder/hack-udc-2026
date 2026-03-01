/**
 * chatService.js — Chat con contexto completo de la app para Riki Brain.
 * Recupera: bóveda (notas, enlaces, archivos, fotos, audios, vídeos), calendario, temas, fábrica de ideas (pendientes).
 */

import prisma from "../lib/prisma.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;

const MAX_CONTEXT_ITEMS = 20;
const MAX_SUMMARY_CHARS = 280;
const MAX_CALENDAR_EVENTS = 30;
const MAX_TOPICS = 25;

function parseAiEnrichment(jsonStr) {
  if (!jsonStr) return null;
  try {
    return typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
  } catch {
    return null;
  }
}

function toContextLine(item) {
  const ai = parseAiEnrichment(item.aiEnrichment);
  const title = (ai?.title ?? item.title ?? item.filename ?? item.url ?? "Sin título").slice(0, 120);
  const rawSummary = ai?.summary ?? item.content?.slice(0, 400) ?? "";
  const summary = rawSummary.slice(0, MAX_SUMMARY_CHARS) + (rawSummary.length > MAX_SUMMARY_CHARS ? "…" : "");
  const kindLabel = item.kind === "note" ? "Nota" : item.kind === "link" ? "Enlace" : item.kind === "file" ? "Archivo" : item.kind === "photo" ? "Foto" : item.kind === "audio" ? "Audio" : item.kind === "video" ? "Vídeo" : item.kind;
  return `[${kindLabel}] ${title}\n${summary}`.trim();
}

function toCatalogItem(item) {
  const ai = parseAiEnrichment(item.aiEnrichment);
  const title = ai?.title ?? item.title ?? item.filename ?? item.url ?? "Sin título";
  const topics = Array.isArray(ai?.topics) ? ai.topics : [];
  return { id: item.id, kind: item.kind, title: String(title).slice(0, 120), topics };
}

/**
 * Recupera contexto de la bóveda: últimos ítems procesados + catálogo (id, kind, title, topics).
 * Opcionalmente filtra por palabras clave del mensaje.
 * @returns {{ contextText: string, catalog: Array<{ id: string, kind: string, title: string, topics: string[] }> }}
 */
export async function getChatContext(userMessage) {
  const keywords = (userMessage || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const whereProcessed = { inboxStatus: "processed" };

  const [notes, links, files, photos, audios, videos] = await Promise.all([
    prisma.note.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.link.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.file.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.photo.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.audio.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.video.findMany({ where: whereProcessed, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);

  let items = [
    ...notes.map((n) => ({ ...n, kind: "note", title: null, content: n.content })),
    ...links.map((l) => ({ ...l, kind: "link", content: null })),
    ...files.map((f) => ({ ...f, kind: "file", title: null, content: null })),
    ...photos.map((p) => ({ ...p, kind: "photo", title: null, content: null })),
    ...audios.map((a) => ({ ...a, kind: "audio", title: null, content: null })),
    ...videos.map((v) => ({ ...v, kind: "video", content: null })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);

  if (keywords.length > 0) {
    const lower = (s) => (s ?? "").toString().toLowerCase();
    const matchesKeyword = (item) => {
      const ai = parseAiEnrichment(item.aiEnrichment);
      const title = lower(ai?.title ?? item.title ?? item.filename ?? item.url);
      const summary = lower(ai?.summary ?? "");
      const content = lower(item.content ?? "");
      const text = `${title} ${summary} ${content}`;
      return keywords.some((k) => text.includes(k));
    };
    const filtered = items.filter(matchesKeyword);
    if (filtered.length > 0) items = filtered;
  }

  items = items.slice(0, MAX_CONTEXT_ITEMS);
  const contextText = items.map(toContextLine).join("\n\n");
  const catalog = items.map(toCatalogItem);
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
 * Responde con Gemini usando el contexto completo de la app (bóveda, calendario, temas, pendientes).
 * Devuelve { message }.
 */
export async function getRickyBrainReply(userMessage) {
  if (!geminiModel) throw new Error("GEMINI_API_KEY no configurada");

  const { vault, calendarText, topicsText, pendingText } = await getFullAppContext(userMessage);

  const systemDescription = `Eres Riki Brain, el asistente del Cerebro Digital. Tienes acceso al contexto completo de la aplicación del usuario:

1) BAÚL (contenido ya procesado): notas, enlaces, archivos, fotos, audios y vídeos con título y resumen.
2) CALENDARIO: eventos detectados automáticamente o añadidos por el usuario.
3) TEMAS: resúmenes agrupados por tema con cantidad de ítems.
4) FÁBRICA DE IDEAS: ítems pendientes de procesar (notas, enlaces, archivos, etc.).

Usa este contexto para responder: resume, busca, sugiere ("tienes una nota sobre X", "en tu calendario tienes...", "el tema Y agrupa..."). Si preguntan por algo que no está en el contexto, dilo con naturalidad. Responde en el mismo idioma que el usuario. Sé conciso y amigable.`;

  const contextBlock = `
--- CONTEXTO ACTUAL DE LA APP ---

**Baúl (últimos ítems procesados):**
${vault.contextText || "Ningún ítem procesado aún."}

**Calendario:**
${calendarText}

**Temas:**
${topicsText}

**Fábrica de ideas:**
${pendingText}
--- FIN CONTEXTO ---`;

  const promptFinal = `${systemDescription}
${contextBlock}

El usuario dice: "${userMessage}"

Responde ÚNICAMENTE con un JSON válido (nada más, sin markdown ni texto extra):
{"message": "Tu respuesta aquí"}`;

  const result = await geminiModel.generateContent(promptFinal);
  const response = result.response;
  if (!response?.text) throw new Error("Respuesta vacía de Gemini");

  const raw = response.text();
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
  return !!GEMINI_API_KEY;
}
