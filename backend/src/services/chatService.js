/**
 * chatService.js — Chat con contexto (RAG básico) para Ricky Brain / Cerebrito.
 * Recupera contexto de la bóveda (Prisma) y responde con Gemini.
 */

import prisma from "../lib/prisma.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

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

/**
 * Recupera contexto de la bóveda: últimos 15 ítems procesados.
 * Opcionalmente filtra por palabras clave del mensaje (búsqueda simple en title/content/aiSummary).
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
  const lines = items.map(toContextLine);
  return lines.join("\n\n");
}

/**
 * Responde con Gemini usando el contexto de la bóveda (RAG).
 */
export async function getRickyBrainReply(userMessage, contextFromDb) {
  if (!geminiModel) throw new Error("GEMINI_API_KEY no configurada");

  const contextoDePrismaFormateado =
    (contextFromDb && contextFromDb.trim()) || "(No hay notas o archivos procesados aún en tu bóveda.)";

  const promptFinal = `Eres Ricky Brain (Cerebrito), el asistente personal inteligente de la app Cerebro Digital.
Tu objetivo es responder a la pregunta del usuario basándote ESTRICTAMENTE en este contexto de sus notas y archivos guardados:

--- CONTEXTO DE LA BÓVEDA ---
${contextoDePrismaFormateado}
-----------------------------

Reglas:
1. Si la respuesta está en el contexto, respóndela de forma conversacional, clara y concisa.
2. Eres amigable.
3. Si la pregunta NO se puede responder con el contexto proporcionado, dile al usuario amablemente que no tienes esa información en sus archivos actuales. No inventes datos.

Pregunta del usuario: "${userMessage}"`;

  const result = await geminiModel.generateContent(promptFinal);
  const response = result.response;
  if (!response?.text) throw new Error("Respuesta vacía de Gemini");
  return response.text();
}

export function isChatEnabled() {
  return !!GEMINI_API_KEY;
}
