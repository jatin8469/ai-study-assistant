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

  if (file.mimetype.toLowerCase() !== "application/pdf") {
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
 * Fallback parser for simple/uncompressed PDF text streams (BT ... (text) Tj ... ET)
 * when running in lightweight environments or minimal synthetic PDFs.
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
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  let pageNum = 1;

  while ((match = streamRegex.exec(raw)) !== null) {
    const streamBody = match[1] ?? "";
    const textChunks: string[] = [];

    // Match literal strings in parentheses used with Tj / TJ operators
    const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    let litMatch: RegExpExecArray | null;
    while ((litMatch = literalRegex.exec(streamBody)) !== null) {
      const decoded = (litMatch[1] ?? "")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (decoded.trim().length > 0) {
        textChunks.push(decoded.trim());
      }
    }

    if (textChunks.length > 0) {
      pages.push({
        pageNumber: pageNum++,
        text: textChunks.join(" ").replace(/\s+/g, " ").trim(),
      });
    }
  }

  return pages;
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
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const textResult = await parser.getText();
        for (const page of textResult.pages) {
          collectedPages.push({
            pageNumber: page.num,
            text: page.text.replace(/\s+/g, " ").trim(),
          });
        }
        const nonEmptyPages = collectedPages.filter((p) => p.text.trim().length > 0);
        if (nonEmptyPages.length > 0) {
          return {
            pageCount: Math.max(textResult.total || collectedPages.length, nonEmptyPages.length),
            pages: collectedPages,
          };
        }
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch {
      // Fall back to raw PDF stream extraction if pdf-parse fails on minimal streams
    }

    const fallbackPages = extractFromRawPdfStreams(buffer);
    const validPages = fallbackPages.filter((p) => p.text.trim().length > 0);
    if (validPages.length === 0) {
      throw new AppError(
        422,
        "PDF_PROCESSING_ERROR",
        "Could not extract any readable text from the PDF. The file may be corrupted or contain only scanned images.",
      );
    }

    return {
      pageCount: validPages.length,
      pages: validPages,
    };
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
