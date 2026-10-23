import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors";
import { assertOwnership, getAuthenticatedUid } from "../middleware/auth";
import type { StudyRepository } from "../services/repository";

const HistoryQuerySchema = z.object({
  type: z
    .enum(["chat", "note", "explanation", "quiz_attempt", "document"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export interface HistoryRouterDeps {
  repository: StudyRepository;
}

export function createHistoryRouter(deps: HistoryRouterDeps): Router {
  const router = Router();

  // GET /api/history — list authenticated user's history items
  router.get("/", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const query = HistoryQuerySchema.parse(req.query ?? {});
      const items = await deps.repository.listHistoryByUid(uid, {
        type: query.type,
        limit: query.limit,
      });
      res.status(200).json({
        items: items.filter((item) => item.uid === uid),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/history/:id — retrieve a single history item if owned by user
  router.get("/:id", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const id = (req.params["id"] ?? "").trim();
      if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "History item ID is required.");
      }

      const item = await deps.repository.getHistoryItemById(id);
      if (!item) {
        throw new AppError(404, "NOT_FOUND", "History item not found.");
      }

      assertOwnership(item.uid, uid);

      res.status(200).json({ item });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/history/:id — delete a single history item if owned by user
  router.delete("/:id", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const id = (req.params["id"] ?? "").trim();
      if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "History item ID is required.");
      }

      const item = await deps.repository.getHistoryItemById(id);
      if (!item) {
        throw new AppError(404, "NOT_FOUND", "History item not found.");
      }

      assertOwnership(item.uid, uid);

      await deps.repository.deleteHistoryItemById(id);

      res.status(200).json({
        deleted: true,
        id,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
