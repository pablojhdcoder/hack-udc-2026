import { Router } from "express";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = resolve(join(__dirname, "..", "..", "knowledge"));

const router = Router();

/**
 * Lista recursivamente carpetas y ficheros .md bajo knowledge/
 * GET /api/knowledge → listado desde la raíz
 * GET /api/knowledge?path=estudio/SI → listado de esa subcarpeta
 */
router.get("/", async (req, res) => {
  try {
    const subPath = (req.query.path ?? "").toString().replace(/^\/+/, "").replace(/\\/g, "/");
    const dir = resolve(KNOWLEDGE_DIR, subPath);

    if (!dir.startsWith(KNOWLEDGE_DIR)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    if (!existsSync(dir)) {
      return res.json({ path: subPath || ".", folders: [], files: [] });
    }

    const entries = await readdir(dir, { withFileTypes: true });
    const folders = [];
    const files = [];

    for (const e of entries) {
      const rel = join(subPath, e.name).replace(/\\/g, "/");
      if (e.isDirectory()) {
        folders.push(rel);
      } else if (e.name.endsWith(".md")) {
        files.push(rel);
      }
    }

    folders.sort();
    files.sort();
    res.json({ path: subPath || ".", folders, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sirve un fichero .md por path relativo a knowledge/
 * GET /api/knowledge/estudio/SI/nota.md
 */
router.get("/*", async (req, res) => {
  try {
    const rawPath = (req.path.slice(1) ?? "").replace(/\\/g, "/");
    if (!rawPath.endsWith(".md")) {
      return res.status(400).json({ error: "Only .md files can be served" });
    }

    const fullPath = resolve(KNOWLEDGE_DIR, rawPath);
    if (!fullPath.startsWith(KNOWLEDGE_DIR) || !existsSync(fullPath)) {
      return res.status(404).json({ error: "Not found" });
    }

    const content = await readFile(fullPath, "utf-8");
    res.type("text/markdown").send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
