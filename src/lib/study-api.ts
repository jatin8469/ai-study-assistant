import { useCallback, useEffect, useState } from "react";
import { apiRequest, useAuth } from "./firebase-client";
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

export function formatAiText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? Object.values(parsed as Record<string, unknown>).find(Array.isArray) ?? [parsed]
          : [];
      if (Array.isArray(items) && items.length > 0) {
        const lines = items
          .map((item, idx) => {
            if (typeof item === "string") return `${idx + 1}. ${item.trim()}`;
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              const mainText =
                obj["question"] ??
                obj["text"] ??
                obj["point"] ??
                obj["definition"] ??
                obj["concept"] ??
                obj["title"] ??
                Object.values(obj).find((v) => typeof v === "string");
              const extraText = obj["answer"] ?? obj["explanation"] ?? obj["description"];
              if (typeof mainText === "string") {
                return typeof extraText === "string" && extraText.trim()
                  ? `${idx + 1}. ${mainText.trim()}\n${extraText.trim()}`
                  : `${idx + 1}. ${mainText.trim()}`;
              }
            }
            return "";
          })
          .filter(Boolean);
        if (lines.length > 0) {
          return lines.join("\n\n");
        }
      }
    } catch {
      // Fall through to text formatting
    }
  }

  return trimmed
    .replace(/([.?!:])\s+(\d+\.\s+[A-Z])/g, "$1\n\n$2")
    .replace(/([.?!:])\s+([•\-*]\s+[A-Z])/g, "$1\n$2");
}

export function enrichHistoryItem(item: ApiHistoryItem): ApiHistoryItem {
  const p = item.payload ?? {};
  const answer = typeof p["answer"] === "string" ? formatAiText(p["answer"]) : undefined;
  const summary = typeof p["summary"] === "string" ? formatAiText(p["summary"]) : undefined;
  const explanation = typeof p["explanation"] === "string" ? formatAiText(p["explanation"]) : undefined;
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
  const { user } = useAuth();
  const [docs, setDocs] = useState<StudyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setDocs([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ documents: ApiDocumentSummary[] }>("/api/documents");
      setDocs(res.documents.map(mapApiDocToStudyDoc));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { docs, setDocs, loading, refresh };
}
