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

// Límites por tipo de fichero (se aplica el mayor para simplificar; el tipo real
// se valida en la ruta de inbox tras la subida).
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB — cubre vídeo/audio largos

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Ejecuta Multer solo cuando la petición es multipart/form-data.
 * Devuelve JSON en caso de error (tamaño, campo inválido, etc.)
 * en lugar de la página HTML de error por defecto de Express.
 */
export function optionalMulter(req, res, next) {
  if (!req.is("multipart/form-data")) {
    return next();
  }

  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `El fichero supera el límite máximo permitido (${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB).`,
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Campo de fichero inesperado. Usa el campo 'file'.",
      });
    }

    // Cualquier otro error de Multer o de disco
    console.error("[upload] Error Multer:", err.message);
    return res.status(500).json({ error: `Error al subir el fichero: ${err.message}` });
  });
}
