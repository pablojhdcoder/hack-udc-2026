/**
 * chat.js — Chat Ricky Brain conversacional (sin búsqueda RAG).
 *
 * POST /api/chat
 * Body:    { message?: string, messages?: Array<{ role, content }> }
 * Response: { message: string, reply: string }
 */

import { Router } from "express";
import { getRickyBrainReply, isChatEnabled } from "../services/chatService.js";

const router = Router();

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
    const { message: replyText } = await getRickyBrainReply(lastUserMessage);
    res.json({ reply: replyText, message: replyText });
  } catch (err) {
    console.error("[chat]", err);
    res.status(500).json({
      reply: err.message || "Error al generar la respuesta. Intenta de nuevo.",
      message: err.message || "Error al generar la respuesta. Intenta de nuevo.",
    });
  }
});

export default router;
