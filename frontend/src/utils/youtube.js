/**
 * Extrae el ID de vídeo de una URL de YouTube.
 * Soporta: youtube.com/watch?v=ID, youtube.com/embed/ID, youtu.be/ID
 * @param {string} url
 * @returns {string|null}
 */
export function getYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeUrl(url) {
  return Boolean(getYouTubeVideoId(url));
}
