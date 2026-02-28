/**
 * Obtiene metadatos de preview de una URL (og:title, og:description, og:image).
 * Para guardar en Link.metadata al crear un link desde el inbox.
 * @param {string} url - URL a inspeccionar
 * @param {object} [options] - { signal: AbortSignal } para timeout
 * @returns {Promise<{ title?: string, description?: string, image?: string }>}
 */
export async function getLinkPreview(url, options = {}) {
  const { signal } = options;
  const result = {};

  try {
    const res = await fetch(url, {
      signal: signal ?? AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; +https://example.com/bot)" },
      redirect: "follow",
    });

    if (!res.ok) return result;
    const html = await res.text();

    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    if (ogTitle?.[1]) result.title = ogTitle[1].trim();

    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    if (ogDesc?.[1]) result.description = ogDesc[1].trim();

    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
    if (ogImage?.[1]) result.image = ogImage[1].trim();

    return result;
  } catch {
    return result;
  }
}
