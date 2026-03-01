import { Router } from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import prisma from "../lib/prisma.js";
import { classifyInput, classifyFile, analyzeTextContent } from "../services/classifyService.js";
import { getLinkPreview } from "../services/linkPreviewService.js";
import { optionalMulter } from "../middleware/upload.js";
import {
  isAIEnabled,
  enrichNote,
  enrichLink,
  enrichFile,
  enrichAudio,
  enrichVideo,
  detectCalendarEvents,
} from "../services/aiService.js";
import { parseFile as parseAudioMetadata } from "music-metadata";
import { extractFileContent } from "../services/fileExtractService.js";

/**
 * Genera un thumbnail JPG del primer fotograma de un vídeo usando ffmpeg.
 * @param {string} videoPath - ruta absoluta al vídeo
 * @param {string} thumbPath - ruta absoluta donde guardar el thumbnail
 * @returns {Promise<boolean>} true si se generó correctamente
 */
function generateVideoThumbnail(videoPath, thumbPath) {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-ss", "00:00:01",
      "-vframes", "1",
      "-vf", "scale=320:-1",
      "-q:v", "5",
      thumbPath,
    ]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

async function getAudioDurationSeconds(filePath) {
  try {
    const metadata = await parseAudioMetadata(filePath);
    return metadata.format.duration ? Math.round(metadata.format.duration) : null;
  } catch {
    return null;
  }
}

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

async function saveCalendarEvents(events, sourceKind, sourceId) {
  if (!events || events.length === 0) return;
  if (!prisma.calendarEvent) {
    console.warn("[AI] Calendario no disponible (prisma.calendarEvent). Ejecuta: npx prisma generate && npx prisma db push");
    return;
  }
  for (const ev of events) {
    if (!ev.title || !ev.date) continue;
    try {
      await prisma.calendarEvent.create({
        data: {
          title: String(ev.title).slice(0, 200),
          date: String(ev.date).slice(0, 10),
          time: ev.time ? String(ev.time).slice(0, 10) : null,
          description: ev.description ? String(ev.description).slice(0, 500) : null,
          sourceKind,
          sourceId,
        },
      });
      console.log(`[AI] Evento de calendario creado: "${ev.title}" (${ev.date})`);
    } catch (err) {
      console.warn("[AI] No se pudo guardar evento de calendario:", err.message);
    }
  }
}

async function runNoteEnrichment(id, content) {
  try {
    const [enrichment, events] = await Promise.all([
      enrichNote(content),
      detectCalendarEvents(content),
    ]);
    await saveEnrichment(prisma.note, id, enrichment);
    await saveCalendarEvents(events, "note", id);
  } catch (err) {
    console.error(`[AI] Error enriqueciendo nota ${id}:`, err.message);
    await saveEnrichment(prisma.note, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runLinkEnrichment(id, url, preview) {
  try {
    const enrichment = await enrichLink(url, preview);
    await saveEnrichment(prisma.link, id, enrichment);
    // Detectar eventos en el título + descripción + markdown del enlace (Firecrawl)
    const linkText = [url, preview?.title, preview?.description, preview?.markdown?.slice(0, 3000)].filter(Boolean).join("\n");
    const events = await detectCalendarEvents(linkText);
    await saveCalendarEvents(events, "link", id);
  } catch (err) {
    console.error(`[AI] Error enriqueciendo link ${id}:`, err.message);
    await saveEnrichment(prisma.link, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runFileEnrichment(id, filePath, type, filename) {
  try {
    const absolutePath = filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
    const [enrichment, extracted] = await Promise.all([
      enrichFile(filePath, type, filename),
      extractFileContent(absolutePath, type),
    ]);
    await saveEnrichment(prisma.file, id, enrichment);
    console.log("[AI] Fichero", id, "enriquecido correctamente.");
    // Detectar eventos de calendario en el texto extraído del fichero
    if (extracted?.text) {
      const events = await detectCalendarEvents(extracted.text, { maxChars: 5000 });
      await saveCalendarEvents(events, "file", id);
    }
  } catch (err) {
    console.error(`[AI] Error enriqueciendo fichero ${id}:`, err.message);
    await saveEnrichment(prisma.file, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runPhotoEnrichment(id, filePath, type, filename) {
  try {
    const absolutePath = filePath.startsWith("/") ? filePath : path.resolve(process.cwd(), filePath);
    const [enrichment, extracted] = await Promise.all([
      enrichFile(filePath, type, filename),
      extractFileContent(absolutePath, type),
    ]);
    await saveEnrichment(prisma.photo, id, enrichment);
    console.log("[AI] Foto", id, "enriquecida correctamente.");
    if (extracted?.text) {
      const events = await detectCalendarEvents(extracted.text, { maxChars: 5000 });
      await saveCalendarEvents(events, "photo", id);
    }
  } catch (err) {
    console.error(`[AI] Error enriqueciendo foto ${id}:`, err.message);
    await saveEnrichment(prisma.photo, id, { error: err.message, enrichedAt: new Date().toISOString() });
  }
}

async function runVideoEnrichment(id, filePath, filename, type) {
  try {
    const enrichment = await enrichVideo(filePath, filename, type);
    await saveEnrichment(prisma.video, id, enrichment, "transcription");
    console.log(`[AI] Vídeo ${id} enriquecido correctamente.`);
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
      console.log("[AI] Desactivada: configura GEMINI_API_KEY en .env para enriquecimiento.");
    }

    // ── Multipart: fichero subido ──
    if (req.file) {
      let { kind, type } = classifyFile(req.file.originalname, req.file?.mimetype);
      const allowedFileKinds = ["audio", "video", "photo", "file"];
      if (!allowedFileKinds.includes(kind)) {
        kind = "file";
        type = type || "unknown";
      }
      type = type || (kind === "photo" ? "image" : kind === "file" ? "unknown" : kind);
      const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");

      if (kind === "audio") {
        const audioDuration = await getAudioDurationSeconds(req.file.path);
        const originalFilename = req.file.originalname;
        let audio;
        try {
          audio = await prisma.audio.create({
            data: {
              filePath: relativePath,
              filename: originalFilename,
              type: type || "audio",
              duration: audioDuration,
              inboxStatus: "pending",
            },
          });
        } catch {
          // Fallback: Prisma client may not have filename field yet (needs prisma generate after restart)
          audio = await prisma.audio.create({
            data: {
              filePath: relativePath,
              type: type || "audio",
              duration: audioDuration,
              inboxStatus: "pending",
            },
          });
          // Update filename via raw SQL to bypass stale Prisma client
          await prisma.$executeRawUnsafe(
            `UPDATE "Audio" SET "filename" = ? WHERE "id" = ?`,
            originalFilename,
            audio.id
          );
        }

        if (aiActive) {
          console.log("[AI] Enriqueciendo audio", audio.id);
          runAudioEnrichment(audio.id, req.file.path, audio.type).catch((e) => console.error("[AI] Audio enrichment catch:", e.message));
        }

        return res.status(201).json({
          kind: "audio",
          id: audio.id,
          type: audio.type,
          filename: originalFilename,
          filePath: audio.filePath,
          durationSeconds: audioDuration ?? 0,
          createdAt: audio.createdAt,
          inboxStatus: "pending",
          aiEnrichmentPending: aiActive,
        });
      }

      if (kind === "video") {
        const originalFilename = req.file.originalname;
        const video = await prisma.video.create({
          data: {
            filePath: relativePath,
            type: type || "video",
            inboxStatus: "pending",
          },
        });

        // Generar thumbnail con ffmpeg
        const uploadsDir = path.dirname(req.file.path);
        const thumbFilename = `thumb_${video.id}.jpg`;
        const thumbAbsPath = path.join(uploadsDir, thumbFilename);
        const thumbGenerated = await generateVideoThumbnail(req.file.path, thumbAbsPath);
        const thumbnailUrl = thumbGenerated ? `/api/uploads/${thumbFilename}` : null;

        if (aiActive) {
          console.log("[AI] Enriqueciendo vídeo", video.id);
          runVideoEnrichment(video.id, req.file.path, originalFilename, video.type).catch((e) => console.error("[AI] Video enrichment catch:", e.message));
        }

        return res.status(201).json({
          kind: "video",
          id: video.id,
          type: video.type,
          filename: originalFilename,
          filePath: video.filePath,
          thumbnailUrl,
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

      // ── Análisis inteligente de ficheros de texto plano (.txt, .md) ──
      // Detecta si el contenido son links de YouTube, listas u otro texto
      // y re-enruta la entidad al tipo semántico correcto.
      if (type === "text" || type === "markdown" || type === "txt" || type === "md") {
        let rawText = null;
        try {
          rawText = fs.readFileSync(req.file.path, "utf-8");
        } catch {
          // Si no se puede leer, continúa como fichero normal
        }

        if (rawText) {
          const analysis = analyzeTextContent(rawText);
          console.log(`[Inbox] Análisis de texto "${req.file.originalname}": ${analysis.dominantPattern}`);

          // ── Caso: fichero con links (YouTube o genéricos) → un Link por URL ──
          if (analysis.contentType === "youtube-links" || analysis.contentType === "url-links") {
            const sourceGroup = req.file.originalname; // identificador de grupo

            // Paso 1: crear todos los links en BD
            const createdItems = [];
            for (const { url, label } of analysis.urlEntries) {
              const urlType = /youtube\.com|youtu\.be/i.test(url) ? "youtube" : "generic";
              const link = await prisma.link.create({
                data: {
                  url,
                  type: urlType,
                  title: label || null,
                  inboxStatus: "pending",
                },
              });
              createdItems.push({ kind: "link", id: link.id, url, type: urlType, label });
            }

            // Paso 2: enriquecer y vincular cada link con los demás del mismo grupo
            for (const item of createdItems) {
              const relatedLinks = createdItems
                .filter((r) => r.id !== item.id)
                .map((r) => ({ id: r.id, url: r.url, label: r.label }));

              let preview = {};
              try { preview = await getLinkPreview(item.url); } catch { /* silencioso */ }

              // Guardar preview + metadatos de grupo en metadata
              const metadata = {
                ...preview,
                sourceGroup,
                relatedLinks,
              };
              await prisma.link.update({
                where: { id: item.id },
                data: { metadata: JSON.stringify(metadata) },
              });

              if (aiActive) {
                runLinkEnrichment(item.id, item.url, metadata).catch((e) => console.error("[AI] Link enrichment catch:", e.message));
              }
            }

            console.log(`[Inbox] Creados ${createdItems.length} links relacionados desde "${req.file.originalname}"`);
            return res.status(201).json({
              kind: "text-as-links",
              sourceFilename: req.file.originalname,
              contentType: analysis.contentType,
              items: createdItems,
              aiEnrichmentPending: aiActive,
            });
          }

          // ── Caso: texto plano (incluye listas) → guardar como nota sin transformar ──
          if (analysis.contentType === "plain-text") {
            const note = await prisma.note.create({
              data: {
                content: rawText.slice(0, 10000),
                type: "note",
                inboxStatus: "pending",
              },
            });

            if (aiActive) {
              runNoteEnrichment(note.id, note.content).catch((e) => console.error("[AI] Note enrichment catch:", e.message));
            }

            return res.status(201).json({
              kind: "note",
              id: note.id,
              type: note.type,
              content: note.content,
              sourceFilename: req.file.originalname,
              createdAt: note.createdAt,
              inboxStatus: "pending",
              aiEnrichmentPending: aiActive,
            });
          }
        }
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

    let { kind, type } = classifyInput(raw.trim());
    if (kind !== "link" && kind !== "note") {
      kind = "note";
      type = type || "note";
    }
    type = type || (kind === "link" ? "generic" : "note");

    if (kind === "link") {
      let url = raw.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
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
        const toUploadUrl = (fp) => (fp ? `/api/uploads/${path.basename(String(fp).replace(/\\/g, "/"))}` : null);
        const normalizeAIEnrichment = (raw) => {
          const ai = parseAI(raw);
          const topics = Array.isArray(ai?.topics) ? ai.topics : [];
          return { aiTitle: ai?.title ?? null, aiSummary: ai?.summary ?? null, aiLanguage: ai?.language ?? null, aiCategory: ai?.category ?? null, aiTopics: topics, aiTags: topics };
        };
        return items.map((item) => {
          const ai = normalizeAIEnrichment(item.aiEnrichment);
          const base = {
            kind: k,
            id: item.id,
            title: toItemTitle(item, k),
            inboxStatus: item.inboxStatus,
            processedPath: item.processedPath,
            createdAt: item.createdAt,
            ...ai,
          };
          if (k === "link") return { ...base, url: item.url, type: item.type };
          if (k === "note") return { ...base, content: (item.content || "").slice(0, 200), filename: (item.content || "").slice(0, 80) || "Nota", type: item.type };
          if (k === "file") {
            const filePath = item.filePath;
            const thumbnailUrl = (item.type === "image" || item.type === "photo") ? toUploadUrl(filePath) : null;
            return { ...base, filename: item.filename, type: item.type, filePath, thumbnailUrl };
          }
          if (k === "photo") {
            const filePath = item.filePath;
            const thumbnailUrl = toUploadUrl(filePath);
            return { ...base, filename: item.filename, type: item.type, filePath, thumbnailUrl };
          }
          if (k === "audio") return { ...base, filename: item.filename || ai.aiTitle || path.basename(item.filePath || "") || "Audio", type: item.type, filePath: item.filePath, durationSeconds: item.duration ?? 0 };
          if (k === "video") {
            const thumbFile = `thumb_${item.id}.jpg`;
            const thumbExists = fs.existsSync(path.join(process.cwd(), "uploads", thumbFile));
            const thumbnailUrl = thumbExists ? `/api/uploads/${thumbFile}` : null;
            return { ...base, filename: item.title || ai.aiTitle || path.basename(item.filePath || "") || "Vídeo", type: item.type, filePath: item.filePath, thumbnailUrl };
          }
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
// GET /api/inbox/wrapped/weekly — Ítems más abiertos en la última semana (tipo Wrapped)
// ──────────────────────────────────────────────

router.get("/wrapped/weekly", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 15, 50);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const views = await prisma.viewState.findMany({
      where: { lastOpenedAt: { gte: since } },
      orderBy: [{ openedCount: "desc" }, { lastOpenedAt: "desc" }],
      take: limit * 3,
    });

    if (!views.length) return res.json([]);

    const kinds = ["note", "link", "file", "photo", "audio", "video"];
    const modelMap = {
      link: prisma.link,
      note: prisma.note,
      file: prisma.file,
      photo: prisma.photo,
      audio: prisma.audio,
      video: prisma.video,
    };

    const idsByKind = kinds.reduce((acc, k) => {
      acc[k] = views.filter((v) => v.kind === k).map((v) => v.sourceId);
      return acc;
    }, {});

    const entitiesByKind = {};
    for (const k of kinds) {
      const ids = idsByKind[k];
      if (!ids || !ids.length) continue;
      const rows = await modelMap[k].findMany({
        where: { id: { in: ids } },
      });
      entitiesByKind[k] = rows.reduce((map, row) => {
        map[row.id] = row;
        return map;
      }, {});
    }

    const normalizeAIEnrichment = (raw) => {
      const ai = parseAI(raw);
      const topics = Array.isArray(ai?.topics) ? ai.topics : [];
      return { aiTitle: ai?.title ?? null, aiSummary: ai?.summary ?? null, aiLanguage: ai?.language ?? null, aiCategory: ai?.category ?? null, aiTopics: topics, aiTags: topics };
    };

    const unified = [];
    for (const v of views) {
      if (!modelMap[v.kind]) continue;
      const entity = entitiesByKind[v.kind]?.[v.sourceId];
      if (!entity) continue;
      if (entity.inboxStatus !== "processed") continue;

      const ai = normalizeAIEnrichment(entity.aiEnrichment);
      const base = {
        kind: v.kind,
        id: v.sourceId,
        title: toItemTitle(entity, v.kind),
        inboxStatus: entity.inboxStatus,
        processedPath: entity.processedPath,
        createdAt: entity.createdAt,
        openedCount: v.openedCount,
        lastOpenedAt: v.lastOpenedAt,
        ...ai,
      };
      if (v.kind === "link") {
        unified.push({ ...base, url: entity.url, type: entity.type });
      } else if (v.kind === "note") {
        unified.push({ ...base, content: (entity.content || "").slice(0, 200), filename: (entity.content || "").slice(0, 80) || "Nota", type: entity.type });
      } else if (v.kind === "file" || v.kind === "photo") {
        unified.push({
          ...base,
          filename: entity.filename,
          type: entity.type,
          filePath: entity.filePath,
        });
      } else if (v.kind === "audio" || v.kind === "video") {
        const filenameAudio = v.kind === "audio" ? (entity.filename || ai.aiTitle || path.basename(entity.filePath || "") || "Audio") : (entity.title || ai.aiTitle || path.basename(entity.filePath || "") || "Vídeo");
        unified.push({
          ...base,
          filename: filenameAudio,
          title: entity.title ?? null,
          type: entity.type,
          filePath: entity.filePath,
          durationSeconds: entity.duration ?? 0,
        });
      } else {
        unified.push(base);
      }
      if (unified.length >= limit) break;
    }

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
    const normalizeAIEnrichment = (raw) => {
      const ai = parseAI(raw);
      const topics = Array.isArray(ai?.topics) ? ai.topics : [];
      const suggestedTasks = Array.isArray(ai?.suggestedTasks) ? ai.suggestedTasks : [];
      return {
        aiTitle:    ai?.title    ?? null,
        aiSummary:  ai?.summary  ?? null,
        aiLanguage: ai?.language ?? null,
        aiCategory: ai?.category ?? null,
        aiTopics:   topics,
        aiTags:     topics,
        suggestedTasks,
      };
    };
    const unified = [
      ...notes.map((item) => ({ kind: "note", id: item.id, title: toItemTitle(item, "note"), content: (item.content || "").slice(0, 200), filename: (item.content || "").slice(0, 80) || "Nota", processedPath: item.processedPath, createdAt: item.createdAt, ...normalizeAIEnrichment(item.aiEnrichment) })),
      ...links.map((item) => ({ kind: "link", id: item.id, title: toItemTitle(item, "link"), filename: item.title || item.url?.slice(0, 50) || "Enlace", url: item.url, processedPath: item.processedPath, createdAt: item.createdAt, ...normalizeAIEnrichment(item.aiEnrichment) })),
      ...files.map((item) => ({ kind: "file", id: item.id, title: toItemTitle(item, "file"), filename: item.filename, filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt, ...normalizeAIEnrichment(item.aiEnrichment) })),
      ...photos.map((item) => ({ kind: "photo", id: item.id, title: toItemTitle(item, "photo"), filename: item.filename, filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt, ...normalizeAIEnrichment(item.aiEnrichment) })),
      ...audios.map((item) => ({ kind: "audio", id: item.id, title: toItemTitle(item, "audio"), filename: item.filename || parseAI(item.aiEnrichment)?.title || path.basename(item.filePath || "") || "Audio", filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt, durationSeconds: item.duration ?? 0, transcription: item.transcription ?? null, ...normalizeAIEnrichment(item.aiEnrichment) })),
      ...videos.map((item) => { const thumbFile = `thumb_${item.id}.jpg`; const thumbExists = fs.existsSync(path.join(process.cwd(), "uploads", thumbFile)); return { kind: "video", id: item.id, title: toItemTitle(item, "video"), filename: item.title || parseAI(item.aiEnrichment)?.title || path.basename(item.filePath || "") || "Vídeo", filePath: item.filePath, processedPath: item.processedPath, createdAt: item.createdAt, transcription: item.transcription ?? null, thumbnailUrl: thumbExists ? `/api/uploads/${thumbFile}` : null, ...normalizeAIEnrichment(item.aiEnrichment) }; }),
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
    const normalizeAIEnrichment = (raw) => {
      const ai = parseAI(raw);
      const topics = Array.isArray(ai?.topics) ? ai.topics : [];
      return {
        aiTitle:    ai?.title    ?? null,
        aiSummary:  ai?.summary  ?? null,
        aiLanguage: ai?.language ?? null,
        aiCategory: ai?.category ?? null,
        aiTopics:   topics,
        aiTags:     topics,
      };
    };
    const list = items.map((item) => {
      const ai = normalizeAIEnrichment(item.aiEnrichment);
      const base = {
        kind,
        id: item.id,
        title: toItemTitle(item, kind),
        inboxStatus: item.inboxStatus,
        processedPath: item.processedPath,
        createdAt: item.createdAt,
        ...ai,
      };
      const uploadThumbUrl = (fp) => (fp ? `/api/uploads/${path.basename(String(fp).replace(/\\/g, "/"))}` : null);
      if (kind === "file") {
        const filePath = item.filePath;
        const thumbnailUrl = (item.type === "image" || item.type === "photo") ? uploadThumbUrl(filePath) : null;
        return { ...base, filename: item.filename, type: item.type, filePath, thumbnailUrl };
      }
      if (kind === "photo") {
        const filePath = item.filePath;
        const thumbnailUrl = uploadThumbUrl(filePath);
        return { ...base, filename: item.filename, type: item.type, filePath, thumbnailUrl };
      }
      if (kind === "link") return { ...base, url: item.url, type: item.type };
      if (kind === "note") return { ...base, content: (item.content || "").slice(0, 200), filename: (item.content || "").slice(0, 80) || "Nota", type: item.type };
      if (kind === "audio") return { ...base, filename: item.filename || ai.aiTitle || path.basename(item.filePath || "") || "Audio", type: item.type, filePath: item.filePath, durationSeconds: item.duration ?? 0, transcription: item.transcription ?? null };
      if (kind === "video") {
        const thumbFile = `thumb_${item.id}.jpg`;
        const thumbExists = fs.existsSync(path.join(process.cwd(), "uploads", thumbFile));
        const thumbnailUrl = thumbExists ? `/api/uploads/${thumbFile}` : null;
        return { ...base, filename: item.title || ai.aiTitle || path.basename(item.filePath || "") || "Vídeo", type: item.type, filePath: item.filePath, durationSeconds: item.duration ?? 0, transcription: item.transcription ?? null, thumbnailUrl };
      }
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
    aiEnrichment: item.aiEnrichment ?? null,
    inboxStatus: item.inboxStatus ?? null,
    processedPath: item.processedPath ?? null,
  };
}

router.get("/favorites", async (req, res) => {
  try {
    const list = await prisma.favorite.findMany({ orderBy: { createdAt: "desc" } });
    const normalizeAI = (raw) => {
      const ai = parseAI(raw);
      const topics = Array.isArray(ai?.topics) ? ai.topics : [];
      return { aiTitle: ai?.title ?? null, aiSummary: ai?.summary ?? null, aiLanguage: ai?.language ?? null, aiCategory: ai?.category ?? null, aiTopics: topics, aiTags: topics };
    };
    res.json(
      list.map((f) => {
        const ai = normalizeAI(f.aiEnrichment);
        return {
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
          ...ai,
        };
      })
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
// GET /api/inbox/related/:kind/:id — Ítems conectados por temática (topics, categoría)
// ──────────────────────────────────────────────

router.get("/related/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const item = await model.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "No encontrado" });

    const ai = parseAI(item.aiEnrichment);
    const myTopics = Array.isArray(ai?.topics) ? ai.topics.map((t) => String(t).toLowerCase().trim()) : [];
    const myCategory = ai?.category ? String(ai.category).toLowerCase().trim() : null;
    if (myTopics.length === 0 && !myCategory) return res.json([]);

    const limitPerKind = 40;
    const [notes, links, files, photos, audios, videos] = await Promise.all([
      prisma.note.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
      prisma.link.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
      prisma.file.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
      prisma.photo.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
      prisma.audio.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
      prisma.video.findMany({ where: { inboxStatus: "processed" }, orderBy: { createdAt: "desc" }, take: limitPerKind }),
    ]);

    const normalizeAIEnrichment = (raw) => {
      const a = parseAI(raw);
      const topics = Array.isArray(a?.topics) ? a.topics : [];
      return { aiTitle: a?.title ?? null, aiSummary: a?.summary ?? null, aiCategory: a?.category ?? null, aiTopics: topics };
    };

    const toItem = (entity, k) => {
      const ai = normalizeAIEnrichment(entity.aiEnrichment);
      const base = { kind: k, id: entity.id, title: toItemTitle(entity, k), createdAt: entity.createdAt, ...ai };
      if (k === "note") return { ...base, content: (entity.content || "").slice(0, 200), filename: (entity.content || "").slice(0, 80) || "Nota" };
      if (k === "link") return { ...base, url: entity.url, filename: entity.title || entity.url?.slice(0, 50) || "Enlace" };
      if (k === "file" || k === "photo") return { ...base, filename: entity.filename, filePath: entity.filePath };
      if (k === "audio") return { ...base, filename: entity.filename || ai.aiTitle || path.basename(entity.filePath || "") || "Audio", filePath: entity.filePath };
      if (k === "video") {
        const thumbFile = `thumb_${entity.id}.jpg`;
        const thumbExists = fs.existsSync(path.join(process.cwd(), "uploads", thumbFile));
        return { ...base, filename: entity.title || ai.aiTitle || path.basename(entity.filePath || "") || "Vídeo", filePath: entity.filePath, thumbnailUrl: thumbExists ? `/api/uploads/${thumbFile}` : null };
      }
      return base;
    };

    const candidates = [
      ...notes.map((n) => toItem(n, "note")),
      ...links.map((l) => toItem(l, "link")),
      ...files.map((f) => toItem(f, "file")),
      ...photos.map((p) => toItem(p, "photo")),
      ...audios.map((a) => toItem(a, "audio")),
      ...videos.map((v) => toItem(v, "video")),
    ].filter((c) => !(c.kind === kind && c.id === id));

    const score = (c) => {
      let s = 0;
      const theirTopics = (c.aiTopics ?? []).map((t) => String(t).toLowerCase().trim());
      for (const t of myTopics) {
        if (theirTopics.some((tt) => tt === t || tt.includes(t) || t.includes(tt))) s += 3;
      }
      const theirCat = c.aiCategory ? String(c.aiCategory).toLowerCase().trim() : null;
      if (myCategory && theirCat && (theirCat === myCategory || theirCat.includes(myCategory) || myCategory.includes(theirCat))) s += 2;
      return s;
    };

    const withScore = candidates.map((c) => ({ item: c, score: score(c) })).filter((x) => x.score > 0);
    withScore.sort((a, b) => b.score - a.score);
    const related = withScore.slice(0, 15).map((x) => x.item);
    res.json(related);
  } catch (err) {
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
        const ai = parseAI(item.aiEnrichment);
        const base = {
          kind: item.kind,
          id: item.id,
          type: item.type,
          createdAt: item.createdAt,
          aiEnrichment: ai,
          aiTitle: ai?.title ?? null,
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
          return { ...base, filename: item.filename || null, filePath: item.filePath, durationSeconds: item.duration ?? 0 };
        if (item.kind === "video")
          return {
            ...base,
            filePath: item.filePath,
            title: item.title,
            transcription: item.transcription ?? null,
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
// GET /api/inbox/export — Todos los ítems sin filtrar por estado (para exportar)
// ──────────────────────────────────────────────

router.get("/export", async (req, res) => {
  try {
    const parseAI = (raw) => {
      if (!raw || typeof raw !== "string") return null;
      try { return JSON.parse(raw); } catch { return null; }
    };
    const withKind = (items, kind) =>
      items.map((item) => ({ ...item, kind, aiEnrichment: parseAI(item.aiEnrichment) }));

    const [links, files, photos, audios, notes, videos] = await Promise.all([
      prisma.link.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.file.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.photo.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.audio.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.note.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.video.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    const unified = [
      ...withKind(links, "link"),
      ...withKind(files, "file"),
      ...withKind(photos, "photo"),
      ...withKind(audios, "audio"),
      ...withKind(notes, "note"),
      ...withKind(videos, "video"),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(unified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/inbox/:kind/:id — Detalle de un item (misma forma que listados: aiTitle, aiSummary, aiTopics, etc.)
// ──────────────────────────────────────────────

router.get("/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const item = await model.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "No encontrado" });

    const ai = parseAI(item.aiEnrichment);
    const topics = Array.isArray(ai?.topics) ? ai.topics : [];
    const normalized = {
      aiTitle:    ai?.title    ?? null,
      aiSummary:  ai?.summary  ?? null,
      aiLanguage: ai?.language ?? null,
      aiCategory: ai?.category ?? null,
      aiTopics:   topics,
      aiTags:     topics,
    };

    const base = {
      kind,
      id: item.id,
      title: toItemTitle(item, kind),
      inboxStatus: item.inboxStatus,
      processedPath: item.processedPath,
      createdAt: item.createdAt,
      ...normalized,
    };

    if (kind === "link") {
      let metadata = null;
      if (item.metadata) {
        try { metadata = typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata; } catch {}
      }
      return res.json({ ...base, url: item.url, type: item.type, metadata });
    }
    if (kind === "note") {
      return res.json({ ...base, content: item.content ?? "", type: item.type });
    }
    if (kind === "file") {
      return res.json({ ...base, filename: item.filename, type: item.type, filePath: item.filePath, size: item.size });
    }
    if (kind === "photo") {
      return res.json({ ...base, filename: item.filename, type: item.type, filePath: item.filePath, size: item.size });
    }
    if (kind === "audio") {
      const audioFilename = item.filename ?? ai?.title ?? (item.filePath ? path.basename(item.filePath) : null) ?? "Audio";
      return res.json({ ...base, filename: audioFilename, type: item.type, filePath: item.filePath, duration: item.duration, transcription: item.transcription ?? null });
    }
    if (kind === "video") {
      const videoTitle = item.title ?? ai?.title ?? "Vídeo";
      const videoFilename = item.title ?? ai?.title ?? (item.filePath ? path.basename(item.filePath) : null) ?? "Vídeo";
      return res.json({ ...base, title: videoTitle, filename: videoFilename, type: item.type, filePath: item.filePath, duration: item.duration, transcription: item.transcription ?? null });
    }
    return res.json(base);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// PATCH /api/inbox/:kind/:id — Actualizar aiEnrichment (title, summary, topics, mainThemes)
// ──────────────────────────────────────────────

router.patch("/:kind/:id", async (req, res) => {
  const { kind, id } = req.params;
  const modelMap = { link: prisma.link, note: prisma.note, file: prisma.file, photo: prisma.photo, audio: prisma.audio, video: prisma.video };
  const model = modelMap[kind];
  if (!model) return res.status(400).json({ error: "kind inválido" });

  try {
    const item = await model.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: "No encontrado" });

    let aiEnrichment = {};
    if (item.aiEnrichment) {
      try { aiEnrichment = JSON.parse(item.aiEnrichment); } catch {}
    }

    const { title, summary, topics, mainThemes } = req.body;
    if (title !== undefined) aiEnrichment.title = title;
    if (summary !== undefined) aiEnrichment.summary = summary;
    if (topics !== undefined) aiEnrichment.topics = Array.isArray(topics) ? topics : [];
    if (mainThemes !== undefined) aiEnrichment.mainThemes = Array.isArray(mainThemes) ? mainThemes : [];

    await model.update({ where: { id }, data: { aiEnrichment: JSON.stringify(aiEnrichment) } });

    return res.json({ ok: true, aiEnrichment });
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
