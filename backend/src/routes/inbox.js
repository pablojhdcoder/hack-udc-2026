import { Router } from "express";
import path from "path";
import prisma from "../lib/prisma.js";
import { classifyInput, classifyFile } from "../services/classifyService.js";
import { getLinkPreview } from "../services/linkPreviewService.js";
import { optionalMulter } from "../middleware/upload.js";
import {
  isAIEnabled,
  enrichNote,
  enrichLink,
  enrichFile,
  enrichAudio,
} from "../services/aiService.js";

const router = Router();

// ──────────────────────────────────────────────
// Helpers de enriquecimiento asíncrono (fire-and-forget)
// El item se crea primero → respuesta al cliente → IA en background
// ──────────────────────────────────────────────

async function runNoteEnrichment(id, content) {
  try {
    const enrichment = await enrichNote(content);
    await prisma.note.update({
      where: { id },
      data: { aiEnrichment: JSON.stringify(enrichment) },
    });
  } catch (err) {
    console.error(`[AI] Error enriqueciendo nota ${id}:`, err.message);
  }
}

async function runLinkEnrichment(id, url, preview) {
  try {
    const enrichment = await enrichLink(url, preview);
    await prisma.link.update({
      where: { id },
      data: { aiEnrichment: JSON.stringify(enrichment) },
    });
  } catch (err) {
    console.error(`[AI] Error enriqueciendo link ${id}:`, err.message);
  }
}

async function runFileEnrichment(id, filePath, type, filename) {
  try {
    const enrichment = await enrichFile(filePath, type, filename);
    await prisma.file.update({
      where: { id },
      data: { aiEnrichment: JSON.stringify(enrichment) },
    });
  } catch (err) {
    console.error(`[AI] Error enriqueciendo fichero ${id}:`, err.message);
  }
}

async function runAudioEnrichment(id, filePath, type) {
  try {
    const enrichment = await enrichAudio(filePath, type);
    const updateData = { aiEnrichment: JSON.stringify(enrichment) };
    if (enrichment.transcription) {
      updateData.transcription = enrichment.transcription;
    }
    await prisma.audio.update({ where: { id }, data: updateData });
  } catch (err) {
    console.error(`[AI] Error enriqueciendo audio ${id}:`, err.message);
  }
}

// ──────────────────────────────────────────────
// POST /api/inbox — JSON (content | url) o multipart (file)
// ──────────────────────────────────────────────

router.post("/", optionalMulter, async (req, res) => {
  try {
    const aiActive = isAIEnabled();

    // ── Multipart: fichero subido ──
    if (req.file) {
      const { kind, type } = classifyFile(req.file.originalname);
      const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");

      if (kind === "audio") {
        const audio = await prisma.audio.create({
          data: {
            filePath: relativePath,
            type: type || "audio",
            inboxStatus: "pending",
          },
        });

        if (aiActive) {
          runAudioEnrichment(audio.id, relativePath, audio.type).catch(() => {});
        }

        return res.status(201).json({
          kind: "audio",
          id: audio.id,
          type: audio.type,
          filePath: audio.filePath,
          createdAt: audio.createdAt,
          aiEnrichmentPending: aiActive,
        });
      }

      const file = await prisma.file.create({
        data: {
          filePath: relativePath,
          type: type || "unknown",
          filename: req.file.originalname,
          size: req.file.size ?? null,
          inboxStatus: "pending",
        },
      });

      if (aiActive) {
        runFileEnrichment(file.id, relativePath, file.type, file.filename).catch(() => {});
      }

      return res.status(201).json({
        kind: "file",
        id: file.id,
        type: file.type,
        filename: file.filename,
        filePath: file.filePath,
        createdAt: file.createdAt,
        aiEnrichmentPending: aiActive,
      });
    }

    // ── JSON: content o url ──
    const body = req.body || {};
    const raw = body.url ?? body.content;
    if (raw == null || typeof raw !== "string") {
      return res.status(400).json({
        error:
          "Se requiere 'content' o 'url' en el body (JSON), o un fichero en multipart (campo 'file').",
      });
    }

    const { kind, type } = classifyInput(raw.trim());

    if (kind === "link") {
      const url = raw.trim();
      const link = await prisma.link.create({
        data: {
          url,
          type,
          title: body.title ?? null,
          metadata: null,
          inboxStatus: "pending",
        },
      });

      let preview = {};
      try {
        preview = await getLinkPreview(url);
      } catch {
        // preview falla silenciosamente
      }

      const hasPreview = Object.keys(preview).length > 0;
      if (hasPreview) {
        await prisma.link.update({
          where: { id: link.id },
          data: { metadata: JSON.stringify(preview) },
        });
      }

      if (aiActive) {
        runLinkEnrichment(link.id, url, preview).catch(() => {});
      }

      const final = hasPreview
        ? await prisma.link.findUnique({ where: { id: link.id } })
        : link;

      return res.status(201).json({
        kind: "link",
        id: final.id,
        type: final.type,
        url: final.url,
        title: final.title ?? preview.title ?? null,
        metadata: final.metadata ? JSON.parse(final.metadata) : undefined,
        createdAt: final.createdAt,
        aiEnrichmentPending: aiActive,
      });
    }

    // ── Nota ──
    const note = await prisma.note.create({
      data: {
        content: raw.trim(),
        type,
        inboxStatus: "pending",
      },
    });

    if (aiActive) {
      runNoteEnrichment(note.id, note.content).catch(() => {});
    }

    return res.status(201).json({
      kind: "note",
      id: note.id,
      type: note.type,
      content: note.content,
      createdAt: note.createdAt,
      aiEnrichmentPending: aiActive,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox — Listar entradas pendientes unificado
// ──────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const [links, files, audios, notes] = await Promise.all([
      prisma.link.findMany({
        where: { inboxStatus: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.file.findMany({
        where: { inboxStatus: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.audio.findMany({
        where: { inboxStatus: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.note.findMany({
        where: { inboxStatus: "pending" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const withKind = (items, kind) => items.map((item) => ({ ...item, kind }));

    const parseAI = (raw) => {
      if (!raw || typeof raw !== "string") return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const unified = [
      ...withKind(links, "link"),
      ...withKind(files, "file"),
      ...withKind(audios, "audio"),
      ...withKind(notes, "note"),
    ]
      .map((item) => ({
        kind: item.kind,
        id: item.id,
        type: item.type,
        createdAt: item.createdAt,
        aiEnrichment: parseAI(item.aiEnrichment),
        ...(item.kind === "link" && { url: item.url, title: item.title }),
        ...(item.kind === "note" && { content: item.content }),
        ...(item.kind === "file" && { filename: item.filename, filePath: item.filePath }),
        ...(item.kind === "audio" && { filePath: item.filePath }),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/:kind/:id — Detalle de un item (incluye aiEnrichment)
// ──────────────────────────────────────────────

router.get("/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, audio: prisma.audio };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const item = await model.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "No encontrado" });

    let aiEnrichment = null;
    if (item.aiEnrichment && typeof item.aiEnrichment === "string") {
      try {
        aiEnrichment = JSON.parse(item.aiEnrichment);
      } catch {
        aiEnrichment = null;
      }
    }

    return res.json({
      ...item,
      aiEnrichment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
