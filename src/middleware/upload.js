import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${(file.originalname || "file").replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * Ejecuta Multer solo cuando la petición es multipart/form-data.
 * Así el mismo POST /api/inbox puede atender JSON (content/url) o ficheros.
 */
export function optionalMulter(req, res, next) {
  if (!req.is("multipart/form-data")) {
    return next();
  }
  upload.single("file")(req, res, next);
}
