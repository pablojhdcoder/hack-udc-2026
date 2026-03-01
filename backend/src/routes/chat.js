/**
 * chat.js — Chat Ricky Brain. LLM extrae message + searchQuery; la búsqueda se hace con runVaultSearch.
 *
 * POST /api/chat
 * Body:    { message?: string, messages?: Array<{ role, content }> }
 * Response: { message: string, reply: string, searchQuery?: string | null, localResults?: Array<{ id, kind, title }> }
 */

import { Router } from "express";
import { getRickyBrainReply, isChatEnabled } from "../services/chatService.js";
import { runVaultSearch } from "../services/searchService.js";

const router = Router();

function toChatResultItem(item) {
  return {
    id: String(item.id),
    kind: item.kind || "note",
    title: String(item.title ?? item.aiTitle ?? item.filename ?? "Sin título"),
  };
}

router.post("/chat", async (req, res) => {
  if (!isChatEnabled()) {
    return res.status(503).json({
      reply: "Chat no disponible. Configura GEMINI_API_KEY en el servidor.",
      message: "Chat no disponible. Configura GEMINI_API_KEY en el servidor.",
    });
  }
  const body = req.body || {};
  const message = typeof body.message === "string" ? body.message.trim() : null;
  const messagesArray = Array.isArray(body.messages) ? body.messages : [];
  const lastUserMessage =
    message ||
    (messagesArray.length > 0
      ? messagesArray
          .filter((m) => m.role === "user" && (m.content || m.text))
          .map((m) => m.content || m.text)
          .pop()
      : null);

  if (!lastUserMessage) {
    return res.status(400).json({ reply: "Se requiere un mensaje.", message: "Se requiere un mensaje." });
  }
  try {
    const { message: replyText, searchQuery } = await getRickyBrainReply(lastUserMessage);

    let localResults = [];
    if (searchQuery && typeof searchQuery === "string") {
      const raw = searchQuery.trim();
      if (raw) {
        try {
          const hits = await runVaultSearch(raw);
          localResults = hits.map(toChatResultItem);
        } catch (searchErr) {
          console.error("[chat] runVaultSearch", searchErr);
        }
      }
    }

    res.json({
      reply: replyText,
      message: replyText,
      searchQuery: searchQuery ?? null,
      localResults,
    });
  } catch (err) {
    console.error("[chat]", err);
    res.status(500).json({
      reply: err.message || "Error al generar la respuesta. Intenta de nuevo.",
      message: err.message || "Error al generar la respuesta. Intenta de nuevo.",
    });
  }
});

export default router;
