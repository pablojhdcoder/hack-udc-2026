const API_BASE = "/api";

export async function getInbox() {
  const res = await fetch(`${API_BASE}/inbox`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addToInbox(payload) {
  const res = await fetch(`${API_BASE}/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function processItems(ids, destination) {
  const res = await fetch(`${API_BASE}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, destination }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
