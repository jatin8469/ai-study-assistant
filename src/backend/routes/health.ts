import { Router } from "express";
import { getEnv, type ServerEnv } from "../config/env";
import { detectFirebaseConfigStatus } from "../config/firebase";

export function createHealthRouter(env: ServerEnv = getEnv()): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const firebaseStatus = detectFirebaseConfigStatus(env);
    const aiConfigured = Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 0);

    res.status(200).json({
      status: "ok",
      service: "studymate-ai-backend",
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      services: {
        firebase: {
          configured: firebaseStatus.configured,
          mode: firebaseStatus.mode,
        },
        ai: {
          configured: aiConfigured,
          model: env.geminiModel,
        },
      },
    });
  });

  return router;
}
