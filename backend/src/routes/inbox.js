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
  // topic va a la columna topic; el resto del objeto solo a aiEnrichment (sin topic)
  const { topic, ...enrichmentOnly } = data;
  const payload = { aiEnrichment: JSON.stringify(enrichmentOnly) };
  if (extraField && data[extraField] != null) payload[extraField] = data[extraField];
  if (topic != null && String(topic).trim()) payload.topic = String(topic).trim().slice(0, 120);
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

async function runPhotoEnrichment(id, filePath, type, filename) {
  try {
    const enrichment = await enrichFile(filePath, type, filename);
    await saveEnrichment(prisma.photo, id, enrichment);
    console.log("[AI] Foto", id, "enriquecida correctamente.");
  } catch (err) {
    console.error(`[AI] Error enriqueciendo foto ${id}:`, err.message);
    await saveEnrichment(prisma.photo, id, { error: err.message, enrichedAt: new Date().toISOString() });
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

      if (kind === "photo") {
        const photo = await prisma.photo.create({
          data: {
            filePath: relativePath,
            type: type || "image",
            filename: req.file.originalname,
            size: req.file.size ?? null,
            inboxStatus: "pending",
          },
        });

        if (aiActive) {
          console.log("[AI] Enriqueciendo foto", photo.id);
          runPhotoEnrichment(photo.id, req.file.path, photo.type, photo.filename).catch((e) => console.error("[AI] Photo enrichment catch:", e.message));
        }

        return res.status(201).json({
          kind: "photo",
          id: photo.id,
          type: photo.type,
          filename: photo.filename,
          filePath: photo.filePath,
          fileType: photo.type,
          createdAt: photo.createdAt,
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
    const [notesCount, linksCount, filesCount, photosCount, audiosCount, videosCount, favoritesCount] = await Promise.all([
      prisma.note.count(),
      prisma.link.count(),
      prisma.file.count(),
      prisma.photo.count(),
      prisma.audio.count(),
      prisma.video.count(),
      prisma.favorite.count(),
    ]);

    const ITEM_KIND_MODELS = {
      note: prisma.note,
      link: prisma.link,
      file: prisma.file,
      photo: prisma.photo,
      audio: prisma.audio,
      video: prisma.video,
    };

    const getOpenedIds = async (kind) => {
      const rows = await prisma.viewState.findMany({
        where: { kind, openedCount: { gt: 0 } },
        select: { sourceId: true },
      });
      return rows.map((r) => r.sourceId);
    };

    const noveltyCountByKind = await Promise.all(
      Object.entries(ITEM_KIND_MODELS).map(async ([kind, model]) => {
        const openedIds = await getOpenedIds(kind);
        return model.count({
          where: {
            inboxStatus: "processed",
            ...(openedIds.length ? { id: { notIn: openedIds } } : {}),
          },
        });
      })
    );
    const noveltyCount = noveltyCountByKind.reduce((acc, n) => acc + (Number(n) || 0), 0);

    const folders = [
      { kind: "note", name: "Notas", count: notesCount },
      { kind: "link", name: "Enlaces", count: linksCount },
      { kind: "file", name: "Archivos", count: filesCount },
      { kind: "photo", name: "Fotos", count: photosCount },
      { kind: "audio", name: "Audio", count: audiosCount },
      { kind: "video", name: "Video", count: videosCount },
      { kind: "novelty", name: "Novedades", count: noveltyCount },
      { kind: "favorite", name: "Favoritos", count: favoritesCount },
    ];
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/inbox/opened — Marcar un ítem como abierto (para Novedades)
// ──────────────────────────────────────────────

router.post("/opened", async (req, res) => {
  const { kind, id } = req.body ?? {};
  const allowed = ["note", "link", "file", "photo", "audio", "video"];
  if (!allowed.includes(kind) || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "Se requiere { kind, id } válido" });
  }
  try {
    const now = new Date();
    const existing = await prisma.viewState.findUnique({
      where: { kind_sourceId: { kind, sourceId: id } },
    });
    if (!existing) {
      await prisma.viewState.create({
        data: { kind, sourceId: id, openedCount: 1, lastOpenedAt: now },
      });
    } else {
      await prisma.viewState.update({
        where: { kind_sourceId: { kind, sourceId: id } },
        data: { openedCount: { increment: 1 }, lastOpenedAt: now },
      });
    }
    return res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/novelties — Ítems procesados aún no abiertos (carpeta Novedades)
// ──────────────────────────────────────────────

router.get("/novelties", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const kinds = ["note", "link", "file", "photo", "audio", "video"];
    const perKind = Math.max(1, Math.ceil(limit / kinds.length));

    const modelMap = {
      link: prisma.link,
      note: prisma.note,
      file: prisma.file,
      photo: prisma.photo,
      audio: prisma.audio,
      video: prisma.video,
    };

    const openedByKind = await Promise.all(
      kinds.map(async (k) => {
        const rows = await prisma.viewState.findMany({
          where: { kind: k, openedCount: { gt: 0 } },
          select: { sourceId: true },
        });
        return [k, rows.map((r) => r.sourceId)];
      })
    );
    const openedIds = Object.fromEntries(openedByKind);

    const resultsByKind = await Promise.all(
      kinds.map(async (k) => {
        const model = modelMap[k];
        const ids = openedIds[k] ?? [];
        const items = await model.findMany({
          where: {
            inboxStatus: "processed",
            ...(ids.length ? { id: { notIn: ids } } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: perKind,
        });
        return items.map((item) => {
          const base = {
            kind: k,
            id: item.id,
            title: toItemTitle(item, k),
            inboxStatus: item.inboxStatus,
            processedPath: item.processedPath,
            createdAt: item.createdAt,
          };
          if (k === "link") return { ...base, url: item.url, type: item.type };
          if (k === "note") return { ...base, content: (item.content || "").slice(0, 200), type: item.type };
          if (k === "file" || k === "photo") return { ...base, filename: item.filename, type: item.type, filePath: item.filePath };
          if (k === "audio" || k === "video") return { ...base, type: item.type, filePath: item.filePath };
          return base;
        });
      })
    );

    const unified = resultsByKind
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    res.json(unified);
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
  if (kind === "photo") return item.filename || (parseAI(item.aiEnrichment)?.title) || "Foto";
  if (kind === "audio") return (parseAI(item.aiEnrichment)?.title) || "Nota de voz";
  if (kind === "video") return item.title || (parseAI(item.aiEnrichment)?.title) || "Vídeo";
  return "Ítem";
}

router.get("/processed/recent", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const perKind = Math.max(1, Math.ceil(limit / 6));
    const [links, files, photos, audios, notes, videos] = await Promise.all([
      prisma.link.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.file.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.photo.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.audio.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.note.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
      prisma.video.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: perKind }),
    ]);
    const unified = [
      ...notes.map((item) => ({ kind: "note", id: item.id, title: toItemTitle(item, "note"), processedPath: item.processedPath, createdAt: item.createdAt })),
      ...links.map((item) => ({ kind: "link", id: item.id, title: toItemTitle(item, "link"), url: item.url, processedPath: item.processedPath, createdAt: item.createdAt })),
      ...files.map((item) => ({ kind: "file", id: item.id, title: toItemTitle(item, "file"), filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt })),
      ...photos.map((item) => ({ kind: "photo", id: item.id, title: toItemTitle(item, "photo"), filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt })),
      ...audios.map((item) => ({ kind: "audio", id: item.id, title: toItemTitle(item, "audio"), filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt })),
      ...videos.map((item) => ({ kind: "video", id: item.id, title: toItemTitle(item, "video"), filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt })),
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
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const items = await model.findMany({ orderBy: { createdAt: "desc" } });
    const list = items.map((item) => {
      const base = {
        kind,
        id: item.id,
        title: toItemTitle(item, kind),
        inboxStatus: item.inboxStatus,
        processedPath: item.processedPath,
        createdAt: item.createdAt,
      };
      if (kind === "file") return { ...base, filename: item.filename, type: item.type, filePath: item.filePath };
      if (kind === "photo") return { ...base, filename: item.filename, type: item.type, filePath: item.filePath };
      if (kind === "link") return { ...base, url: item.url, type: item.type };
      if (kind === "note") return { ...base, content: (item.content || "").slice(0, 200), type: item.type };
      if (kind === "audio") return { ...base, type: item.type, filePath: item.filePath };
      if (kind === "video") return { ...base, type: item.type, filePath: item.filePath };
      return base;
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// Favoritos (rutas antes de /:kind/:id para que no coincidan)
// ──────────────────────────────────────────────

function copyToFavorite(item, kind) {
  const title = toItemTitle(item, kind);
  return {
    kind,
    sourceId: item.id,
    title: title || null,
    content: kind === "note" ? item.content : null,
    url: kind === "link" ? item.url : null,
    filename: (kind === "file" || kind === "photo") ? item.filename : null,
    filePath: item.filePath ?? null,
    type: item.type ?? null,
    size: item.size ?? null,
    duration: item.duration ?? null,
    transcription: item.transcription ?? null,
    metadata: item.metadata ?? null,
    topic: item.topic ?? null,
    aiEnrichment: item.aiEnrichment ?? null,
    inboxStatus: item.inboxStatus ?? null,
    processedPath: item.processedPath ?? null,
  };
}

router.get("/favorites", async (req, res) => {
  try {
    const list = await prisma.favorite.findMany({ orderBy: { createdAt: "desc" } });
    res.json(
      list.map((f) => ({
        kind: "favorite",
        id: f.id,
        sourceKind: f.kind,
        sourceId: f.sourceId,
        title: f.title ?? f.filename ?? f.url?.slice(0, 40) ?? "Favorito",
        filename: f.filename,
        filePath: f.filePath,
        url: f.url,
        content: f.content,
        type: f.type,
        inboxStatus: f.inboxStatus,
        processedPath: f.processedPath,
        createdAt: f.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/favorites/check", async (req, res) => {
  const kind = req.query.kind;
  const id = req.query.id;
  if (!kind || !id) return res.status(400).json({ error: "Faltan kind e id" });
  try {
    const fav = await prisma.favorite.findUnique({ where: { kind_sourceId: { kind, sourceId: id } } });
    res.json({ favorited: !!fav, favoriteId: fav?.id ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/favorites", async (req, res) => {
  const { kind, id: sourceId } = req.body;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model || !sourceId) return res.status(400).json({ error: "Se requiere kind e id del ítem" });

  try {
    const item = await model.findUnique({ where: { id: sourceId } });
    if (!item) return res.status(404).json({ error: "Ítem no encontrado" });

    const data = copyToFavorite(item, kind);
    const fav = await prisma.favorite.upsert({
      where: { kind_sourceId: { kind, sourceId } },
      create: data,
      update: data,
    });
    return res.status(201).json({
      id: fav.id,
      kind: "favorite",
      sourceKind: fav.kind,
      sourceId: fav.sourceId,
      title: fav.title ?? fav.filename ?? fav.url?.slice(0, 40) ?? "Favorito",
      createdAt: fav.createdAt,
    });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Ítem no encontrado" });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/favorites/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.favorite.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "No encontrado" });
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox — Listar entradas pendientes unificado
// ──────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const [links, files, photos, audios, notes, videos] = await Promise.all([
      prisma.link.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.file.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
      prisma.photo.findMany({ where: { inboxStatus: "pending" }, orderBy: { createdAt: "desc" } }),
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
      ...withKind(photos, "photo"),
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
        if (item.kind === "photo")
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
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
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
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    await model.delete({ where: { id } });
    await prisma.viewState.deleteMany({ where: { kind, sourceId: id } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "No encontrado" });
    res.status(500).json({ error: err.message });
  }
});

export default router;
