import fs from "node:fs";
import path from "node:path";

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

let dotEnvLoaded = false;

function ensureDotEnvLoaded(): void {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;

      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore .env read errors and rely on process.env
  }
}

export function getEnv(source?: Record<string, string | undefined>): ServerEnv {
  if (!source) {
    ensureDotEnvLoaded();
  }
  const envSource = source ?? process.env;

  const portRaw = envSource["PORT"] ?? "3001";
  const port = Number.parseInt(portRaw, 10);

  const corsRaw = envSource["CORS_ORIGIN"] ?? "http://localhost:5173";
  const corsOrigins = corsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const maxUploadRaw = envSource["MAX_UPLOAD_MB"] ?? "25";
  const maxUploadMb = Number.parseInt(maxUploadRaw, 10);

  const rawPrivateKey = envSource["FIREBASE_PRIVATE_KEY"];
  const firebasePrivateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, "\n") : undefined;

  return {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    nodeEnv: envSource["NODE_ENV"] ?? "development",
    corsOrigins: corsOrigins.length > 0 ? corsOrigins : ["http://localhost:5173"],
    firebaseServiceAccountJson: envSource["FIREBASE_SERVICE_ACCOUNT_JSON"],
    firebaseProjectId: envSource["FIREBASE_PROJECT_ID"],
    firebaseClientEmail: envSource["FIREBASE_CLIENT_EMAIL"],
    firebasePrivateKey,
    firebaseStorageBucket: envSource["FIREBASE_STORAGE_BUCKET"],
    googleApplicationCredentials: envSource["GOOGLE_APPLICATION_CREDENTIALS"],
    geminiApiKey: envSource["GEMINI_API_KEY"],
    geminiModel: envSource["GEMINI_MODEL"] ?? "gemini-2.5-flash",
    maxUploadMb: Number.isFinite(maxUploadMb) && maxUploadMb > 0 ? maxUploadMb : 25,
  };
}
