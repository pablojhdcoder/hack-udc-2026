import { Router } from "express";
import path from "path";
import prisma from "../lib/prisma.js";
import { classifyInput, classifyFile } from "../services/classifyService.js";
import { getLinkPreview } from "../services/linkPreviewService.js";
import { optionalMulter } from "../middleware/upload.js";

const router = Router();

// POST /api/inbox — JSON (content | url) o multipart (file)
router.post("/", optionalMulter, async (req, res) => {
  try {
    // Multipart: fichero subido
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
        return res.status(201).json({
          kind: "audio",
          id: audio.id,
          type: audio.type,
          filePath: audio.filePath,
          createdAt: audio.createdAt,
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
      return res.status(201).json({
        kind: "file",
        id: file.id,
        type: file.type,
        filename: file.filename,
        filePath: file.filePath,
        createdAt: file.createdAt,
      });
    }

    // JSON: content o url
    const body = req.body || {};
    const raw = body.url ?? body.content;
    if (raw == null || typeof raw !== "string") {
      return res.status(400).json({
        error: "Se requiere 'content' o 'url' en el body (JSON), o un fichero en multipart (campo 'file').",
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
        // Si falla el preview, el link se crea igual sin metadata
      }
      const hasPreview = Object.keys(preview).length > 0;
      if (hasPreview) {
        await prisma.link.update({
          where: { id: link.id },
          data: { metadata: JSON.stringify(preview) },
        });
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
      });
    }

    const note = await prisma.note.create({
      data: {
        content: raw.trim(),
        type,
        inboxStatus: "pending",
      },
    });
    return res.status(201).json({
      kind: "note",
      id: note.id,
      type: note.type,
      content: note.content,
      createdAt: note.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbox — Listar entradas pendientes (Link, File, Audio, Note) unificado
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

export default router;
