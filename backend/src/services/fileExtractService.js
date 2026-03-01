import { readFileSync, existsSync } from "fs";
import { extname, resolve } from "path";
import { pathToFileURL } from "url";

let pdfPolyfillsApplied = false;
function applyPdfNodePolyfills() {
  if (pdfPolyfillsApplied || typeof globalThis.window !== "undefined") return;
  pdfPolyfillsApplied = true;
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init) {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        if (typeof init === "string" && init.startsWith("matrix")) {
          const m = init.replace(/matrix\(|\)/g, "").split(/,\s*/).map(Number);
          if (m.length >= 6) {
            this.a = m[0]; this.b = m[1]; this.c = m[2]; this.d = m[3]; this.e = m[4]; this.f = m[5];
          }
        }
      }
      transform(a, b, c, d, e, f) { return this; }
      multiply() { return this; }
      inverse() { return this; }
      translate() { return this; }
      scale() { return this; }
    };
  }
  if (typeof globalThis.ImageData === "undefined") {
    globalThis.ImageData = class ImageData {
      constructor(dataOrWidth, widthOrHeight, height) {
        if (typeof dataOrWidth === "number") {
          this.width = dataOrWidth;
          this.height = widthOrHeight ?? 0;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.data = dataOrWidth;
          this.width = widthOrHeight ?? 0;
          this.height = height ?? 0;
        }
      }
    };
  }
  if (typeof globalThis.Path2D === "undefined") {
    globalThis.Path2D = class Path2D {
      constructor() {}
      moveTo() {}
      lineTo() {}
      rect() {}
      arc() {}
      closePath() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
    };
  }
}

/**
 * Extrae el contenido textual de un fichero según su tipo.
 * Devuelve { text, mimeType, error? }
 */
export async function extractFileContent(absolutePath, type) {
  const normalizedPath = resolve(absolutePath);
  if (!existsSync(normalizedPath)) {
    return { text: null, mimeType: null, error: "Fichero no encontrado" };
  }

  const ext = extname(normalizedPath).toLowerCase().replace(".", "");

  // PDF
  if (type === "pdf" || ext === "pdf") {
    return extractPdf(normalizedPath);
  }

  // Word / OpenDocument
  if (["word", "doc", "docx", "odt"].includes(type) || ["doc", "docx", "odt"].includes(ext)) {
    return extractWord(normalizedPath);
  }

  // Imágenes
  if (["image", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(type) || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return extractImage(normalizedPath, ext);
  }

  // Texto plano / Markdown
  if (["text", "markdown", "txt", "md"].includes(type) || ["txt", "md"].includes(ext)) {
    try {
      const text = readFileSync(normalizedPath, "utf-8");
      return { text: text.slice(0, 8000), mimeType: "text/plain" };
    } catch (err) {
      return { text: null, mimeType: "text/plain", error: err.message };
    }
  }

  return { text: null, mimeType: null, error: "Tipo de fichero no soportado para extracción" };
}

async function extractPdf(filePath) {
  applyPdfNodePolyfills();
  const { PDFParse } = await import("pdf-parse");
  const normalized = resolve(filePath);

  const runExtract = async (parser) => {
    const result = await parser.getText();
    await parser.destroy?.();
    let raw = (result?.text ?? "").trim();
    if (raw.length === 0 && result?.pages?.length) {
      raw = result.pages
        .map((p) => (p && typeof p.text === "string" ? p.text : ""))
        .join("\n\n")
        .trim();
    }
    return {
      text: raw.length > 0 ? raw.slice(0, 12000) : null,
      pageCount: result?.total ?? undefined,
    };
  };

  try {
    const buffer = readFileSync(normalized);
    const parser = new PDFParse({ data: buffer });
    const out = await runExtract(parser);
    return { ...out, mimeType: "application/pdf" };
  } catch (errBuf) {
    try {
      const fileUrl = pathToFileURL(normalized).href;
      const parser = new PDFParse({ url: fileUrl });
      const out = await runExtract(parser);
      return { ...out, mimeType: "application/pdf" };
    } catch (err) {
      console.warn("[PDF] Error extrayendo texto:", err.message);
      return { text: null, mimeType: "application/pdf", error: err.message };
    }
  }
}

async function extractWord(filePath) {
  try {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value?.slice(0, 8000) ?? null,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  } catch (err) {
    return { text: null, mimeType: "application/msword", error: err.message };
  }
}

function extractImage(filePath, ext) {
  try {
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString("base64");
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = mimeMap[ext] ?? "image/jpeg";
    return { text: null, base64, mimeType };
  } catch (err) {
    return { text: null, mimeType: "image/jpeg", error: err.message };
  }
}
