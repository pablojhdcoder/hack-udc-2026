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
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  mp4: "video",
  mkv: "video",
  webm: "video",
  md: "markdown",
  txt: "text",
};

/**
 * Detecta si el input es una URL y devuelve { kind: "link", type }
 * o si es texto plano y devuelve { kind: "note", type }
 */
export function classifyInput(rawInput) {
  const trimmed = rawInput.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    const matched = URL_PATTERNS.find((p) => p.regex.test(trimmed));
    return { kind: "link", type: matched?.type ?? "generic" };
  }

  if (/^```[\s\S]*```$/m.test(trimmed) || /^(import |const |let |var |function |class |def |#include)/m.test(trimmed)) {
    return { kind: "note", type: "code" };
  }

  if (/^(\s*[-*]\s|\s*\d+\.\s)/m.test(trimmed) && /\b(TODO|FIXME|HACK|tarea|hacer)\b/i.test(trimmed)) {
    return { kind: "note", type: "task" };
  }

  return { kind: "note", type: "note" };
}

/**
 * Clasifica un fichero subido por su extensión
 */
export function classifyFile(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const type = FILE_CATEGORIES[ext];

  if (["audio", "mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return { kind: "audio", type: type ?? "audio" };
  }

  return { kind: "file", type: type ?? "unknown" };
}
