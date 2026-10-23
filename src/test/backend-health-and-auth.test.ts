import request from "supertest";
import { describe, expect, it } from "vitest";
import { createBackendApp } from "@/backend/app";
import { getEnv } from "@/backend/config/env";
import {
  detectFirebaseConfigStatus,
  getOrInitializeFirebaseApp,
} from "@/backend/config/firebase";
import { AppError } from "@/backend/errors";
import type { TokenVerifier } from "@/backend/middleware/auth";
import { InMemoryStudyRepository } from "@/backend/services/repository";
import { InMemoryStorageService } from "@/backend/services/storage";

const fakeVerifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    if (token === "token-alice") {
      return { uid: "uid-alice", email: "alice@example.com" };
    }
    if (token === "token-bob") {
      return { uid: "uid-bob", email: "bob@example.com" };
    }
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired Firebase ID token.");
  },
};

describe("Stage 1 & 2: Health Endpoint, Firebase Init & Authentication", () => {
  it("GET /api/health returns service status and configuration state", async () => {
    const env = getEnv({
      NODE_ENV: "test",
      CORS_ORIGIN: "http://localhost:5173",
      FIREBASE_PROJECT_ID: "demo-project",
      FIREBASE_CLIENT_EMAIL: "demo@demo-project.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
      GEMINI_API_KEY: "test-gemini-key",
    });

    const app = createBackendApp({
      env,
      tokenVerifier: fakeVerifier,
      repository: new InMemoryStudyRepository(),
      storage: new InMemoryStorageService(),
    });

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.services.firebase).toEqual({
      configured: true,
      mode: "service-account-env",
    });
    expect(res.body.services.ai.configured).toBe(true);
  });

  it("detects unconfigured Firebase when environment variables are absent and refuses fake init", () => {
    const emptyEnv = getEnv({});
    const status = detectFirebaseConfigStatus(emptyEnv);
    expect(status.configured).toBe(false);
    expect(status.mode).toBe("unconfigured");

    expect(() => getOrInitializeFirebaseApp(emptyEnv)).toThrowError(
      /Firebase Admin credentials are not configured/,
    );
  });

  it("rejects requests without an Authorization header with 401 UNAUTHORIZED", async () => {
    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository: new InMemoryStudyRepository(),
      storage: new InMemoryStorageService(),
    });

    const res = await request(app).get("/api/documents");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects malformed Authorization headers and invalid tokens with 401 UNAUTHORIZED", async () => {
    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository: new InMemoryStudyRepository(),
      storage: new InMemoryStorageService(),
    });

    const basicRes = await request(app)
      .get("/api/documents")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(basicRes.status).toBe(401);
    expect(basicRes.body.error.code).toBe("UNAUTHORIZED");

    const badTokenRes = await request(app)
      .get("/api/documents")
      .set("Authorization", "Bearer expired-or-forged-token");
    expect(badTokenRes.status).toBe(401);
    expect(badTokenRes.body.error.code).toBe("UNAUTHORIZED");
  });

  it("enforces CORS origin restriction and rate limiting", async () => {
    const env = getEnv({
      CORS_ORIGIN: "http://localhost:5173",
    });
    const app = createBackendApp({
      env,
      tokenVerifier: fakeVerifier,
      repository: new InMemoryStudyRepository(),
      storage: new InMemoryStorageService(),
      rateLimitMax: 2,
    });

    // Unauthorized origin is blocked with 403
    const forbiddenOrigin = await request(app)
      .get("/api/health")
      .set("Origin", "https://malicious.example.com");
    expect(forbiddenOrigin.status).toBe(403);
    expect(forbiddenOrigin.body.error.code).toBe("FORBIDDEN");

    // Allowed origin succeeds until rate limit (max: 2) is hit on the 3rd request
    const ok1 = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(ok1.status).toBe(200);

    const ok2 = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(ok2.status).toBe(200);

    const rateLimited = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.body.error.code).toBe("RATE_LIMITED");
  });
});
