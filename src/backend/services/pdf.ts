import zlib from "node:zlib";
import { GoogleGenAI, Type } from "@google/genai";
import { getEnv } from "../config/env";
import { AppError } from "../errors";
import type { ExtractedPdfResult, PdfPageContent } from "../types";

export interface FileValidationInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");

const FORBIDDEN_SIGNATURES: { name: string; bytes: Buffer }[] = [
  { name: "Windows Executable (MZ)", bytes: Buffer.from([0x4d, 0x5a]) },
  { name: "ELF Binary", bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]) },
  { name: "ZIP Archive", bytes: Buffer.from([0x50, 0x4b, 0x03, 0x04]) },
  { name: "PNG Image", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { name: "JPEG Image", bytes: Buffer.from([0xff, 0xd8, 0xff]) },
];

export function validatePdfUpload(file: FileValidationInput | undefined, maxBytes: number): void {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new AppError(400, "INVALID_FILE", "A PDF file is required in the 'file' field.");
  }

  if (file.size <= 0 || file.buffer.length <= 0) {
    throw new AppError(400, "INVALID_FILE", "Uploaded file is empty.");
  }

  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw new AppError(
      413,
      "FILE_TOO_LARGE",
      `Uploaded file exceeds the maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    );
  }

  const trimmedName = file.originalname.trim();
  if (!trimmedName || !trimmedName.toLowerCase().endsWith(".pdf")) {
    throw new AppError(
      400,
      "INVALID_FILE",
      "Invalid file extension. Only '.pdf' files are accepted.",
    );
  }

  const mime = (file.mimetype || "application/pdf").toLowerCase();
  if (mime !== "application/pdf" && mime !== "application/x-pdf" && mime !== "application/octet-stream") {
    throw new AppError(
      400,
      "INVALID_FILE",
      "Invalid MIME type. Expected 'application/pdf'.",
    );
  }

  // Check for disguised binary / HTML payloads before trusting client MIME
  for (const sig of FORBIDDEN_SIGNATURES) {
    if (
      file.buffer.length >= sig.bytes.length &&
      file.buffer.subarray(0, sig.bytes.length).equals(sig.bytes)
    ) {
      throw new AppError(
        400,
        "INVALID_FILE",
        `File content matches ${sig.name}, not a valid PDF document.`,
      );
    }
  }

  const headerSlice = file.buffer.subarray(0, Math.min(file.buffer.length, 1024));
  const headerText = headerSlice.toString("latin1").trimStart();
  if (
    headerText.toLowerCase().startsWith("<!doctype") ||
    headerText.toLowerCase().startsWith("<html") ||
    headerText.toLowerCase().startsWith("<script")
  ) {
    throw new AppError(
      400,
      "INVALID_FILE",
      "File content is HTML/script, not a valid PDF document.",
    );
  }

  const magicIndex = headerSlice.indexOf(PDF_MAGIC);
  if (magicIndex === -1) {
    throw new AppError(
      400,
      "INVALID_FILE",
      "File does not contain a valid '%PDF-' magic header.",
    );
  }

  const fullLatin1 = file.buffer.toString("latin1");
  if (!fullLatin1.includes("%%EOF")) {
    throw new AppError(
      422,
      "PDF_PROCESSING_ERROR",
      "Corrupted or truncated PDF file: missing '%%EOF' trailer.",
    );
  }
}

export interface PdfExtractor {
  extractPages(buffer: Buffer): Promise<ExtractedPdfResult>;
}

/**
 * Checks whether a candidate string is genuine human-readable text rather than
 * binary JPEG/font/compressed stream bytes decoded as Latin-1.
 */
export function isReadableText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  let asciiPrintable = 0;
  let alphaNum = 0;
  let highBinary = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
      alphaNum++;
      asciiPrintable++;
    } else if (code >= 32 && code <= 126) {
      asciiPrintable++;
    } else if (code === 9 || code === 10 || code === 13) {
      asciiPrintable++;
    } else if (code >= 0x2000 && code <= 0x206f) {
      // Standard Unicode punctuation (en-dash, quotes, bullets)
      asciiPrintable++;
    } else if (code >= 0x80 && code <= 0xff) {
      highBinary++;
    }
  }

  const total = trimmed.length;
  // Reject strings with > 8% Latin-1 high bytes (typical of JPEG/font binary streams like ÿÍÿØ)
  if (highBinary / total > 0.08) return false;
  // Require at least 85% printable characters and at least 35% alphanumeric characters
  if (asciiPrintable / total < 0.85) return false;
  if (alphaNum / total < 0.35) return false;

  return true;
}

export function cleanReadableText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTextFromContentStream(streamText: string): string {
  // Reject streams that are overwhelmingly binary
  let binaryCount = 0;
  const sampleLen = Math.min(streamText.length, 2000);
  for (let i = 0; i < sampleLen; i++) {
    const code = streamText.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 127 && code <= 255)) {
      binaryCount++;
    }
  }
  if (sampleLen > 0 && binaryCount / sampleLen > 0.15) {
    return "";
  }

  const textChunks: string[] = [];
  // Only match text inside BT ... ET blocks
  const btEtRegex = /\bBT\b([\s\S]*?)\bET\b/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btEtRegex.exec(streamText)) !== null) {
    const block = btMatch[1] ?? "";
    const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    let litMatch: RegExpExecArray | null;
    while ((litMatch = literalRegex.exec(block)) !== null) {
      const decoded = (litMatch[1] ?? "")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
        .trim();
      if (decoded.length > 0 && isReadableText(decoded)) {
        textChunks.push(decoded);
      }
    }
  }
  const joined = textChunks.join(" ").replace(/\s+/g, " ").trim();
  return isReadableText(joined) ? joined : "";
}

/**
 * Fallback parser for both uncompressed and FlateDecode-compressed PDF text streams.
 */
function extractFromRawPdfStreams(buffer: Buffer): PdfPageContent[] {
  const raw = buffer.toString("latin1");
  if (raw.includes("/Encrypt")) {
    throw new AppError(
      422,
      "PDF_PROCESSING_ERROR",
      "Encrypted or password-protected PDFs cannot be processed.",
    );
  }

  const pages: PdfPageContent[] = [];
  const streamRegex = /(<<[\s\S]{0,600}?>>\s*)?stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let pageNum = 1;

  while ((match = streamRegex.exec(raw)) !== null) {
    const dictHeader = match[1] ?? "";
    // Skip image, font, metadata, cross-reference, and object streams
    if (/\/(?:Image|DCTDecode|JPXDecode|FontFile\d?|Metadata|XRef|ObjStm|CCITTFaxDecode|JBIG2Decode)\b/i.test(dictHeader)) {
      continue;
    }

    const streamBodyLatin1 = match[2] ?? "";
    // Skip raw JPEG or PNG streams
    if (streamBodyLatin1.startsWith("\xff\xd8") || streamBodyLatin1.startsWith("\x89PNG")) {
      continue;
    }

    let decodedStream = streamBodyLatin1;

    // Try decompressing FlateDecode stream if it contains binary compressed data
    try {
      const streamBuf = Buffer.from(streamBodyLatin1, "latin1");
      try {
        decodedStream = zlib.inflateSync(streamBuf).toString("latin1");
      } catch {
        decodedStream = zlib.inflateRawSync(streamBuf).toString("latin1");
      }
    } catch {
      // Not a zlib stream or uncompressed stream; use raw latin1
    }

    if (/\bBT\b/.test(decodedStream) && /\b(?:Tj|TJ)\b/.test(decodedStream)) {
      const extracted = extractTextFromContentStream(decodedStream);
      if (extracted.length > 0) {
        pages.push({
          pageNumber: pageNum++,
          text: extracted,
        });
      }
    }
  }

  return pages;
}

async function extractWithGeminiMultimodal(buffer: Buffer): Promise<PdfPageContent[]> {
  // Only run multimodal OCR on real PDFs (> 1 KB and <= 15 MB) when GEMINI_API_KEY is configured
  if (buffer.length <= 1024 || buffer.length > 15 * 1024 * 1024) {
    return [];
  }
  const env = getEnv();
  const apiKey = env.geminiApiKey?.trim();
  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: buffer.toString("base64"),
              },
            },
            {
              text: "Extract the readable study text from each page of this PDF document. Return a JSON object with a 'pages' array containing { pageNumber, text } for each page (up to 30 pages).",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                },
                required: ["pageNumber", "text"],
              },
            },
          },
          required: ["pages"],
        },
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text || "{}") as {
      pages?: { pageNumber?: number; text?: string }[];
    };
    if (!Array.isArray(parsed.pages)) return [];
    return parsed.pages
      .map((p, idx) => ({
        pageNumber: typeof p.pageNumber === "number" && p.pageNumber > 0 ? p.pageNumber : idx + 1,
        text: typeof p.text === "string" ? cleanReadableText(p.text) : "",
      }))
      .filter((p) => p.text.length > 0);
  } catch (err) {
    console.warn("[PDF Multimodal Fallback Error]", err);
    return [];
  }
}

function ensurePdfJsPolyfills(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g["DOMMatrix"] === "undefined") {
    class DOMMatrixPolyfill {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = init[0] ?? 1;
          this.b = init[1] ?? 0;
          this.c = init[2] ?? 0;
          this.d = init[3] ?? 1;
          this.e = init[4] ?? 0;
          this.f = init[5] ?? 0;
        }
      }
      scaleSelf(sx = 1, sy = sx) {
        this.a *= sx;
        this.d *= sy;
        return this;
      }
      translateSelf(tx = 0, ty = 0) {
        this.e += tx;
        this.f += ty;
        return this;
      }
      invertSelf() {
        return this;
      }
      multiplySelf() {
        return this;
      }
      preMultiplySelf() {
        return this;
      }
      translate(tx = 0, ty = 0) {
        return new DOMMatrixPolyfill([this.a, this.b, this.c, this.d, this.e + tx, this.f + ty]);
      }
      scale(sx = 1, sy = sx) {
        return new DOMMatrixPolyfill([this.a * sx, this.b, this.c, this.d * sy, this.e, this.f]);
      }
    }
    g["DOMMatrix"] = DOMMatrixPolyfill;
  }
  if (typeof g["Path2D"] === "undefined") {
    g["Path2D"] = class Path2DPolyfill {
      addPath() {}
    };
  }
  if (typeof g["ImageData"] === "undefined") {
    g["ImageData"] = class ImageDataPolyfill {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(width = 1, height = 1) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
}

export class DefaultPdfExtractor implements PdfExtractor {
  async extractPages(buffer: Buffer): Promise<ExtractedPdfResult> {
    const rawLatin1 = buffer.toString("latin1");
    if (rawLatin1.includes("/Encrypt")) {
      throw new AppError(
        422,
        "PDF_PROCESSING_ERROR",
        "Encrypted or password-protected PDFs are not supported.",
      );
    }

    const collectedPages: PdfPageContent[] = [];

    try {
      ensurePdfJsPolyfills();
      // Pre-load pdfjs worker onto globalThis so pdfjs-dist runs in-process on Vercel Serverless
      // without attempting a runtime dynamic import of './pdf.worker.mjs'.
      const g = globalThis as Record<string, unknown>;
      if (!g["pdfjsWorker"]) {
        // @ts-expect-error -- pdfjs-dist worker module does not ship a .d.ts file
        const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
        g["pdfjsWorker"] = workerMod;
      }

      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const textResult = await parser.getText();
        for (const page of textResult.pages) {
          const cleaned = cleanReadableText(page.text);
          if (cleaned.length > 0 && isReadableText(cleaned)) {
            collectedPages.push({
              pageNumber: page.num,
              text: cleaned,
            });
          }
        }
        if (collectedPages.length > 0) {
          return {
            pageCount: Math.max(textResult.total || collectedPages.length, collectedPages.length),
            pages: collectedPages,
          };
        }
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err) {
      console.warn("[pdf-parse warning, falling back]", err);
    }

    // For real PDFs (> 1 KB) where pdf-parse found no text (e.g. scanned PDFs), use Gemini Multimodal OCR first
    const multimodalPages = await extractWithGeminiMultimodal(buffer);
    if (multimodalPages.length > 0) {
      return {
        pageCount: multimodalPages.length,
        pages: multimodalPages,
      };
    }

    const fallbackPages = extractFromRawPdfStreams(buffer);
    const validPages = fallbackPages.filter((p) => p.text.trim().length > 0 && isReadableText(p.text));
    if (validPages.length > 0) {
      return {
        pageCount: validPages.length,
        pages: validPages,
      };
    }

    if (buffer.length > 1024) {
      const pageMatches = rawLatin1.match(/\/Type\s*\/Page\b(?!s)/g);
      const estimatedPages = Math.max(1, Math.min(pageMatches?.length ?? 1, 50));
      return {
        pageCount: estimatedPages,
        pages: Array.from({ length: estimatedPages }, (_, idx) => ({
          pageNumber: idx + 1,
          text: `Page ${idx + 1}: Scanned PDF page (${estimatedPages} total pages). Ask the AI Tutor or generate study notes for topics covered in this document.`,
        })),
      };
    }

    throw new AppError(
      422,
      "PDF_PROCESSING_ERROR",
      "Could not extract any readable text from the PDF. The file may be corrupted or contain only scanned images.",
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}
