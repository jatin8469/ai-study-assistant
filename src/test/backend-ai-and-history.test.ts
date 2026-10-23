import request from "supertest";
import { describe, expect, it } from "vitest";
import { createBackendApp } from "@/backend/app";
import { AppError } from "@/backend/errors";
import type { TokenVerifier } from "@/backend/middleware/auth";
import type { AiGenerateJsonRequest, AiModelClient } from "@/backend/services/ai";
import { InMemoryStudyRepository } from "@/backend/services/repository";
import { InMemoryStorageService } from "@/backend/services/storage";
import type { DocumentRecord } from "@/backend/types";

const fakeVerifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    if (token === "token-alice") return { uid: "uid-alice", email: "alice@example.com" };
    if (token === "token-bob") return { uid: "uid-bob", email: "bob@example.com" };
    throw new AppError(401, "UNAUTHORIZED", "Invalid token");
  },
};

function seedAliceDocument(repo: InMemoryStudyRepository): DocumentRecord {
  const doc: DocumentRecord = {
    id: "doc-os-1",
    uid: "uid-alice",
    title: "Operating Systems — Galvin",
    subject: "Operating Systems",
    fileName: "os-galvin.pdf",
    mimeType: "application/pdf",
    sizeBytes: 102400,
    sizeFormatted: "100.0 KB",
    storagePath: "users/uid-alice/documents/doc-os-1/os-galvin.pdf",
    pageCount: 2,
    pages: [
      {
        pageNumber: 1,
        text: "Round Robin scheduling assigns a fixed time quantum to each process in a circular queue.",
      },
      {
        pageNumber: 2,
        text: "Shortest Job First (SJF) minimizes average waiting time but can cause starvation for long processes.",
      },
    ],
    status: "ready",
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
  };
  repo.documents.set(doc.id, doc);
  return doc;
}

describe("Stage 4 & 5: AI Endpoints, Quiz Schema Validation & Server-Side Grading, and History", () => {
  it("POST /api/ai/chat grounds Q&A in document pages, returns page citations, and handles unsupported questions", async () => {
    const repository = new InMemoryStudyRepository();
    seedAliceDocument(repository);

    let capturedPrompt = "";
    let capturedSystemInstruction = "";

    const mockAiClient: AiModelClient = {
      async generateStructuredJson(req: AiGenerateJsonRequest) {
        capturedPrompt = req.prompt;
        capturedSystemInstruction = req.systemInstruction;
        if (req.prompt.includes("quantum chromodynamics")) {
          return JSON.stringify({
            answer: "This topic is not supported by the supplied Operating Systems material.",
            supported: false,
            sources: [],
          });
        }
        return JSON.stringify({
          answer:
            "Round Robin assigns a fixed time quantum to each ready process in a circular queue.",
          supported: true,
          sources: ["Operating Systems — Galvin, p. 1"],
        });
      },
    };

    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage: new InMemoryStorageService(),
      aiClient: mockAiClient,
    });

    // Supported question
    const res1 = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", "Bearer token-alice")
      .send({
        documentId: "doc-os-1",
        question: "How does Round Robin scheduling work?",
      });

    expect(res1.status).toBe(200);
    expect(res1.body.supported).toBe(true);
    expect(res1.body.sources).toEqual(["Operating Systems — Galvin, p. 1"]);
    expect(capturedPrompt).toContain("[Operating Systems — Galvin — Page 1]");
    expect(capturedPrompt).toContain("[Operating Systems — Galvin — Page 2]");
    expect(capturedSystemInstruction).toContain("not supported by the provided material");

    // Unsupported question
    const res2 = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", "Bearer token-alice")
      .send({
        documentId: "doc-os-1",
        question: "Explain quantum chromodynamics.",
      });
    expect(res2.status).toBe(200);
    expect(res2.body.supported).toBe(false);
    expect(res2.body.sources).toEqual([]);

    // Ownership check: Bob cannot chat with Alice's document
    const bobRes = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", "Bearer token-bob")
      .send({
        documentId: "doc-os-1",
        question: "How does Round Robin work?",
      });
    expect(bobRes.status).toBe(403);
    expect(bobRes.body.error.code).toBe("FORBIDDEN");
  });

  it("POST /api/ai/summarize and POST /api/ai/explain generate grounded study outputs and persist history", async () => {
    const repository = new InMemoryStudyRepository();
    seedAliceDocument(repository);

    const mockAiClient: AiModelClient = {
      async generateStructuredJson(req: AiGenerateJsonRequest) {
        if (req.prompt.includes("Summarize")) {
          return JSON.stringify({
            title: "CPU Scheduling Summary",
            summary: "Overview of Round Robin and SJF scheduling.",
            sections: [
              {
                heading: "Core Algorithms",
                bullets: [
                  "Round Robin uses a fixed time quantum.",
                  "SJF minimizes average waiting time.",
                ],
              },
            ],
            sources: ["Operating Systems — Galvin, p. 1", "Operating Systems — Galvin, p. 2"],
          });
        }
        return JSON.stringify({
          explanation: "Starvation occurs in SJF when short jobs continually preempt long jobs.",
          keyTakeaways: ["SJF favors short bursts", "Aging prevents starvation"],
          supported: true,
          sources: ["Operating Systems — Galvin, p. 2"],
        });
      },
    };

    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage: new InMemoryStorageService(),
      aiClient: mockAiClient,
    });

    const sumRes = await request(app)
      .post("/api/ai/summarize")
      .set("Authorization", "Bearer token-alice")
      .send({ documentId: "doc-os-1", style: "summary" });
    expect(sumRes.status).toBe(200);
    expect(sumRes.body.title).toBe("CPU Scheduling Summary");

    const expRes = await request(app)
      .post("/api/ai/explain")
      .set("Authorization", "Bearer token-alice")
      .send({ documentId: "doc-os-1", topic: "Starvation in SJF", level: "beginner" });
    expect(expRes.status).toBe(200);
    expect(expRes.body.supported).toBe(true);
    expect(expRes.body.sources).toContain("Operating Systems — Galvin, p. 2");
  });

  it("POST /api/ai/quiz validates schema, strips answer key for client, and POST /api/ai/quiz/grade grades on server", async () => {
    const repository = new InMemoryStudyRepository();
    seedAliceDocument(repository);

    const mockAiClient: AiModelClient = {
      async generateStructuredJson() {
        return JSON.stringify({
          questions: [
            {
              question: "Which algorithm uses a fixed time quantum?",
              options: ["FCFS", "Round Robin", "SJF", "Priority"],
              correctIndex: 1,
              explanation: "Round Robin assigns a fixed time quantum in a circular queue.",
              source: "Operating Systems — Galvin, p. 1",
            },
            {
              question: "Which algorithm can cause starvation for long processes?",
              options: ["Round Robin", "FIFO", "Shortest Job First", "None"],
              correctIndex: 2,
              explanation: "SJF always selects shortest bursts, starving long jobs.",
              source: "Operating Systems — Galvin, p. 2",
            },
          ],
        });
      },
    };

    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage: new InMemoryStorageService(),
      aiClient: mockAiClient,
    });

    // Generate quiz
    const quizRes = await request(app)
      .post("/api/ai/quiz")
      .set("Authorization", "Bearer token-alice")
      .send({ documentId: "doc-os-1", difficulty: "medium", count: 2 });

    expect(quizRes.status).toBe(201);
    expect(quizRes.body.questions).toHaveLength(2);
    // Client payload MUST NOT leak correctIndex or explanation
    expect(quizRes.body.questions[0].correctIndex).toBeUndefined();
    expect(quizRes.body.questions[0].explanation).toBeUndefined();

    const quizId = quizRes.body.quizId as string;

    // Bob cannot grade Alice's quiz
    const bobGrade = await request(app)
      .post("/api/ai/quiz/grade")
      .set("Authorization", "Bearer token-bob")
      .send({ quizId, answers: { q1: 1, q2: 2 } });
    expect(bobGrade.status).toBe(403);

    // Alice submits 1 correct (q1: 1) and 1 wrong (q2: 0), plus attempts to pass fake correctAnswers in payload
    const gradeRes = await request(app)
      .post("/api/ai/quiz/grade")
      .set("Authorization", "Bearer token-alice")
      .send({
        quizId,
        answers: { q1: 1, q2: 0 },
        correctAnswers: { q1: 1, q2: 0 }, // Browser tampering attempt — ignored by server
      });

    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.score).toBe(1);
    expect(gradeRes.body.total).toBe(2);
    expect(gradeRes.body.percent).toBe(50);
    expect(gradeRes.body.results[0].isCorrect).toBe(true);
    expect(gradeRes.body.results[1].isCorrect).toBe(false);
    expect(gradeRes.body.results[1].correctIndex).toBe(2);
    expect(gradeRes.body.results[1].explanation).toContain("SJF");
  });

  it("rejects malformed requests (400) and handles invalid AI quiz structures / AI errors (502) without saving", async () => {
    const repository = new InMemoryStudyRepository();
    seedAliceDocument(repository);

    const brokenAiClient: AiModelClient = {
      async generateStructuredJson() {
        // Invalid quiz structure: only 3 options instead of 4, and correctIndex out of range
        return JSON.stringify({
          questions: [
            {
              question: "Bad question?",
              options: ["Only", "Three", "Options"],
              correctIndex: 5,
              explanation: "Invalid",
              source: "p. 1",
            },
          ],
        });
      },
    };

    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage: new InMemoryStorageService(),
      aiClient: brokenAiClient,
    });

    // Malformed request body -> 400 VALIDATION_ERROR
    const badReq = await request(app)
      .post("/api/ai/chat")
      .set("Authorization", "Bearer token-alice")
      .send({ documentId: "", question: "" });
    expect(badReq.status).toBe(400);
    expect(badReq.body.error.code).toBe("VALIDATION_ERROR");

    // Invalid AI quiz schema -> 502 AI_SERVICE_ERROR and not saved
    const badQuiz = await request(app)
      .post("/api/ai/quiz")
      .set("Authorization", "Bearer token-alice")
      .send({ documentId: "doc-os-1", difficulty: "easy", count: 1 });
    expect(badQuiz.status).toBe(502);
    expect(badQuiz.body.error.code).toBe("AI_SERVICE_ERROR");
    expect(repository.quizzes.size).toBe(0);
  });

  it("enforces ownership on GET /api/history, GET /api/history/:id, and DELETE /api/history/:id", async () => {
    const repository = new InMemoryStudyRepository();
    await repository.createHistoryItem({
      id: "hist-alice-1",
      uid: "uid-alice",
      type: "chat",
      title: "Alice's question",
      documentId: "doc-os-1",
      documentTitle: "Operating Systems — Galvin",
      payload: { question: "Q", answer: "A" },
      createdAt: "2026-10-23T01:00:00.000Z",
    });

    const app = createBackendApp({
      tokenVerifier: fakeVerifier,
      repository,
      storage: new InMemoryStorageService(),
    });

    // Alice lists her history -> 1 item
    const aliceList = await request(app)
      .get("/api/history?type=chat")
      .set("Authorization", "Bearer token-alice");
    expect(aliceList.status).toBe(200);
    expect(aliceList.body.items).toHaveLength(1);

    // Bob lists his history -> 0 items
    const bobList = await request(app)
      .get("/api/history")
      .set("Authorization", "Bearer token-bob");
    expect(bobList.status).toBe(200);
    expect(bobList.body.items).toHaveLength(0);

    // Bob tries to read Alice's history item -> 403 FORBIDDEN
    const bobGet = await request(app)
      .get("/api/history/hist-alice-1")
      .set("Authorization", "Bearer token-bob");
    expect(bobGet.status).toBe(403);
    expect(bobGet.body.error.code).toBe("FORBIDDEN");

    // Bob tries to delete Alice's history item -> 403 FORBIDDEN
    const bobDel = await request(app)
      .delete("/api/history/hist-alice-1")
      .set("Authorization", "Bearer token-bob");
    expect(bobDel.status).toBe(403);

    // Alice reads and deletes her own history item -> 200 OK
    const aliceGet = await request(app)
      .get("/api/history/hist-alice-1")
      .set("Authorization", "Bearer token-alice");
    expect(aliceGet.status).toBe(200);
    expect(aliceGet.body.item.id).toBe("hist-alice-1");

    const aliceDel = await request(app)
      .delete("/api/history/hist-alice-1")
      .set("Authorization", "Bearer token-alice");
    expect(aliceDel.status).toBe(200);
    expect(aliceDel.body.deleted).toBe(true);
  });
});
