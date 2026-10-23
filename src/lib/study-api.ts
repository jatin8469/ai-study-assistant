import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./firebase-client";
import type { StudyDoc } from "./sample-data";

export interface ApiDocumentSummary {
  id: string;
  uid: string;
  title: string;
  subject: string;
  fileName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  sizeFormatted: string;
  storagePath: string;
  pageCount: number;
  status: "ready" | "processing" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface ApiDocumentDetail extends ApiDocumentSummary {
  pages: { pageNumber: number; text: string }[];
}

export interface ApiHistoryItem {
  id: string;
  uid: string;
  type: "chat" | "note" | "explanation" | "quiz_attempt" | "document";
  title: string;
  documentId?: string;
  documentTitle?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function mapApiDocToStudyDoc(doc: ApiDocumentSummary): StudyDoc {
  return {
    id: doc.id,
    title: doc.title,
    subject: doc.subject,
    pages: doc.pageCount,
    size: doc.sizeFormatted,
    uploaded: formatRelativeTime(doc.createdAt),
    status: doc.status,
  };
}

export function useStudyDocuments() {
  const [docs, setDocs] = useState<StudyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ documents: ApiDocumentSummary[] }>("/api/documents");
      if (res.documents.length === 0) {
        const seeded = await apiRequest<{ documents: ApiDocumentSummary[] }>(
          "/api/documents/seed",
          { method: "POST" },
        );
        setDocs(seeded.documents.map(mapApiDocToStudyDoc));
      } else {
        setDocs(res.documents.map(mapApiDocToStudyDoc));
      }
    } catch {
      // Keep current state if offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { docs, setDocs, loading, refresh };
}
