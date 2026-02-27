const API_BASE = "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// ——— Mock: datos en memoria (solo se usa cuando VITE_USE_MOCK=true)
const mockItems = [
  {
    kind: "link",
    id: "mock-link-1",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Vídeo de ejemplo",
    createdAt: new Date().toISOString(),
  },
  {
    kind: "note",
    id: "mock-note-1",
    type: "note",
    content: "Apunte rápido: round-robin con quantum grande se comporta como FIFO.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    kind: "link",
    id: "mock-link-2",
    type: "github",
    url: "https://github.com/prisma/prisma",
    title: "Prisma",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

let mockIdCounter = 100;

function getMockInbox() {
  return Promise.resolve({ items: [...mockItems] });
}

function addMockToInbox(payload) {
  const rawInput = payload.rawInput ?? payload.content ?? "";
  const isUrl = /^https?:\/\//i.test(rawInput.trim());
  const id = `mock-${++mockIdCounter}`;
  const item = isUrl
    ? {
        kind: "link",
        id,
        type: "generic",
        url: rawInput.trim(),
        title: null,
        createdAt: new Date().toISOString(),
      }
    : {
        kind: "note",
        id,
        type: "note",
        content: rawInput.trim(),
        createdAt: new Date().toISOString(),
      };
  mockItems.push(item);
  return Promise.resolve(item);
}

function processMockItems(ids, destination) {
  const idsSet = new Set(ids.map((i) => i.id));
  const before = mockItems.length;
  for (let i = mockItems.length - 1; i >= 0; i--) {
    if (idsSet.has(mockItems[i].id)) mockItems.splice(i, 1);
  }
  const processed = before - mockItems.length;
  const paths = ids.map((_, idx) => `${destination}/nota-${idx + 1}.md`);
  return Promise.resolve({ processed, paths });
}

// ——— API real
export async function getInbox() {
  if (USE_MOCK) return getMockInbox();
  const res = await fetch(`${API_BASE}/inbox`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addToInbox(payload) {
  if (USE_MOCK) return addMockToInbox(payload);
  const res = await fetch(`${API_BASE}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function processItems(ids, destination) {
  if (USE_MOCK) return processMockItems(ids, destination);
  const res = await fetch(`${API_BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, destination }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
