import { getFirebaseServices } from "../config/firebase";
import type { ServerEnv } from "../config/env";
import type {
  DocumentRecord,
  HistoryItemType,
  HistoryRecord,
  StoredQuizRecord,
  UserProfileRecord,
} from "../types";

export interface ListHistoryOptions {
  type?: HistoryItemType | undefined;
  limit?: number | undefined;
}

export interface StudyRepository {
  // User Profile
  getUserProfile?(uid: string): Promise<UserProfileRecord | null>;
  upsertUserProfile?(profile: UserProfileRecord): Promise<UserProfileRecord>;

  // Documents
  createDocument(doc: DocumentRecord): Promise<DocumentRecord>;
  getDocumentById(id: string): Promise<DocumentRecord | null>;
  listDocumentsByUid(uid: string): Promise<DocumentRecord[]>;
  deleteDocumentById(id: string): Promise<void>;

  // Quizzes (server-side answer key storage)
  saveQuiz(quiz: StoredQuizRecord): Promise<StoredQuizRecord>;
  getQuizById(id: string): Promise<StoredQuizRecord | null>;

  // History (chats, notes, explanations, quiz_attempts, documents)
  createHistoryItem(item: HistoryRecord): Promise<HistoryRecord>;
  getHistoryItemById(id: string): Promise<HistoryRecord | null>;
  listHistoryByUid(uid: string, options?: ListHistoryOptions): Promise<HistoryRecord[]>;
  deleteHistoryItemById(id: string): Promise<void>;
}

const DOCUMENTS_COLLECTION = "documents";
const QUIZZES_COLLECTION = "quizzes";
const HISTORY_COLLECTION = "history";
const USERS_COLLECTION = "users";

export class FirestoreStudyRepository implements StudyRepository {
  private readonly env?: ServerEnv | undefined;

  constructor(env?: ServerEnv) {
    this.env = env;
  }

  private get db() {
    return getFirebaseServices(this.env).firestore;
  }

  async getUserProfile(uid: string): Promise<UserProfileRecord | null> {
    const snap = await this.db.collection(USERS_COLLECTION).doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as UserProfileRecord;
  }

  async upsertUserProfile(profile: UserProfileRecord): Promise<UserProfileRecord> {
    await this.db.collection(USERS_COLLECTION).doc(profile.uid).set(profile, { merge: true });
    return profile;
  }

  async createDocument(doc: DocumentRecord): Promise<DocumentRecord> {
    await this.db.collection(DOCUMENTS_COLLECTION).doc(doc.id).set(doc);
    return doc;
  }

  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    const snap = await this.db.collection(DOCUMENTS_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as DocumentRecord;
  }

  async listDocumentsByUid(uid: string): Promise<DocumentRecord[]> {
    const snap = await this.db
      .collection(DOCUMENTS_COLLECTION)
      .where("uid", "==", uid)
      .get();
    const docs = snap.docs.map((d) => d.data() as DocumentRecord);
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteDocumentById(id: string): Promise<void> {
    await this.db.collection(DOCUMENTS_COLLECTION).doc(id).delete();
  }

  async saveQuiz(quiz: StoredQuizRecord): Promise<StoredQuizRecord> {
    await this.db.collection(QUIZZES_COLLECTION).doc(quiz.id).set(quiz);
    return quiz;
  }

  async getQuizById(id: string): Promise<StoredQuizRecord | null> {
    const snap = await this.db.collection(QUIZZES_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as StoredQuizRecord;
  }

  async createHistoryItem(item: HistoryRecord): Promise<HistoryRecord> {
    await this.db.collection(HISTORY_COLLECTION).doc(item.id).set(item);
    return item;
  }

  async getHistoryItemById(id: string): Promise<HistoryRecord | null> {
    const snap = await this.db.collection(HISTORY_COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as HistoryRecord;
  }

  async listHistoryByUid(uid: string, options?: ListHistoryOptions): Promise<HistoryRecord[]> {
    const snap = await this.db
      .collection(HISTORY_COLLECTION)
      .where("uid", "==", uid)
      .get();
    let items = snap.docs.map((d) => d.data() as HistoryRecord);
    if (options?.type) {
      items = items.filter((i) => i.type === options.type);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = options?.limit ?? 50;
    return items.slice(0, limit);
  }

  async deleteHistoryItemById(id: string): Promise<void> {
    await this.db.collection(HISTORY_COLLECTION).doc(id).delete();
  }
}

export class InMemoryStudyRepository implements StudyRepository {
  public readonly documents = new Map<string, DocumentRecord>();
  public readonly quizzes = new Map<string, StoredQuizRecord>();
  public readonly history = new Map<string, HistoryRecord>();

  async createDocument(doc: DocumentRecord): Promise<DocumentRecord> {
    this.documents.set(doc.id, structuredClone(doc));
    return structuredClone(doc);
  }

  async getDocumentById(id: string): Promise<DocumentRecord | null> {
    const doc = this.documents.get(id);
    return doc ? structuredClone(doc) : null;
  }

  async listDocumentsByUid(uid: string): Promise<DocumentRecord[]> {
    const list: DocumentRecord[] = [];
    for (const doc of this.documents.values()) {
      if (doc.uid === uid) {
        list.push(structuredClone(doc));
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteDocumentById(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async saveQuiz(quiz: StoredQuizRecord): Promise<StoredQuizRecord> {
    this.quizzes.set(quiz.id, structuredClone(quiz));
    return structuredClone(quiz);
  }

  async getQuizById(id: string): Promise<StoredQuizRecord | null> {
    const quiz = this.quizzes.get(id);
    return quiz ? structuredClone(quiz) : null;
  }

  async createHistoryItem(item: HistoryRecord): Promise<HistoryRecord> {
    this.history.set(item.id, structuredClone(item));
    return structuredClone(item);
  }

  async getHistoryItemById(id: string): Promise<HistoryRecord | null> {
    const item = this.history.get(id);
    return item ? structuredClone(item) : null;
  }

  async listHistoryByUid(uid: string, options?: ListHistoryOptions): Promise<HistoryRecord[]> {
    let items: HistoryRecord[] = [];
    for (const item of this.history.values()) {
      if (item.uid === uid) {
        items.push(structuredClone(item));
      }
    }
    if (options?.type) {
      items = items.filter((i) => i.type === options.type);
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = options?.limit ?? 50;
    return items.slice(0, limit);
  }

  async deleteHistoryItemById(id: string): Promise<void> {
    this.history.delete(id);
  }
}
