import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { AppError } from "../errors";
import { getEnv, type ServerEnv } from "../config/env";
import type { PdfPageContent, StoredQuizQuestion } from "../types";

export interface AiGenerateJsonRequest {
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
}

export interface AiModelClient {
  generateStructuredJson(req: AiGenerateJsonRequest): Promise<string>;
}

export class GoogleGenAiClient implements AiModelClient {
  private readonly env: ServerEnv;

  constructor(env: ServerEnv = getEnv()) {
    this.env = env;
  }

  async generateStructuredJson(req: AiGenerateJsonRequest): Promise<string> {
    const apiKey = this.env.geminiApiKey?.trim();
    if (!apiKey) {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "Gemini API key (GEMINI_API_KEY) is not configured on the server.",
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: this.env.geminiModel,
        contents: req.prompt,
        config: {
          systemInstruction: req.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: req.responseSchema,
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text || typeof text !== "string" || !text.trim()) {
        throw new AppError(
          502,
          "AI_SERVICE_ERROR",
          "The AI model returned an empty response.",
        );
      }

      return text;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      console.error("[AI Service Error]", err);
      throw new AppError(
        502,
        "AI_SERVICE_ERROR",
        "Failed to generate a response from the AI service. Please try again later.",
      );
    }
  }
}

export function formatDocumentPagesForPrompt(
  documentTitle: string,
  pages: PdfPageContent[],
): string {
  return pages
    .map((p) => `--- [${documentTitle} — Page ${p.pageNumber}] ---\n${p.text}`)
    .join("\n\n");
}

function parseAndValidateAiJson<T>(rawText: string, schema: z.ZodType<T>, contextLabel: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new AppError(
      502,
      "AI_SERVICE_ERROR",
      `AI service returned malformed JSON for ${contextLabel}.`,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      502,
      "AI_SERVICE_ERROR",
      `AI service output failed schema validation for ${contextLabel}.`,
    );
  }

  return result.data;
}

export const AiChatOutputSchema = z.object({
  answer: z.string().trim().min(1),
  supported: z.boolean(),
  sources: z.array(z.string().trim().min(1)),
});

export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;

export const AiSummaryOutputSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1),
        bullets: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(1),
  sources: z.array(z.string().trim().min(1)),
});

export type AiSummaryOutput = z.infer<typeof AiSummaryOutputSchema>;

export const AiExplainOutputSchema = z.object({
  explanation: z.string().trim().min(1),
  keyTakeaways: z.array(z.string().trim().min(1)).min(1),
  supported: z.boolean(),
  sources: z.array(z.string().trim().min(1)),
});

export type AiExplainOutput = z.infer<typeof AiExplainOutputSchema>;

export const GeneratedQuizQuestionSchema = z.object({
  question: z.string().trim().min(1),
  options: z.tuple([
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
  ]),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1),
  source: z.string().trim().min(1),
});

export const GeneratedQuizOutputSchema = z.object({
  questions: z.array(GeneratedQuizQuestionSchema).min(1).max(30),
});

export class StudyAiService {
  private readonly client: AiModelClient;

  constructor(client: AiModelClient) {
    this.client = client;
  }

  async chatWithDocument(params: {
    documentTitle: string;
    pages: PdfPageContent[];
    question: string;
    history?: { role: "user" | "ai"; text: string }[] | undefined;
  }): Promise<AiChatOutput> {
    const formattedDoc = formatDocumentPagesForPrompt(params.documentTitle, params.pages);
    const historyBlock =
      params.history && params.history.length > 0
        ? "\n\nConversation History:\n" +
          params.history.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n")
        : "";

    const systemInstruction = [
      "You are StudyMate AI, a precise academic study assistant.",
      "Answer the student's question STRICTLY using ONLY the supplied document pages below.",
      "If the answer is not supported by the supplied document material, you MUST explicitly state that the answer is not supported by the provided material, set 'supported' to false, and return an empty 'sources' array.",
      "When the answer is supported by the text, set 'supported' to true and include page citations in 'sources' formatted like '<Document Title>, p. <PageNumber>'.",
    ].join(" ");

    const prompt = `Document Content:\n${formattedDoc}${historyBlock}\n\nStudent Question: ${params.question}`;

    const raw = await this.client.generateStructuredJson({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING },
          supported: { type: Type.BOOLEAN },
          sources: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["answer", "supported", "sources"],
      },
    });

    return parseAndValidateAiJson(raw, AiChatOutputSchema, "chat response");
  }

  async summarizeDocument(params: {
    documentTitle: string;
    pages: PdfPageContent[];
    style: "summary" | "chapter" | "definitions" | "revision";
  }): Promise<AiSummaryOutput> {
    const formattedDoc = formatDocumentPagesForPrompt(params.documentTitle, params.pages);

    const systemInstruction = [
      "You are StudyMate AI. Generate structured study notes and a summary strictly grounded in the provided document pages.",
      `Requested note style: ${params.style}.`,
      "Include page citations in 'sources' formatted like '<Document Title>, p. <PageNumber>'.",
    ].join(" ");

    const prompt = `Summarize the following document (${params.documentTitle}) in '${params.style}' style:\n\n${formattedDoc}`;

    const raw = await this.client.generateStructuredJson({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ["heading", "bullets"],
            },
          },
          sources: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["title", "summary", "sections", "sources"],
      },
    });

    return parseAndValidateAiJson(raw, AiSummaryOutputSchema, "document summary");
  }

  async explainTopic(params: {
    documentTitle: string;
    pages: PdfPageContent[];
    topic: string;
    level: "beginner" | "intermediate" | "advanced";
  }): Promise<AiExplainOutput> {
    const formattedDoc = formatDocumentPagesForPrompt(params.documentTitle, params.pages);

    const systemInstruction = [
      "You are StudyMate AI. Provide a clear, simple, and accurate explanation of the requested topic or passage grounded in the provided document pages.",
      `Target audience level: ${params.level}.`,
      "If the topic is not covered in the supplied document pages, state clearly that it is not supported by the provided material and set 'supported' to false.",
      "Include exact page references in 'sources' formatted like '<Document Title>, p. <PageNumber>'.",
    ].join(" ");

    const prompt = `Document Content:\n${formattedDoc}\n\nExplain the following topic at a ${params.level} level: ${params.topic}`;

    const raw = await this.client.generateStructuredJson({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          explanation: { type: Type.STRING },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          supported: { type: Type.BOOLEAN },
          sources: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["explanation", "keyTakeaways", "supported", "sources"],
      },
    });

    return parseAndValidateAiJson(raw, AiExplainOutputSchema, "topic explanation");
  }

  async generateQuiz(params: {
    documentTitle: string;
    pages: PdfPageContent[];
    difficulty: "easy" | "medium" | "hard";
    count: number;
  }): Promise<StoredQuizQuestion[]> {
    const formattedDoc = formatDocumentPagesForPrompt(params.documentTitle, params.pages);

    const systemInstruction = [
      "You are StudyMate AI Quiz Generator.",
      `Generate exactly ${params.count} multiple-choice questions at '${params.difficulty}' difficulty strictly from the provided document pages.`,
      "Every question MUST have:",
      "- 'question': clear question text,",
      "- 'options': an array of EXACTLY 4 distinct answer choices,",
      "- 'correctIndex': an integer from 0 to 3 indicating the single correct option,",
      "- 'explanation': a clear explanation of why the correct option is right,",
      "- 'source': the page citation (e.g. '<Document Title>, p. <PageNumber>').",
    ].join(" ");

    const prompt = `Generate a ${params.count}-question ${params.difficulty} quiz from this document:\n\n${formattedDoc}`;

    const raw = await this.client.generateStructuredJson({
      systemInstruction,
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ["question", "options", "correctIndex", "explanation", "source"],
            },
          },
        },
        required: ["questions"],
      },
    });

    const validated = parseAndValidateAiJson(raw, GeneratedQuizOutputSchema, "quiz generation");

    return validated.questions.map((q, index) => ({
      id: `q${index + 1}`,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      source: q.source,
    }));
  }
}
