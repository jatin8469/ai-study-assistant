import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getEnv, type ServerEnv } from "./env";
import { AppError } from "../errors";

export interface FirebaseStatus {
  configured: boolean;
  mode: "service-account-json" | "service-account-env" | "application-default" | "unconfigured";
  projectId?: string | undefined;
  storageBucket?: string | undefined;
}

export function detectFirebaseConfigStatus(env: ServerEnv = getEnv()): FirebaseStatus {
  if (env.firebaseServiceAccountJson) {
    try {
      const parsed = JSON.parse(env.firebaseServiceAccountJson) as { project_id?: string };
      return {
        configured: true,
        mode: "service-account-json",
        projectId: parsed.project_id ?? env.firebaseProjectId,
        storageBucket: env.firebaseStorageBucket,
      };
    } catch {
      return { configured: false, mode: "unconfigured" };
    }
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return {
      configured: true,
      mode: "service-account-env",
      projectId: env.firebaseProjectId,
      storageBucket: env.firebaseStorageBucket,
    };
  }

  if (env.googleApplicationCredentials) {
    return {
      configured: true,
      mode: "application-default",
      projectId: env.firebaseProjectId,
      storageBucket: env.firebaseStorageBucket,
    };
  }

  return {
    configured: false,
    mode: "unconfigured",
  };
}

export function getOrInitializeFirebaseApp(env: ServerEnv = getEnv()): App {
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    return existing[0];
  }

  if (env.firebaseServiceAccountJson) {
    let parsed: ServiceAccount;
    try {
      parsed = JSON.parse(env.firebaseServiceAccountJson) as ServiceAccount;
    } catch {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.",
      );
    }
    return initializeApp({
      credential: cert(parsed),
      ...(env.firebaseStorageBucket ? { storageBucket: env.firebaseStorageBucket } : {}),
    });
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return initializeApp({
      credential: cert({
        projectId: env.firebaseProjectId,
        clientEmail: env.firebaseClientEmail,
        privateKey: env.firebasePrivateKey,
      }),
      projectId: env.firebaseProjectId,
      ...(env.firebaseStorageBucket ? { storageBucket: env.firebaseStorageBucket } : {}),
    });
  }

  if (env.googleApplicationCredentials) {
    return initializeApp({
      credential: applicationDefault(),
      ...(env.firebaseProjectId ? { projectId: env.firebaseProjectId } : {}),
      ...(env.firebaseStorageBucket ? { storageBucket: env.firebaseStorageBucket } : {}),
    });
  }

  throw new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "Firebase Admin credentials are not configured on the server.",
  );
}

export interface FirebaseServices {
  auth: Auth;
  firestore: Firestore;
  storage: Storage;
}

export function getFirebaseServices(env: ServerEnv = getEnv()): FirebaseServices {
  const app = getOrInitializeFirebaseApp(env);
  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}
