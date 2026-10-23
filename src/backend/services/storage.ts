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
  }

  async deletePdf(storagePath: string): Promise<void> {
    const { storage } = getFirebaseServices(this.env);
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.delete({ ignoreNotFound: true });
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
