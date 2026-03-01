import { FirecrawlClient } from "@mendable/firecrawl-js";

/**
 * Extrae el contenido completo de una URL usando Firecrawl.
 * Devuelve { title, description, image, markdown } o null si falla.
 */
async function firecrawlScrape(url) {
  const apiKey = process.env.FIRECRAWLER_API_KEY ?? process.env.FIRECRAWL_API_KEY ?? "";
  if (!apiKey) return null;

  try {
    const client = new FirecrawlClient({ apiKey });
    // scrape() devuelve el objeto data directamente (markdown, metadata, etc.)
    const result = await client.scrape(url, {
      formats: ["markdown"],
    });

    if (!result) return null;

    return {
      title: result.metadata?.title ?? null,
      description: result.metadata?.description ?? null,
      image: result.metadata?.ogImage ?? result.metadata?.image ?? null,
      markdown: result.markdown ?? null,
      sourceURL: result.metadata?.sourceURL ?? url,
    };
  } catch (err) {
    console.warn("[Firecrawl] Error scraping", url, ":", err.message);
    return null;
  }
}

/**
 * Fallback: obtiene metadatos OG de una URL con fetch simple.
 */
async function ogFallback(url) {
  const result = {};
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
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
  } catch {
    // ignorar
  }
  return result;
}

/**
 * Obtiene preview + contenido completo de una URL.
 * 1. Intenta Firecrawl (extrae markdown + metadatos completos).
 * 2. Fallback: scraping OG básico.
 *
 * @param {string} url
 * @returns {Promise<{ title?, description?, image?, markdown?, sourceURL?, _firecrawlUsed?: boolean }>}
 */
export async function getLinkPreview(url) {
  const fc = await firecrawlScrape(url);
  if (fc) {
    console.log(`[Firecrawl] ✓ Scraped: ${url}`);
    return { ...fc, _firecrawlUsed: true };
  }
  console.log(`[Firecrawl] Sin API key o falló, usando fallback OG para: ${url}`);
  const og = await ogFallback(url);
  return { ...og, _firecrawlUsed: false };
}

/**
 * Extrae solo el contenido en markdown de una URL via Firecrawl.
 * Útil para pasar a la IA como contexto adicional.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export async function getLinkMarkdown(url) {
  const fc = await firecrawlScrape(url);
  return fc?.markdown ?? null;
}
