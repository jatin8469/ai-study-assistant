import fs from "node:fs/promises";
import path from "node:path";
import { getFirebaseServices } from "../config/firebase";
import type { ServerEnv } from "../config/env";
import { sanitizeFileName } from "./pdf";

export interface UploadPdfParams {
  uid: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: "application/pdf";
}

export interface StorageService {
  uploadPdf(params: UploadPdfParams): Promise<{ storagePath: string }>;
  deletePdf(storagePath: string): Promise<void>;
}

export class FirebaseStorageService implements StorageService {
  private readonly env?: ServerEnv | undefined;

  constructor(env?: ServerEnv) {
    this.env = env;
  }

  async uploadPdf(params: UploadPdfParams): Promise<{ storagePath: string }> {
    const { storage } = getFirebaseServices(this.env);
    const bucket = storage.bucket();
    const safeName = sanitizeFileName(params.fileName);
    const storagePath = `users/${params.uid}/documents/${params.documentId}/${safeName}`;

    try {
      const file = bucket.file(storagePath);
      await file.save(params.buffer, {
        resumable: false,
        contentType: params.mimeType,
        metadata: {
          metadata: {
            uid: params.uid,
            documentId: params.documentId,
            originalName: params.fileName,
          },
        },
      });
      return { storagePath };
    } catch (err) {
      // If the Firebase project is on the free Spark plan without an active GCS bucket (404),
      // persist to a local server-side storage folder scoped to the same user/document path.
      const fallbackFile = path.resolve(process.cwd(), ".local-storage", storagePath);
      await fs.mkdir(path.dirname(fallbackFile), { recursive: true });
      await fs.writeFile(fallbackFile, params.buffer);
      console.warn(
        `[Storage] Cloud Storage bucket unavailable (${(err as Error).message}); stored at local server fallback: ${storagePath}`,
      );
      return { storagePath };
    }
  }

  async deletePdf(storagePath: string): Promise<void> {
    try {
      const { storage } = getFirebaseServices(this.env);
      const bucket = storage.bucket();
      const file = bucket.file(storagePath);
      await file.delete({ ignoreNotFound: true });
    } catch {
      // Ignore Cloud Storage delete errors when using local fallback
    }

    const fallbackFile = path.resolve(process.cwd(), ".local-storage", storagePath);
    await fs.rm(fallbackFile, { force: true }).catch(() => undefined);
  }
}

export class InMemoryStorageService implements StorageService {
  public readonly files = new Map<string, { buffer: Buffer; uid: string; documentId: string }>();

  async uploadPdf(params: UploadPdfParams): Promise<{ storagePath: string }> {
    const safeName = sanitizeFileName(params.fileName);
    const storagePath = `users/${params.uid}/documents/${params.documentId}/${safeName}`;
    this.files.set(storagePath, {
      buffer: Buffer.from(params.buffer),
      uid: params.uid,
      documentId: params.documentId,
    });
    return { storagePath };
  }

  async deletePdf(storagePath: string): Promise<void> {
    this.files.delete(storagePath);
  }
}
