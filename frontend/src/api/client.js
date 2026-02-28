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
 * Texto, enlaces y archivos siempre se envían al backend para que se guarden en la BD y aparezcan en la lista.
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
  const item = await res.json();
  if (USE_MOCK) mockItems.push({ ...item, kind: item.kind, inboxStatus: item.inboxStatus ?? "pending" });
  return item;
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
 * Actualiza los campos editables de aiEnrichment (title, summary, topics) de un ítem del inbox.
 * @param {string} kind - link | note | file | audio | video
 * @param {string} id
 * @param {{ title?: string, summary?: string, topics?: string[] }} fields
 */
export async function updateInboxEnrichment(kind, id, fields) {
  const res = await fetch(`${API_BASE}/inbox/${kind}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
 * Siempre usa la API real para reflejar lo que hay en la base de datos.
 * @returns {{ folders: Array<{ kind: string, name: string, count: number }> }}
 */
export async function getVaultFolders() {
  const res = await fetch(`${API_BASE}/inbox/folders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Últimos ítems procesados (para Tu Cerebro / recientes).
 * Siempre usa la API real para reflejar la base de datos.
 * @param {number} limit
 * @returns {Promise<Array<{ kind, id, title, processedPath, createdAt }>>}
 */
export async function getProcessedRecent(limit = 5) {
  const res = await fetch(`${API_BASE}/inbox/processed/recent?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Ítems procesados aún no abiertos (carpeta Novedades).
 * @param {number} limit
 */
export async function getNovelties(limit = 50) {
  const res = await fetch(`${API_BASE}/inbox/novelties?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Wrapped semanal: ítems más abiertos en la última semana.
 * @param {number} limit
 */
export async function getWeeklyWrapped(limit = 15) {
  const res = await fetch(`${API_BASE}/inbox/wrapped/weekly?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Marca un ítem como "abierto" (para que deje de aparecer en Novedades).
 * @param {string} kind - note | link | file | photo | audio | video
 * @param {string} id
 */
export async function markOpened(kind, id) {
  const res = await fetch(`${API_BASE}/inbox/opened`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id }),
  });
  if (!res.ok && res.status !== 204) throw new Error(await res.text());
}

/**
 * Todos los ítems de un tipo (note, link, file, audio, video) — pending y processed.
 * Para kind "favorite" usar getFavorites().
 * @param {string} kind
 * @returns {Promise<Array<{ kind, id, title, filename?, url?, content?, type, inboxStatus, processedPath, createdAt }>>}
 */
export async function getInboxByKind(kind) {
  const res = await fetch(`${API_BASE}/inbox/by-kind/${kind}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Detalle de un ítem del inbox (p. ej. para ver el contenido completo de una nota).
 * @param {string} kind - note | link | file | photo | audio | video
 * @param {string} id
 * @returns {Promise<{ content?, title?, url?, filePath?, ... }>}
 */
export async function getInboxItem(kind, id) {
  const res = await fetch(`${API_BASE}/inbox/${kind}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Lista de favoritos (carpeta Favoritos).
 * @returns {Promise<Array<{ kind: "favorite", id, sourceKind, sourceId, title, filename?, url?, type, createdAt }>>}
 */
export async function getFavorites() {
  const res = await fetch(`${API_BASE}/inbox/favorites`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Comprueba si un ítem está en favoritos.
 * @param {string} kind - note | link | file | audio | video
 * @param {string} id - id del ítem
 * @returns {Promise<{ favorited: boolean, favoriteId: string|null }>}
 */
export async function checkFavorite(kind, id) {
  const res = await fetch(`${API_BASE}/inbox/favorites/check?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Añade un ítem a favoritos (por kind e id del ítem original).
 */
export async function addToFavorites(kind, id) {
  const res = await fetch(`${API_BASE}/inbox/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Quita un ítem de favoritos (por id del registro Favorite).
 * @param {string} favoriteId - id del favorito (no del ítem original)
 */
export async function removeFromFavorites(favoriteId) {
  const res = await fetch(`${API_BASE}/inbox/favorites/${favoriteId}`, { method: "DELETE" });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(await res.text());
}

/**
 * Todos los ítems (todos los estados, todos los tipos) para exportar.
 * Llama a GET /api/inbox/export que no filtra por inboxStatus.
 */
export async function getAllItemsForExport() {
  if (USE_MOCK) return [...mockItems];
  const res = await fetch(`${API_BASE}/inbox/export`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
