import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import { getEnv, type ServerEnv } from "./config/env";
import { AppError, errorHandler } from "./errors";
import {
  createAuthMiddleware,
  FirebaseAdminTokenVerifier,
  type TokenVerifier,
} from "./middleware/auth";
import { createAiRouter } from "./routes/ai";
import { createDocumentsRouter } from "./routes/documents";
import { createHealthRouter } from "./routes/health";
import { createHistoryRouter } from "./routes/history";
import {
  GoogleGenAiClient,
  StudyAiService,
  type AiModelClient,
} from "./services/ai";
import { DefaultPdfExtractor, type PdfExtractor } from "./services/pdf";
import {
  FirestoreStudyRepository,
  type StudyRepository,
} from "./services/repository";
import {
  FirebaseStorageService,
  type StorageService,
} from "./services/storage";

export interface CreateAppOptions {
  env?: ServerEnv | undefined;
  tokenVerifier?: TokenVerifier | undefined;
  repository?: StudyRepository | undefined;
  storage?: StorageService | undefined;
  pdfExtractor?: PdfExtractor | undefined;
  aiClient?: AiModelClient | undefined;
  rateLimitMax?: number | undefined;
  aiRateLimitMax?: number | undefined;
}

export function createBackendApp(options: CreateAppOptions = {}): Express {
  const env = options.env ?? getEnv();
  const tokenVerifier = options.tokenVerifier ?? new FirebaseAdminTokenVerifier(env);
  const repository = options.repository ?? new FirestoreStudyRepository(env);
  const storage = options.storage ?? new FirebaseStorageService(env);
  const pdfExtractor = options.pdfExtractor ?? new DefaultPdfExtractor();
  const aiClient = options.aiClient ?? new GoogleGenAiClient(env);
  const aiService = new StudyAiService(aiClient);

  const app = express();
  app.disable("x-powered-by");

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  // Restrict CORS to configured client origin(s)
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(requestOrigin)) {
          callback(null, true);
          return;
        }
        callback(
          new AppError(403, "FORBIDDEN", "Origin is not allowed by CORS policy."),
        );
      },
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.rateLimitMax ?? 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please wait before trying again.",
        ),
      );
    },
  });

  // Stricter rate limit for AI generation endpoints
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.aiRateLimitMax ?? 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "AI request rate limit exceeded. Please wait before generating more content.",
        ),
      );
    },
  });

  app.use("/api", apiLimiter);

  // Sensible body size limits for JSON & URL-encoded payloads
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));

  // Public health check
  app.use("/api/health", createHealthRouter(env));

  // Authenticated API routes
  const requireAuth = createAuthMiddleware(tokenVerifier);

  app.get("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
      const profile = repository.getUserProfile ? await repository.getUserProfile(uid) : null;
      res.status(200).json({ profile });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      if (!uid) throw new AppError(401, "UNAUTHORIZED", "Authentication required.");
      const rawBody = (req.body ?? {}) as Record<string, unknown>;
      const existing = repository.getUserProfile ? await repository.getUserProfile(uid) : null;
      const now = new Date().toISOString();
      const record = {
        uid,
        email:
          typeof rawBody["email"] === "string" && rawBody["email"].trim()
            ? rawBody["email"].trim()
            : existing?.email ?? req.user?.email ?? "",
        displayName:
          typeof rawBody["displayName"] === "string" && rawBody["displayName"].trim()
            ? rawBody["displayName"].trim()
            : existing?.displayName ?? "Student",
        college:
          typeof rawBody["college"] === "string"
            ? rawBody["college"].trim()
            : existing?.college ?? "",
        branch:
          typeof rawBody["branch"] === "string"
            ? rawBody["branch"].trim()
            : existing?.branch ?? "",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (repository.upsertUserProfile) {
        await repository.upsertUserProfile(record);
      }
      res.status(200).json({ profile: record });
    } catch (err) {
      next(err);
    }
  });

  app.use(
    "/api/documents",
    requireAuth,
    createDocumentsRouter({
      repository,
      storage,
      pdfExtractor,
      maxUploadBytes: env.maxUploadMb * 1024 * 1024,
    }),
  );

  app.use(
    "/api/ai",
    requireAuth,
    aiLimiter,
    createAiRouter({
      repository,
      aiService,
    }),
  );

  app.use(
    "/api/history",
    requireAuth,
    createHistoryRouter({
      repository,
    }),
  );

  // 404 handler for unmatched API routes
  app.use("/api", (_req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", "Requested API endpoint does not exist."));
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
