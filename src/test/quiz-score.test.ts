import { describe, expect, it } from "vitest";
import { sampleQuiz, scoreQuiz } from "@/lib/sample-data";

describe("scoreQuiz", () => {
  it("counts only correct answers and treats unanswered as wrong", () => {
    const answers = { m1: 1, m2: 3 }; // one right, one wrong, three unanswered
    expect(scoreQuiz(sampleQuiz, answers)).toEqual({ correct: 1, total: 5, percent: 20 });
  });
  it("gives 100% when all correct", () => {
    const all = Object.fromEntries(sampleQuiz.map((q) => [q.id, q.answer]));
    expect(scoreQuiz(sampleQuiz, all).percent).toBe(100);
  });
});
