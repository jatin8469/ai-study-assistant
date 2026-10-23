import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./firebase-client";
import { documents as sampleDocs, type StudyDoc } from "./sample-data";

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

export type ApiDocumentItem = ApiDocumentDetail;
export type StudyDocView = StudyDoc;

export interface ApiHistoryItem {
  id: string;
  uid: string;
  type: "chat" | "note" | "explanation" | "quiz_attempt" | "document";
  title: string;
  documentId?: string;
  documentTitle?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  preview?: string;
  score?: number;
  total?: number;
  percent?: number;
  difficulty?: string;
  noteType?: string;
}

export function enrichHistoryItem(item: ApiHistoryItem): ApiHistoryItem {
  const p = item.payload ?? {};
  const answer = typeof p["answer"] === "string" ? p["answer"] : undefined;
  const summary = typeof p["summary"] === "string" ? p["summary"] : undefined;
  const explanation = typeof p["explanation"] === "string" ? p["explanation"] : undefined;
  const previewText = answer ?? summary ?? explanation ?? item.title;
  const score = typeof p["score"] === "number" ? p["score"] : item.score;
  const total = typeof p["total"] === "number" ? p["total"] : item.total;
  const percent = typeof p["percent"] === "number" ? p["percent"] : item.percent;
  const difficulty = typeof p["difficulty"] === "string" ? p["difficulty"] : item.difficulty;
  const noteType = typeof p["style"] === "string" ? p["style"] : item.noteType;

  return {
    ...item,
    preview: previewText.slice(0, 120),
    ...(score !== undefined ? { score } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(percent !== undefined ? { percent } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
    ...(noteType !== undefined ? { noteType } : {}),
  };
}

export async function fetchHistoryList(type?: string): Promise<ApiHistoryItem[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await apiRequest<{ items?: ApiHistoryItem[]; history?: ApiHistoryItem[] }>(
    `/api/history${qs}`,
  );
  const raw = res.items ?? res.history ?? [];
  return raw.map(enrichHistoryItem);
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
  const [docs, setDocs] = useState<StudyDoc[]>(sampleDocs);
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
        if (seeded.documents.length > 0) {
          setDocs(seeded.documents.map(mapApiDocToStudyDoc));
        }
      } else {
        setDocs(res.documents.map(mapApiDocToStudyDoc));
      }
    } catch {
      // Keep sample or current state if offline or in test environment
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { docs, setDocs, loading, refresh };
}
