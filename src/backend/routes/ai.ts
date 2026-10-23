import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors";
import { assertOwnership, getAuthenticatedUid } from "../middleware/auth";
import type { StudyAiService } from "../services/ai";
import type { StudyRepository } from "../services/repository";
import type {
  ClientQuizQuestion,
  DocumentRecord,
  GradedQuestionResult,
  PdfPageContent,
} from "../types";

const ChatRequestSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
  question: z.string().trim().min(1, "question is required").max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "ai"]),
        text: z.string().trim().min(1).max(8000),
      }),
    )
    .max(20)
    .optional(),
});

const SummarizeRequestSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
  style: z
    .enum(["summary", "chapter", "definitions", "revision"])
    .optional()
    .default("summary"),
  pageRange: z
    .object({
      start: z.number().int().min(1),
      end: z.number().int().min(1),
    })
    .refine((r) => r.end >= r.start, {
      message: "pageRange.end must be greater than or equal to pageRange.start",
    })
    .optional(),
});

const ExplainRequestSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
  topic: z.string().trim().min(1, "topic is required").max(1000),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().default("beginner"),
});

const QuizGenerateRequestSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  count: z.number().int().min(1).max(20).optional().default(5),
});

const QuizGradeRequestSchema = z.object({
  quizId: z.string().trim().min(1, "quizId is required"),
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
});

async function loadOwnedReadyDocument(
  repository: StudyRepository,
  documentId: string,
  uid: string,
): Promise<DocumentRecord> {
  const doc = await repository.getDocumentById(documentId);
  if (!doc) {
    throw new AppError(404, "NOT_FOUND", "Document not found.");
  }
  assertOwnership(doc.uid, uid);
  if (doc.status !== "ready" || !doc.pages || doc.pages.length === 0) {
    throw new AppError(
      422,
      "PDF_PROCESSING_ERROR",
      "Document has no extracted text available for AI processing.",
    );
  }
  return doc;
}

function filterPagesByRange(
  pages: PdfPageContent[],
  range?: { start: number; end: number },
): PdfPageContent[] {
  if (!range) return pages;
  const filtered = pages.filter(
    (p) => p.pageNumber >= range.start && p.pageNumber <= range.end,
  );
  if (filtered.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `Requested page range (${range.start}–${range.end}) does not match any pages in this document.`,
    );
  }
  return filtered;
}

export interface AiRouterDeps {
  repository: StudyRepository;
  aiService: StudyAiService;
}

export function createAiRouter(deps: AiRouterDeps): Router {
  const router = Router();

  // POST /api/ai/chat — grounded document Q&A with page references
  router.post("/chat", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const body = ChatRequestSchema.parse(req.body ?? {});
      const doc = await loadOwnedReadyDocument(deps.repository, body.documentId, uid);

      const aiResult = await deps.aiService.chatWithDocument({
        documentTitle: doc.title,
        pages: doc.pages,
        question: body.question,
        history: body.history,
      });

      const now = new Date().toISOString();
      const historyId = crypto.randomUUID();

      await deps.repository.createHistoryItem({
        id: historyId,
        uid,
        type: "chat",
        title: body.question.slice(0, 120),
        documentId: doc.id,
        documentTitle: doc.title,
        payload: {
          question: body.question,
          answer: aiResult.answer,
          supported: aiResult.supported,
          sources: aiResult.sources,
        },
        createdAt: now,
      });

      res.status(200).json({
        id: historyId,
        documentId: doc.id,
        documentTitle: doc.title,
        question: body.question,
        answer: aiResult.answer,
        supported: aiResult.supported,
        sources: aiResult.sources,
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/ai/summarize — generate structured summary/notes from extracted text
  router.post("/summarize", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const body = SummarizeRequestSchema.parse(req.body ?? {});
      const doc = await loadOwnedReadyDocument(deps.repository, body.documentId, uid);
      const targetPages = filterPagesByRange(doc.pages, body.pageRange);

      const summaryResult = await deps.aiService.summarizeDocument({
        documentTitle: doc.title,
        pages: targetPages,
        style: body.style,
      });

      const now = new Date().toISOString();
      const historyId = crypto.randomUUID();

      await deps.repository.createHistoryItem({
        id: historyId,
        uid,
        type: "note",
        title: summaryResult.title,
        documentId: doc.id,
        documentTitle: doc.title,
        payload: {
          style: body.style,
          summary: summaryResult.summary,
          sections: summaryResult.sections,
          sources: summaryResult.sources,
        },
        createdAt: now,
      });

      res.status(200).json({
        id: historyId,
        documentId: doc.id,
        documentTitle: doc.title,
        style: body.style,
        title: summaryResult.title,
        summary: summaryResult.summary,
        sections: summaryResult.sections,
        sources: summaryResult.sources,
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/ai/explain — generate simple/custom-level explanation grounded in extracted text
  router.post("/explain", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const body = ExplainRequestSchema.parse(req.body ?? {});
      const doc = await loadOwnedReadyDocument(deps.repository, body.documentId, uid);

      const explainResult = await deps.aiService.explainTopic({
        documentTitle: doc.title,
        pages: doc.pages,
        topic: body.topic,
        level: body.level,
      });

      const now = new Date().toISOString();
      const historyId = crypto.randomUUID();

      await deps.repository.createHistoryItem({
        id: historyId,
        uid,
        type: "explanation",
        title: `Explanation: ${body.topic.slice(0, 100)}`,
        documentId: doc.id,
        documentTitle: doc.title,
        payload: {
          topic: body.topic,
          level: body.level,
          explanation: explainResult.explanation,
          keyTakeaways: explainResult.keyTakeaways,
          supported: explainResult.supported,
          sources: explainResult.sources,
        },
        createdAt: now,
      });

      res.status(200).json({
        id: historyId,
        documentId: doc.id,
        documentTitle: doc.title,
        topic: body.topic,
        level: body.level,
        explanation: explainResult.explanation,
        keyTakeaways: explainResult.keyTakeaways,
        supported: explainResult.supported,
        sources: explainResult.sources,
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/ai/quiz — generate validated MCQs, persist answer key on server, return client questions
  router.post("/quiz", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const body = QuizGenerateRequestSchema.parse(req.body ?? {});
      const doc = await loadOwnedReadyDocument(deps.repository, body.documentId, uid);

      const questions = await deps.aiService.generateQuiz({
        documentTitle: doc.title,
        pages: doc.pages,
        difficulty: body.difficulty,
        count: body.count,
      });

      const now = new Date().toISOString();
      const quizId = crypto.randomUUID();

      await deps.repository.saveQuiz({
        id: quizId,
        uid,
        documentId: doc.id,
        documentTitle: doc.title,
        difficulty: body.difficulty,
        questions,
        createdAt: now,
      });

      // Strip correctIndex and explanation before sending to browser
      const clientQuestions: ClientQuizQuestion[] = questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        source: q.source,
      }));

      res.status(201).json({
        quizId,
        documentId: doc.id,
        documentTitle: doc.title,
        difficulty: body.difficulty,
        count: clientQuestions.length,
        questions: clientQuestions,
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/ai/quiz/grade — grade submitted answers strictly using server-stored answer key
  router.post("/quiz/grade", async (req, res, next) => {
    try {
      const uid = getAuthenticatedUid(req);
      const body = QuizGradeRequestSchema.parse(req.body ?? {});

      const storedQuiz = await deps.repository.getQuizById(body.quizId);
      if (!storedQuiz) {
        throw new AppError(404, "NOT_FOUND", "Quiz not found.");
      }

      assertOwnership(storedQuiz.uid, uid);

      let score = 0;
      const results: GradedQuestionResult[] = storedQuiz.questions.map((q) => {
        const submitted = body.answers[q.id];
        const selectedIndex = typeof submitted === "number" ? submitted : null;
        const isCorrect = selectedIndex !== null && selectedIndex === q.correctIndex;
        if (isCorrect) {
          score += 1;
        }
        return {
          questionId: q.id,
          question: q.question,
          options: q.options,
          selectedIndex,
          correctIndex: q.correctIndex,
          isCorrect,
          explanation: q.explanation,
          source: q.source,
        };
      });

      const total = storedQuiz.questions.length;
      const percent = total > 0 ? Math.round((score / total) * 100) : 0;
      const now = new Date().toISOString();
      const attemptId = crypto.randomUUID();

      await deps.repository.createHistoryItem({
        id: attemptId,
        uid,
        type: "quiz_attempt",
        title: `Quiz: ${storedQuiz.documentTitle} (${storedQuiz.difficulty})`,
        documentId: storedQuiz.documentId,
        documentTitle: storedQuiz.documentTitle,
        payload: {
          quizId: storedQuiz.id,
          difficulty: storedQuiz.difficulty,
          score,
          total,
          percent,
          results,
        },
        createdAt: now,
      });

      res.status(200).json({
        attemptId,
        quizId: storedQuiz.id,
        documentId: storedQuiz.documentId,
        documentTitle: storedQuiz.documentTitle,
        difficulty: storedQuiz.difficulty,
        score,
        total,
        percent,
        results,
        createdAt: now,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
