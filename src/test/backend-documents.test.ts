import request from "supertest";
import { describe, expect, it } from "vitest";
import { createBackendApp } from "@/backend/app";
import { getEnv } from "@/backend/config/env";
import { AppError } from "@/backend/errors";
import type { TokenVerifier } from "@/backend/middleware/auth";
import { DefaultPdfExtractor } from "@/backend/services/pdf";
import { InMemoryStudyRepository } from "@/backend/services/repository";
import { InMemoryStorageService } from "@/backend/services/storage";

const fakeVerifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    if (token === "token-alice") return { uid: "uid-alice", email: "alice@example.com" };
    if (token === "token-bob") return { uid: "uid-bob", email: "bob@example.com" };
    throw new AppError(401, "UNAUTHORIZED", "Invalid token");
  },
};

function createMultiPagePdfBuffer(pagesText: string[]): Buffer {
  const streams = pagesText
    .map(
      (text, idx) =>
        `${idx + 1} 0 obj\n<< /Length ${text.length + 20} >>\nstream\nBT (${text}) Tj ET\nendstream\nendobj`,
    )
    .join("\n");
  const content = `%PDF-1.4\n${streams}\n%%EOF\n`;
  return Buffer.from(content, "latin1");
}

describe("Stage 3: Document Upload, Validation, Page-Boundary Extraction & Ownership", () => {
  it("uploads a valid PDF, preserves page boundaries, stores in Firebase Storage & Firestore, and records history", async () => {
    const repository = new InMemoryStudyRepository();
    const storage = new InMemoryStorageService();
    const app = createBackendApp({
      env: getEnv({ MAX_UPLOAD_MB: "5" }),
      tokenVerifier: fakeVerifier,
      repository,
      storage,
      pdfExtractor: new DefaultPdfExtractor(),
    });

    const pdfBuffer = createMultiPagePdfBuffer([
      "Page 1: Process synchronization and critical section problem.",
      "Page 2: Semaphores and mutex locks prevent race conditions.",
    ]);

    const uploadRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .field("title", "Operating Systems Ch. 6")
      .field("subject", "Operating Systems")
      .attach("file", pdfBuffer, {
        filename: "os-ch6.pdf",
        contentType: "application/pdf",
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.document.title).toBe("Operating Systems Ch. 6");
    expect(uploadRes.body.document.subject).toBe("Operating Systems");
    expect(uploadRes.body.document.pageCount).toBe(2);
    expect(uploadRes.body.document.uid).toBe("uid-alice");

    // Verify stored document preserves page boundaries
    const storedDoc = await repository.getDocumentById(uploadRes.body.document.id);
    expect(storedDoc?.pages).toEqual([
      {
        pageNumber: 1,
        text: "Page 1: Process synchronization and critical section problem.",
      },
      {
        pageNumber: 2,
        text: "Page 2: Semaphores and mutex locks prevent race conditions.",
      },
    ]);
    expect(storage.files.size).toBe(1);
  });

  it("rejects non-PDF extensions, spoofed MIME types (HTML/EXE/ZIP disguised as PDF), and oversized files", async () => {
    const repository = new InMemoryStudyRepository();
    const storage = new InMemoryStorageService();
    const app = createBackendApp({
      env: getEnv({ MAX_UPLOAD_MB: "1" }),
      tokenVerifier: fakeVerifier,
      repository,
      storage,
    });

    // 1. Disguised HTML file with .pdf extension and application/pdf MIME
    const htmlBuffer = Buffer.from("<!DOCTYPE html><html><body>Not a PDF</body></html>", "utf8");
    const htmlRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", htmlBuffer, {
        filename: "disguised.pdf",
        contentType: "application/pdf",
      });
    expect(htmlRes.status).toBe(400);
    expect(htmlRes.body.error.code).toBe("INVALID_FILE");

    // 2. Disguised Windows executable (MZ header) with .pdf extension and application/pdf MIME
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const exeRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", exeBuffer, {
        filename: "malware.pdf",
        contentType: "application/pdf",
      });
    expect(exeRes.status).toBe(400);
    expect(exeRes.body.error.code).toBe("INVALID_FILE");

    // 3. Invalid extension (.txt)
    const txtRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", createMultiPagePdfBuffer(["Hello"]), {
        filename: "notes.txt",
        contentType: "application/pdf",
      });
    expect(txtRes.status).toBe(400);
    expect(txtRes.body.error.code).toBe("INVALID_FILE");

    // 4. Corrupted PDF missing %%EOF trailer
    const corruptedPdf = Buffer.from("%PDF-1.4\n1 0 obj\nstream\nBT (text) Tj ET\nendstream", "latin1");
    const corruptRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", corruptedPdf, {
        filename: "corrupt.pdf",
        contentType: "application/pdf",
      });
    expect(corruptRes.status).toBe(422);
    expect(corruptRes.body.error.code).toBe("PDF_PROCESSING_ERROR");

    // 5. Image-only / empty PDF with no extractable text
    const emptyTextPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF\n", "latin1");
    const emptyTextRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", emptyTextPdf, {
        filename: "scanned.pdf",
        contentType: "application/pdf",
      });
    expect(emptyTextRes.status).toBe(422);
    expect(emptyTextRes.body.error.code).toBe("PDF_PROCESSING_ERROR");
  });

  it("enforces strict ownership on GET /api/documents and DELETE /api/documents/:id", async () => {
    const repository = new InMemoryStudyRepository();
    const storage = new InMemoryStorageService();
    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage,
    });

    // Alice uploads a document
    const uploadRes = await request(app)
      .post("/api/documents")
      .set("Authorization", "Bearer token-alice")
      .attach("file", createMultiPagePdfBuffer(["Alice private study material"]), {
        filename: "alice.pdf",
        contentType: "application/pdf",
      });
    const docId = uploadRes.body.document.id as string;

    // Bob lists documents -> sees 0 documents
    const bobList = await request(app)
      .get("/api/documents")
      .set("Authorization", "Bearer token-bob");
    expect(bobList.status).toBe(200);
    expect(bobList.body.documents).toHaveLength(0);

    // Bob tries to delete Alice's document -> 403 FORBIDDEN
    const bobDelete = await request(app)
      .delete(`/api/documents/${docId}`)
      .set("Authorization", "Bearer token-bob");
    expect(bobDelete.status).toBe(403);
    expect(bobDelete.body.error.code).toBe("FORBIDDEN");

    // Alice deletes her own document -> 200 OK
    const aliceDelete = await request(app)
      .delete(`/api/documents/${docId}`)
      .set("Authorization", "Bearer token-alice");
    expect(aliceDelete.status).toBe(200);
    expect(aliceDelete.body.deleted).toBe(true);
    expect(storage.files.size).toBe(0);
  });
});
