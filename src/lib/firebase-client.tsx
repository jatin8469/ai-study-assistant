import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const firebaseConfig = {
  apiKey:
    (import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined) ??
    "AIzaSyDtJTeXO2T3Lpx6Ic4GZRfI8xdQEYXdFPk",
  authDomain:
    (import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined) ??
    "ai-saas-jatin.firebaseapp.com",
  projectId:
    (import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined) ??
    "ai-saas-jatin",
  storageBucket:
    (import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined) ??
    "ai-saas-jatin.firebasestorage.app",
  messagingSenderId:
    (import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined) ??
    "306198381012",
  appId:
    (import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined) ??
    "1:306198381012:web:59b78fa482650453da5641",
};

let clientApp: FirebaseApp | undefined;
let clientAuth: Auth | undefined;

export function getFirebaseClientAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (!clientApp) {
    const existing = getApps();
    clientApp = existing.length > 0 && existing[0] ? existing[0] : initializeApp(firebaseConfig);
  }
  if (!clientAuth) {
    clientAuth = getAuth(clientApp);
  }
  return clientAuth;
}

export async function getValidIdToken(): Promise<string> {
  const auth = getFirebaseClientAuth();
  if (!auth) {
    throw new Error("Firebase Auth is only available in the browser.");
  }

  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }

  // Wait briefly for existing session restoration before creating an anonymous session
  const restoredUser = await new Promise<User | null>((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 800);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(u);
    });
  });

  if (restoredUser) {
    return await restoredUser.getIdToken();
  }

  const anonCred = await signInAnonymously(auth);
  return await anonCred.user.getIdToken();
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    formData?: FormData;
  } = {},
): Promise<T> {
  const token = await getValidIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let requestBody: BodyInit | null = null;
  if (options.formData) {
    requestBody = options.formData;
  } else if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    requestBody = options.body;
  } else if (typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
    requestBody = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(options.body);
  }

  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    ...(requestBody !== null ? { body: requestBody } : {}),
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };

  if (!res.ok) {
    const msg =
      data?.error?.message ?? `Request failed with status ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export interface StudentMeta {
  college: string;
  branch: string;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  displayName: string;
  email: string;
  initials: string;
  studentMeta: StudentMeta;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInGuest: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateStudentProfile: (updates: {
    name?: string;
    displayName?: string;
    college?: string;
    branch?: string;
  }) => Promise<void>;
}

const DEFAULT_META: StudentMeta = {
  college: "Institute of Engineering & Technology",
  branch: "B.E. Computer Engg · Sem 5",
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileTick, setProfileTick] = useState(0);
  const [studentMeta, setStudentMeta] = useState<StudentMeta>(DEFAULT_META);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("studymate_student_meta");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StudentMeta>;
        setStudentMeta({
          college: parsed.college ?? DEFAULT_META.college,
          branch: parsed.branch ?? DEFAULT_META.branch,
        });
      }
    } catch {
      // ignore storage errors
    }

    const auth = getFirebaseClientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        try {
          const anon = await signInAnonymously(auth);
          setUser(anon.user);
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser(cred.user);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    setUser(cred.user);
    setProfileTick((t) => t + 1);
  }, []);

  const signInGuest = useCallback(async () => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    const cred = await signInAnonymously(auth);
    setUser(cred.user);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseClientAuth();
    if (!auth) return;
    await signOut(auth);
    setUser(null);
  }, []);

  const updateStudentProfile = useCallback(
    async (updates: { name?: string; displayName?: string; college?: string; branch?: string }) => {
      const auth = getFirebaseClientAuth();
      const nextName = updates.displayName ?? updates.name;
      if (auth?.currentUser && nextName !== undefined) {
        await updateProfile(auth.currentUser, {
          displayName: nextName.trim(),
        });
        setProfileTick((t) => t + 1);
      }
      setStudentMeta((prev) => {
        const next: StudentMeta = {
          college: updates.college?.trim() || prev.college,
          branch: updates.branch?.trim() || prev.branch,
        };
        try {
          localStorage.setItem("studymate_student_meta", JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const value = useMemo<AuthContextValue>(() => {
    void profileTick;
    const isAnonymous = Boolean(user?.isAnonymous);
    const displayName =
      user?.displayName?.trim() ||
      (user?.email ? user.email.split("@")[0] ?? "Student" : "Jatin Sharma");
    const email = user?.email || (isAnonymous ? "Guest Session (Signed In)" : "jatin@college.edu");
    const initials =
      displayName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "JS";

    return {
      user,
      loading,
      isAnonymous,
      displayName,
      email,
      initials,
      studentMeta,
      signIn,
      signUp,
      signInGuest,
      resetPassword,
      signOut: signOutUser,
      signOutUser,
      updateStudentProfile,
    };
  }, [
    user,
    loading,
    profileTick,
    studentMeta,
    signIn,
    signUp,
    signInGuest,
    resetPassword,
    signOutUser,
    updateStudentProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
