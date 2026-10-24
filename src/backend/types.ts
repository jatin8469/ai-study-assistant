export interface AuthenticatedUser {
  uid: string;
  email?: string | undefined;
}

export interface PdfPageContent {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfResult {
  pageCount: number;
  pages: PdfPageContent[];
}

export type DocumentStatus = "ready" | "processing" | "failed";

export interface DocumentRecord {
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
  pages: PdfPageContent[];
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export type DocumentSummary = Omit<DocumentRecord, "pages">;

export interface StoredQuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  source: string;
}

export type ClientQuizQuestion = Omit<StoredQuizQuestion, "correctIndex" | "explanation">;

export interface StoredQuizRecord {
  id: string;
  uid: string;
  documentId: string;
  documentTitle: string;
  difficulty: "easy" | "medium" | "hard";
  questions: StoredQuizQuestion[];
  createdAt: string;
}

export interface GradedQuestionResult {
  questionId: string;
  question: string;
  options: [string, string, string, string];
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
  source: string;
}

export type HistoryItemType = "chat" | "note" | "explanation" | "quiz_attempt" | "document";

export interface HistoryRecord {
  id: string;
  uid: string;
  type: HistoryItemType;
  title: string;
  documentId?: string | undefined;
  documentTitle?: string | undefined;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  college: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
}
