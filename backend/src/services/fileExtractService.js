import { readFileSync, existsSync } from "fs";
import { extname } from "path";

/**
 * Extrae el contenido textual de un fichero según su tipo.
 * Devuelve { text, mimeType, error? }
 */
export async function extractFileContent(absolutePath, type) {
  if (!existsSync(absolutePath)) {
    return { text: null, mimeType: null, error: "Fichero no encontrado" };
  }

  const ext = extname(absolutePath).toLowerCase().replace(".", "");

  // PDF
  if (type === "pdf" || ext === "pdf") {
    return extractPdf(absolutePath);
  }

  // Word / OpenDocument
  if (["word", "doc", "docx", "odt"].includes(type) || ["doc", "docx", "odt"].includes(ext)) {
    return extractWord(absolutePath);
  }

  // Imágenes
  if (["image", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(type) || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return extractImage(absolutePath, ext);
  }

  // Texto plano / Markdown
  if (["text", "markdown", "txt", "md"].includes(type) || ["txt", "md"].includes(ext)) {
    try {
      const text = readFileSync(absolutePath, "utf-8");
      return { text: text.slice(0, 8000), mimeType: "text/plain" };
    } catch (err) {
      return { text: null, mimeType: "text/plain", error: err.message };
    }
  }

  return { text: null, mimeType: null, error: "Tipo de fichero no soportado para extracción" };
}

async function extractPdf(filePath) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy?.();
    const text = result?.text?.slice(0, 8000) ?? null;
    const pageCount = result?.total ?? undefined;
    return {
      text,
      mimeType: "application/pdf",
      pageCount,
    };
  } catch (err) {
    return { text: null, mimeType: "application/pdf", error: err.message };
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
