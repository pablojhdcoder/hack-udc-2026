/**
 * chatService.js — Chat con contexto (RAG básico) para Ricky Brain / Cerebrito.
 * Recupera contexto de la bóveda (Prisma) y responde con Gemini.
 */

import prisma from "../lib/prisma.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) : null;

const MAX_CONTEXT_ITEMS = 15;

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
  const title = ai?.title ?? item.title ?? item.filename ?? item.url ?? "Sin título";
  const summary = ai?.summary ?? item.content?.slice(0, 200) ?? "";
  return `[${title}]\nResumen: ${summary}`.trim();
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
 * Responde con Gemini. El LLM solo extrae intención: mensaje conversacional y query de búsqueda (o null).
 * La búsqueda real se ejecuta en el backend con runVaultSearch y se devuelve como localResults.
 * Devuelve { message, searchQuery } (searchQuery es string o null).
 */
export async function getRickyBrainReply(userMessage) {
  if (!geminiModel) throw new Error("GEMINI_API_KEY no configurada");

  const promptFinal = `Eres Riki Brain, el asistente de Cerebro Digital.

TU SALIDA DEBE SER UN JSON ESTRICTO (nada más que el JSON):
{
  "message": "Tu respuesta conversacional",
  "searchQuery": "palabra clave o null"
}

REGLAS:
- "message": responde de forma natural. Si el usuario saluda o charla, responde amigable sin buscar archivos. Si pide buscar algo, escribe un mensaje corto tipo "Buscando tus notas sobre X...".
- "searchQuery": solo pon una palabra o frase de búsqueda (ej. "medicina", "GStreamer") cuando el usuario pida explícitamente buscar archivos/notas en su baúl. En saludos, preguntas genéricas o chit-chat, devuelve null.

EJEMPLOS:
Usuario: "Hola" -> {"message": "¡Hola! ¿En qué te ayudo?", "searchQuery": null}
Usuario: "¿Qué tal?" -> {"message": "Muy bien, gracias. ¿En qué puedo ayudarte hoy?", "searchQuery": null}
Usuario: "Pásame mis apuntes de medicina" -> {"message": "Buscando tus notas sobre medicina...", "searchQuery": "medicina"}
Usuario: "¿Tengo algo guardado sobre GStreamer?" -> {"message": "Buscando en tu baúl sobre GStreamer...", "searchQuery": "GStreamer"}

Pregunta del usuario: "${userMessage}"`;

  const result = await geminiModel.generateContent(promptFinal);
  const response = result.response;
  if (!response?.text) throw new Error("Respuesta vacía de Gemini");

  const raw = response.text();
  const jsonStr = extractJsonFromResponse(raw);
  try {
    const parsed = JSON.parse(jsonStr);
    const message = typeof parsed.message === "string" ? parsed.message.trim() : raw;
    let searchQuery =
      parsed.searchQuery === null || parsed.searchQuery === undefined
        ? null
        : typeof parsed.searchQuery === "string"
          ? parsed.searchQuery.trim() || null
          : null;
    if (searchQuery && searchQuery.toLowerCase() === "null") searchQuery = null;
    return { message, searchQuery };
  } catch {
    return { message: raw, searchQuery: null };
  }
}

export function isChatEnabled() {
  return !!GEMINI_API_KEY;
}
