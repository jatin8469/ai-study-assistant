import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

  throw new Error("Please sign in to continue.");
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
  college: "",
  branch: "",
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileTick, setProfileTick] = useState(0);
  const [studentMeta, setStudentMeta] = useState<StudentMeta>(DEFAULT_META);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && !firebaseUser.isAnonymous) {
        setUser(firebaseUser);
        setLoading(false);
        try {
          const res = await apiRequest<{
            profile: {
              displayName?: string;
              email?: string;
              college?: string;
              branch?: string;
            } | null;
          }>("/api/profile");
          if (res.profile) {
            setStudentMeta({
              college: res.profile.college ?? "",
              branch: res.profile.branch ?? "",
            });
          } else {
            await apiRequest("/api/profile", {
              method: "POST",
              body: {
                displayName:
                  firebaseUser.displayName ||
                  firebaseUser.email?.split("@")[0] ||
                  "Student",
                email: firebaseUser.email || "",
                college: "",
                branch: "",
              },
            });
          }
        } catch {
          // ignore if offline
        }
      } else {
        if (firebaseUser?.isAnonymous) {
          await signOut(auth).catch(() => undefined);
        }
        setUser(null);
        setStudentMeta(DEFAULT_META);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setUser(cred.user);
    try {
      await apiRequest("/api/profile", {
        method: "POST",
        body: {
          displayName:
            cred.user.displayName || cred.user.email?.split("@")[0] || "Student",
          email: cred.user.email || email.trim(),
        },
      });
    } catch {
      // ignore
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const auth = getFirebaseClientAuth();
    if (!auth) throw new Error("Auth unavailable");
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const cleanName = name.trim();
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }
    setUser(cred.user);
    setProfileTick((t) => t + 1);
    try {
      await apiRequest("/api/profile", {
        method: "POST",
        body: {
          displayName: cleanName || email.trim().split("@")[0] || "Student",
          email: email.trim(),
          college: "",
          branch: "",
        },
      });
    } catch {
      // ignore
    }
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
    setStudentMeta(DEFAULT_META);
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
      const nextMeta: StudentMeta = {
        college: updates.college !== undefined ? updates.college.trim() : studentMeta.college,
        branch: updates.branch !== undefined ? updates.branch.trim() : studentMeta.branch,
      };
      setStudentMeta(nextMeta);
      try {
        await apiRequest("/api/profile", {
          method: "POST",
          body: {
            displayName: nextName?.trim() || auth?.currentUser?.displayName || "Student",
            email: auth?.currentUser?.email || "",
            college: nextMeta.college,
            branch: nextMeta.branch,
          },
        });
      } catch {
        // ignore
      }
    },
    [studentMeta.branch, studentMeta.college],
  );

  const value = useMemo<AuthContextValue>(() => {
    void profileTick;
    const isAnonymous = false;
    const displayName =
      user?.displayName?.trim() ||
      (user?.email ? user.email.split("@")[0] ?? "Student" : "Student");
    const email = user?.email || "";
    const initials =
      displayName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "ST";

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
