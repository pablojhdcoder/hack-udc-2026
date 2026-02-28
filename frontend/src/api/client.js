import { MOCK_INBOX_ITEMS } from "../data/mockInbox";

const API_BASE = "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// type (mockInbox) -> kind (API/ProcessScreen)
const TYPE_TO_KIND = { text: "note", link: "link", voice: "audio", file: "file" };

// Copia mutable de mockInbox con `kind` para ProcessScreen; mismo dataset que la pantalla Inbox
let mockItems = MOCK_INBOX_ITEMS.map((item) => ({
  ...item,
  kind: TYPE_TO_KIND[item.type] ?? "note",
}));

let mockIdCounter = 100;

function getMockInbox() {
  return Promise.resolve({ items: [...mockItems] });
}

function addMockToInbox(payload) {
  const rawInput = payload.rawInput ?? payload.content ?? payload.url ?? "";
  const isUrl = /^https?:\/\//i.test(rawInput.trim());
  const id = `mock-${++mockIdCounter}`;
  const type = isUrl ? "link" : "text";
  const item = isUrl
    ? {
        id,
        kind: "link",
        type: "generic",
        url: rawInput.trim(),
        title: null,
        createdAt: new Date().toISOString(),
      }
    : {
        id,
        kind: "note",
        type: "text",
        content: rawInput.trim(),
        createdAt: new Date().toISOString(),
      };
  mockItems.push(item);
  return Promise.resolve(item);
}

function processMockItems(ids, destination) {
  const idsSet = new Set(ids.map((i) => i.id));
  for (let i = mockItems.length - 1; i >= 0; i--) {
    if (idsSet.has(mockItems[i].id)) mockItems.splice(i, 1);
  }
  const paths = ids.map((_, idx) => `${destination}/nota-${idx + 1}.md`);
  return Promise.resolve({ results: paths.map((p) => ({ processedPath: p })) });
}

function discardMockItem(kind, id) {
  const i = mockItems.findIndex((item) => item.id === id);
  if (i !== -1) mockItems.splice(i, 1);
  return Promise.resolve();
}

// ——— API real
/** Normaliza respuesta: backend devuelve array; el frontend espera { items } */
export async function getInbox() {
  if (USE_MOCK) return getMockInbox();
  const res = await fetch(`${API_BASE}/inbox`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? { items: data } : data;
}

/**
 * Añade un ítem al inbox.
 * Los archivos siempre se suben al backend (para tener id real y poder procesarlos).
 * @param {object} payload - { content?: string, url?: string } para texto/enlace, o { file: File } para subir archivo
 */
export async function addToInbox(payload) {
  if (payload.file instanceof File) {
    const form = new FormData();
    form.append("file", payload.file);
    const res = await fetch(`${API_BASE}/inbox`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
    const item = await res.json();
    if (USE_MOCK) mockItems.push({ ...item, kind: item.kind, inboxStatus: item.inboxStatus ?? "pending" });
    return item;
  }

  if (USE_MOCK) return addMockToInbox(payload);

  const body = {};
  if (payload.url != null) body.url = payload.url;
  if (payload.content != null) body.content = payload.content;
  if (Object.keys(body).length === 0) throw new Error("Se requiere content, url o file");

  const res = await fetch(`${API_BASE}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Procesa ítems seleccionados y genera Markdown en knowledge.
 * Siempre hace POST al backend (aunque esté activo el mock de inbox).
 * @param {Array<{ kind: string, id: string }>} ids
 * @param {string} destination - ruta relativa en knowledge (ej. "estudio/SI")
 */
export async function processItems(ids, destination) {
  const res = await fetch(`${API_BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, destination }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const errors = data.results?.filter((r) => r.error) ?? [];
  if (errors.length) throw new Error(errors.map((e) => e.error).join("; "));
  if (USE_MOCK) processMockItems(ids, destination);
  return data;
}

/**
 * Descarta/borra un ítem del inbox (lo elimina y deja de aparecer).
 * @param {string} kind - link | note | file | audio | video
 * @param {string} id
 */
export async function discardItem(kind, id) {
  const res = await fetch(`${API_BASE}/inbox/${kind}/${id}`, { method: "DELETE" });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(await res.text());
  if (USE_MOCK) discardMockItem(kind, id);
}

/**
 * Carpetas (tipos) con conteo desde la BD: Notas, Enlaces, Archivos, Audio, Video.
 * @returns {{ folders: Array<{ kind: string, name: string, count: number }> }}
 */
export async function getVaultFolders() {
  if (USE_MOCK) {
    const counts = { note: 0, link: 0, file: 0, audio: 0, video: 0 };
    mockItems.forEach((item) => {
      if (counts[item.kind] != null) counts[item.kind]++;
    });
    return {
      folders: [
        { kind: "note", name: "Notas", count: counts.note },
        { kind: "link", name: "Enlaces", count: counts.link },
        { kind: "file", name: "Archivos", count: counts.file },
        { kind: "audio", name: "Audio", count: counts.audio },
        { kind: "video", name: "Video", count: counts.video },
      ],
    };
  }
  const res = await fetch(`${API_BASE}/inbox/folders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Últimos ítems procesados (para Tu Cerebro / Notas recientes).
 * @param {number} limit
 * @returns {Promise<Array<{ kind, id, title, processedPath, createdAt }>>}
 */
export async function getProcessedRecent(limit = 20) {
  if (USE_MOCK) return Promise.resolve([]);
  const res = await fetch(`${API_BASE}/inbox/processed/recent?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Todos los ítems de un tipo (note, link, file, audio, video) — pending y processed.
 * Para mostrar en Tu Cerebro al pulsar una carpeta.
 * @param {string} kind
 * @returns {Promise<Array<{ kind, id, title, inboxStatus, processedPath, createdAt }>>}
 */
export async function getInboxByKind(kind) {
  if (USE_MOCK) {
    const list = mockItems.filter((item) => item.kind === kind);
    return list.map((item) => ({
      kind: item.kind,
      id: item.id,
      title: item.content?.slice(0, 50) || item.title || item.filename || "Nota de voz" || "Ítem",
      inboxStatus: "pending",
      processedPath: null,
      createdAt: item.createdAt,
    }));
  }
  const res = await fetch(`${API_BASE}/inbox/by-kind/${kind}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Carpetas de conocimiento (destino al procesar). Misma lista que en Procesar. */
export const KNOWLEDGE_FOLDERS = [
  "estudio/SI",
  "proyectos/HackUDC",
  "referencias/React",
  "inbox",
];

/**
 * Contenido de una carpeta de knowledge (subcarpetas y ficheros .md).
 * @param {string} path - ruta relativa, ej. "estudio/SI"
 * @returns {Promise<{ path: string, folders: string[], files: string[] }>}
 */
export async function getKnowledgeFolder(path) {
  const res = await fetch(`${API_BASE}/knowledge?path=${encodeURIComponent(path || ".")}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
