import path from "path";

const ALLOWED_KINDS_INPUT = ["link", "note"];
const ALLOWED_KINDS_FILE = ["audio", "video", "photo", "file"];
const DEFAULT_TYPE_BY_KIND = {
  link: "generic",
  note: "note",
  audio: "audio",
  video: "video",
  photo: "image",
  file: "unknown",
};

const URL_PATTERNS = [
  { regex: /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/i, type: "youtube" },
  { regex: /twitch\.tv\//i, type: "twitch" },
  { regex: /t\.me\/|telegram\.me\//i, type: "telegram" },
  { regex: /twitter\.com\/|x\.com\//i, type: "twitter" },
  { regex: /reddit\.com\//i, type: "reddit" },
  { regex: /github\.com\//i, type: "github" },
  { regex: /stackoverflow\.com\//i, type: "stackoverflow" },
  { regex: /spotify\.com\//i, type: "spotify" },
];

const FILE_CATEGORIES = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  odt: "word",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ppt: "presentation",
  pptx: "presentation",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  heic: "image",
  heif: "image",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  flac: "audio",
  aac: "audio",
  wma: "audio",
  mp4: "video",
  mkv: "video",
  webm: "video",
  mov: "video",
  avi: "video",
  m4v: "video",
  mpeg: "video",
  md: "markdown",
  txt: "text",
};

/** MIME → { kind, type } para fallback cuando la extensión falta o es desconocida */
const MIME_TO_KIND_TYPE = {
  "application/pdf": { kind: "file", type: "pdf" },
  "application/msword": { kind: "file", type: "word" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "file", type: "word" },
  "application/vnd.oasis.opendocument.text": { kind: "file", type: "word" },
  "text/plain": { kind: "file", type: "text" },
  "text/markdown": { kind: "file", type: "markdown" },
  "text/html": { kind: "file", type: "text" },
  "image/jpeg": { kind: "photo", type: "image" },
  "image/png": { kind: "photo", type: "image" },
  "image/gif": { kind: "photo", type: "image" },
  "image/webp": { kind: "photo", type: "image" },
  "image/svg+xml": { kind: "photo", type: "image" },
  "image/heic": { kind: "photo", type: "image" },
  "audio/mpeg": { kind: "audio", type: "audio" },
  "audio/wav": { kind: "audio", type: "audio" },
  "audio/ogg": { kind: "audio", type: "audio" },
  "audio/mp4": { kind: "audio", type: "audio" },
  "audio/x-m4a": { kind: "audio", type: "audio" },
  "audio/flac": { kind: "audio", type: "audio" },
  "video/mp4": { kind: "video", type: "video" },
  "video/webm": { kind: "video", type: "video" },
  "video/quicktime": { kind: "video", type: "video" },
  "video/x-matroska": { kind: "video", type: "video" },
  "video/avi": { kind: "video", type: "video" },
};

const AUDIO_EXTS = ["audio", "mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"];
const VIDEO_EXTS = ["video", "mp4", "mkv", "webm", "mov", "avi", "m4v", "mpeg"];
const IMAGE_EXTS = ["image", "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "svg"];

function normalizeInputReturn(kind, type) {
  if (!ALLOWED_KINDS_INPUT.includes(kind) || typeof type !== "string" || !type.trim()) {
    return { kind: "note", type: "note" };
  }
  return { kind, type: type.trim() };
}

function normalizeFileReturn(kind, type) {
  if (!ALLOWED_KINDS_FILE.includes(kind) || typeof type !== "string" || !type.trim()) {
    return { kind: "file", type: "unknown" };
  }
  return { kind, type: type.trim() };
}

/**
 * Detecta si el input es una URL y devuelve { kind: "link", type }
 * o si es texto plano y devuelve { kind: "note", type }.
 * Defensivo: null/undefined/vacío → note; retorno siempre válido.
 */
export function classifyInput(rawInput) {
  const trimmed = (rawInput == null || typeof rawInput !== "string" ? "" : rawInput).toString().trim();
  if (trimmed === "") {
    return { kind: "note", type: "note" };
  }

  // URL con protocolo
  if (/^https?:\/\//i.test(trimmed)) {
    const matched = URL_PATTERNS.find((p) => p.regex.test(trimmed));
    return normalizeInputReturn("link", matched?.type ?? "generic");
  }

  // URL sin protocolo: www. o dominio tipo ejemplo.com
  if (/^www\./i.test(trimmed) || /^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const matched = URL_PATTERNS.find((p) => p.regex.test(url));
    return normalizeInputReturn("link", matched?.type ?? "generic");
  }

  if (/^```[\s\S]*```$/m.test(trimmed) || /^(import |const |let |var |function |class |def |#include)/m.test(trimmed)) {
    return normalizeInputReturn("note", "code");
  }

  if (/^(\s*[-*]\s|\s*\d+\.\s)/m.test(trimmed) && /\b(TODO|FIXME|HACK|tarea|hacer)\b/i.test(trimmed)) {
    return normalizeInputReturn("note", "task");
  }

  return normalizeInputReturn("note", "note");
}

/**
 * Extrae la extensión: usa path.extname; si hay varias (ej. archivo.report.pdf),
 * prioriza la última parte que esté en FILE_CATEGORIES para no confundir con "archivo.sin.ext".
 */
function getExtensionFromFilename(name) {
  const base = path.basename(name || "");
  const parts = base.split(".");
  if (parts.length > 1) {
    const candidates = parts.map((p) => p.toLowerCase()).filter(Boolean);
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (FILE_CATEGORIES[candidates[i]] != null) return candidates[i];
    }
    const last = candidates[candidates.length - 1];
    if (last) return last;
  }
  const extFromPath = path.extname(base).toLowerCase().replace(/^\./, "");
  return extFromPath || "";
}

/**
 * Clasifica un fichero subido por extensión y opcionalmente por MIME.
 * Defensivo: nombre vacío/MIME → fallback; retorno siempre { kind, type } válidos.
 */
export function classifyFile(filename, mimetype) {
  const name = (filename == null || typeof filename !== "string" ? "" : filename).toString().trim().toLowerCase();
  const nameForExt = name || "file";
  const ext = getExtensionFromFilename(nameForExt);
  const type = FILE_CATEGORIES[ext];

  // Audio
  if (AUDIO_EXTS.includes(ext)) {
    return normalizeFileReturn("audio", type ?? "audio");
  }
  if (ext === "webm" && (name.includes("nota-voz") || name.includes("recording"))) {
    return normalizeFileReturn("audio", "voice_note");
  }

  // Video
  if (VIDEO_EXTS.includes(ext) || type === "video") {
    return normalizeFileReturn("video", type ?? "video");
  }

  // Photo / image
  if (IMAGE_EXTS.includes(ext) || type === "image") {
    const photoType = type || ext || "image";
    return normalizeFileReturn("photo", photoType);
  }

  // Fallback por MIME si la extensión no fue reconocida o está vacía
  const mime = typeof mimetype === "string" ? mimetype.trim().toLowerCase() : "";
  if (mime) {
    const direct = MIME_TO_KIND_TYPE[mime];
    if (direct) return normalizeFileReturn(direct.kind, direct.type);
    if (mime.startsWith("audio/")) return normalizeFileReturn("audio", "audio");
    if (mime.startsWith("video/")) return normalizeFileReturn("video", "video");
    if (mime.startsWith("image/")) return normalizeFileReturn("photo", "image");
  }

  return normalizeFileReturn("file", type ?? "unknown");
}
