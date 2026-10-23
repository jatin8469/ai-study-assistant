export interface ServerEnv {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  firebaseServiceAccountJson: string | undefined;
  firebaseProjectId: string | undefined;
  firebaseClientEmail: string | undefined;
  firebasePrivateKey: string | undefined;
  firebaseStorageBucket: string | undefined;
  googleApplicationCredentials: string | undefined;
  geminiApiKey: string | undefined;
  geminiModel: string;
  maxUploadMb: number;
}

export function getEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const portRaw = source["PORT"] ?? "3001";
  const port = Number.parseInt(portRaw, 10);

  const corsRaw = source["CORS_ORIGIN"] ?? "http://localhost:5173";
  const corsOrigins = corsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const maxUploadRaw = source["MAX_UPLOAD_MB"] ?? "25";
  const maxUploadMb = Number.parseInt(maxUploadRaw, 10);

  const rawPrivateKey = source["FIREBASE_PRIVATE_KEY"];
  const firebasePrivateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, "\n") : undefined;

  return {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    nodeEnv: source["NODE_ENV"] ?? "development",
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : ["http://localhost:5173"],
    firebaseServiceAccountJson: source["FIREBASE_SERVICE_ACCOUNT_JSON"],
    firebaseProjectId: source["FIREBASE_PROJECT_ID"],
    firebaseClientEmail: source["FIREBASE_CLIENT_EMAIL"],
    firebasePrivateKey,
    firebaseStorageBucket: source["FIREBASE_STORAGE_BUCKET"],
    googleApplicationCredentials: source["GOOGLE_APPLICATION_CREDENTIALS"],
    geminiApiKey: source["GEMINI_API_KEY"],
    geminiModel: source["GEMINI_MODEL"] ?? "gemini-2.5-flash",
    maxUploadMb: Number.isFinite(maxUploadMb) && maxUploadMb > 0 ? maxUploadMb : 25,
  };
}
