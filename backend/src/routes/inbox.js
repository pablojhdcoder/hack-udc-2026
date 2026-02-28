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
  enrichVideo,
} from "../services/aiService.js";

const router = Router();

// ──────────────────────────────────────────────
// Helpers de enriquecimiento asíncrono (fire-and-forget)
// El item se crea primero → respuesta al cliente → IA en background
// ──────────────────────────────────────────────

async function saveEnrichment(model, id, data, extraField = null) {
  const payload = { aiEnrichment: JSON.stringify(data) };
  if (extraField && data[extraField] != null) payload[extraField] = data[extraField];
  await model.update({ where: { id }, data: payload });
}

async function runNoteEnrichment(id, content) {
  try {
    const enrichment = await enrichNote(content);
    await saveEnrichment(prisma.note, id, enrichment);
  } catch (err) {
    console.error(`[AI] Error enriqueciendo nota ${id}:`, err.message);
    await saveEnrichment(prisma.note, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runLinkEnrichment(id, url, preview) {
  try {
    const enrichment = await enrichLink(url, preview);
    await saveEnrichment(prisma.link, id, enrichment);
  } catch (err) {
    console.error(`[AI] Error enriqueciendo link ${id}:`, err.message);
    await saveEnrichment(prisma.link, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runFileEnrichment(id, filePath, type, filename) {
  try {
    const enrichment = await enrichFile(filePath, type, filename);
    await saveEnrichment(prisma.file, id, enrichment);
    console.log("[AI] Fichero", id, "enriquecido correctamente.");
  } catch (err) {
    console.error(`[AI] Error enriqueciendo fichero ${id}:`, err.message);
    await saveEnrichment(prisma.file, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runVideoEnrichment(id, filename, type) {
  try {
    const enrichment = await enrichVideo(filename, type);
    await saveEnrichment(prisma.video, id, enrichment);
  } catch (err) {
    console.error(`[AI] Error enriqueciendo vídeo ${id}:`, err.message);
    await saveEnrichment(prisma.video, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runAudioEnrichment(id, filePath, type) {
  try {
    const enrichment = await enrichAudio(filePath, type);
    await saveEnrichment(prisma.audio, id, enrichment, "transcription");
  } catch (err) {
    console.error(`[AI] Error enriqueciendo audio ${id}:`, err.message);
    await saveEnrichment(prisma.audio, id, { error: err.message, enrichedAt: new Date().toISOString() }, "transcription");
  }
}

// ──────────────────────────────────────────────
// POST /api/inbox — JSON (content | url) o multipart (file)
// ──────────────────────────────────────────────

router.post("/", optionalMulter, async (req, res) => {
  try {
    const aiActive = isAIEnabled();
    if (req.file && !aiActive) {
      console.log("[AI] Desactivada: configura AZURE_OPENAI_ENDPOINT y AZURE_OPENAI_API_KEY en .env para enriquecimiento.");
    }

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
          console.log("[AI] Enriqueciendo audio", audio.id);
          runAudioEnrichment(audio.id, req.file.path, audio.type).catch((e) => console.error("[AI] Audio enrichment catch:", e.message));
        }

        return res.status(201).json({
          kind: "audio",
          id: audio.id,
          type: audio.type,
          filePath: audio.filePath,
          createdAt: audio.createdAt,
          inboxStatus: "pending",
          aiEnrichmentPending: aiActive,
        });
      }

      if (kind === "video") {
        const video = await prisma.video.create({
          data: {
            filePath: relativePath,
            type: type || "video",
            inboxStatus: "pending",
          },
        });

        if (aiActive) {
          console.log("[AI] Enriqueciendo vídeo", video.id);
          runVideoEnrichment(video.id, req.file.originalname, video.type).catch((e) => console.error("[AI] Video enrichment catch:", e.message));
        }

        return res.status(201).json({
          kind: "video",
          id: video.id,
          type: video.type,
          filePath: video.filePath,
          createdAt: video.createdAt,
          inboxStatus: "pending",
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
        console.log("[AI] Enriqueciendo fichero", file.id, file.filename);
        runFileEnrichment(file.id, req.file.path, file.type, file.filename).catch((e) => console.error("[AI] File enrichment catch:", e.message));
      }

      return res.status(201).json({
        kind: "file",
        id: file.id,
        type: file.type,
        filename: file.filename,
        filePath: file.filePath,
        fileType: file.type,
        createdAt: file.createdAt,
        inboxStatus: "pending",
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
        console.log("[AI] Enriqueciendo link", link.id);
        runLinkEnrichment(link.id, url, preview).catch((e) => console.error("[AI] Link enrichment catch:", e.message));
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
        inboxStatus: "pending",
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
      console.log("[AI] Enriqueciendo nota", note.id);
      runNoteEnrichment(note.id, note.content).catch((e) => console.error("[AI] Note enrichment catch:", e.message));
    }

    return res.status(201).json({
      kind: "note",
      id: note.id,
      type: note.type,
      content: note.content,
      createdAt: note.createdAt,
      inboxStatus: "pending",
      aiEnrichmentPending: aiActive,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/folders — Carpetas (tipos) con conteo desde la BD
// ──────────────────────────────────────────────

router.get("/folders", async (req, res) => {
  try {
    const [notesCount, linksCount, filesCount, audiosCount, videosCount] = await Promise.all([
      prisma.note.count(),
      prisma.link.count(),
      prisma.file.count(),
      prisma.audio.count(),
      prisma.video.count(),
    ]);
    const folders = [
      { kind: "note", name: "Notas", count: notesCount },
      { kind: "link", name: "Enlaces", count: linksCount },
      { kind: "file", name: "Archivos", count: filesCount },
      { kind: "audio", name: "Audio", count: audiosCount },
      { kind: "video", name: "Video", count: videosCount },
    ];
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/processed/recent — Últimos ítems procesados (mezcla por tipo para que aparezcan audios, etc.)
// ──────────────────────────────────────────────

function parseAI(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toItemTitle(item, kind) {
  if (kind === "note") return (item.content || "").slice(0, 50) || "Nota";
  if (kind === "link") return item.title || item.url?.slice(0, 40) || "Enlace";
  if (kind === "file") return item.filename || "Archivo";
  if (kind === "audio") return (parseAI(item.aiEnrichment)?.title) || "Nota de voz";
  if (kind === "video") return item.title || (parseAI(item.aiEnrichment)?.title) || "Vídeo";
  return "Ítem";
}

router.get("/processed/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const perKind = Math.max(1, Math.ceil(limit / 5));
    const [links, files, audios, notes, videos] = await Promise.all([
      prisma.link.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.file.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.audio.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.note.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.video.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
    ]);
    const unified = [
      ...notes.map((item) => ({ kind: "note", id: item.id, title: toItemTitle(item, "note"), processedPath: item.processedPath, createdAt: item.createdAt })),
      ...links.map((item) => ({ kind: "link", id: item.id, title: toItemTitle(item, "link"), processedPath: item.processedPath, createdAt: item.createdAt })),
      ...files.map((item) => ({ kind: "file", id: item.id, title: toItemTitle(item, "file"), processedPath: item.processedPath, createdAt: item.createdAt })),
      ...audios.map((item) => ({ kind: "audio", id: item.id, title: toItemTitle(item, "audio"), processedPath: item.processedPath, createdAt: item.createdAt })),
      ...videos.map((item) => ({ kind: "video", id: item.id, title: toItemTitle(item, "video"), processedPath: item.processedPath, createdAt: item.createdAt })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/by-kind/:kind — Todos los ítems de un tipo (pending + processed) para Tu Cerebro
// ──────────────────────────────────────────────

router.get("/by-kind/:kind", async (req, res) => {
  const { kind } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const items = await model.findMany({ orderBy: { createdAt: "desc" } });
    const list = items.map((item) => ({
      kind,
      id: item.id,
      title: toItemTitle(item, kind),
      inboxStatus: item.inboxStatus,
      processedPath: item.processedPath,
      createdAt: item.createdAt,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox — Listar entradas pendientes unificado
// ──────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const [links, files, audios, notes, videos] = await Promise.all([
      prisma.link.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.file.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.audio.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.note.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.video.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
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
      ...withKind(videos, "video"),
    ]
      .map((item) => {
        const base = {
          kind: item.kind,
          id: item.id,
          type: item.type,
          createdAt: item.createdAt,
          aiEnrichment: parseAI(item.aiEnrichment),
        };
        if (item.kind === "link") {
          let metadata = null;
          try {
            metadata = item.metadata ? JSON.parse(item.metadata) : null;
          } catch {}
          return { ...base, url: item.url, title: item.title, image: metadata?.image ?? null };
        }
        if (item.kind === "note") return { ...base, content: item.content };
        if (item.kind === "file")
          return { ...base, filename: item.filename, filePath: item.filePath, fileType: item.type };
        if (item.kind === "audio")
          return { ...base, filePath: item.filePath, durationSeconds: item.duration ?? 0 };
        if (item.kind === "video")
          return {
            ...base,
            filePath: item.filePath,
            title: item.title,
            durationSeconds: item.duration ?? 0,
          };
        return base;
      })
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
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, audio: prisma.audio, video: prisma.video };
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

// ──────────────────────────────────────────────
// DELETE /api/inbox/:kind/:id — Descartar/borrar un ítem del inbox
// ──────────────────────────────────────────────

router.delete("/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    await model.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "No encontrado" });
    res.status(500).json({ error: err.message });
  }
});

export default router;
