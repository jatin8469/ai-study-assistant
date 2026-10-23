import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, Play, Trophy } from "lucide-react";
import { AppShell, DemoNote, SectionCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { documents, sampleQuiz, scoreQuiz } from "@/lib/sample-data";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Practice Quiz — StudyMate AI" },
      { name: "description", content: "Practice MCQs generated from your study material with explanations." },
      { property: "og:title", content: "Practice Quiz — StudyMate AI" },
      { property: "og:description", content: "Test yourself and review explanations." },
    ],
  }),
  component: Quiz,
});

function Quiz() {
  const [stage, setStage] = useState<"setup" | "taking" | "result">("setup");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState([5]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const questions = sampleQuiz;
  const result = scoreQuiz(questions, answers);
  const q = questions[current]!;

  if (stage === "setup")
    return (
      <AppShell title="Practice Quiz">
        <div className="mx-auto max-w-xl">
          <SectionCard title="Configure your quiz" description="Questions are drawn from the selected document">
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Topic / document</label>
                <Select defaultValue="d1"><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{documents.filter((d) => d.status === "ready").map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Difficulty</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {["easy", "medium", "hard"].map((d) => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`rounded-lg border py-2 text-sm font-medium capitalize ${difficulty === d ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-medium text-muted-foreground"><span>Number of questions</span><span className="text-foreground">{count[0]}</span></div>
                <Slider value={count} onValueChange={setCount} min={5} max={30} step={5} className="mt-3" />
              </div>
              <Button className="w-full" onClick={() => { setAnswers({}); setCurrent(0); setStage("taking"); }}><Play className="mr-1.5 h-4 w-4" />Start quiz</Button>
              <p className="text-center text-xs text-muted-foreground">Demo uses a fixed set of 5 sample questions.</p>
            </div>
          </SectionCard>
        </div>
      </AppShell>
    );

  if (stage === "taking")
    return (
      <AppShell title="Practice Quiz">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">Question {current + 1} of {questions.length}</span>
            <span className="text-muted-foreground">{Object.keys(answers).length} answered</span>
          </div>
          <Progress value={((current + 1) / questions.length) * 100} className="mb-4 h-1.5" />
          <SectionCard>
            <p className="text-base font-semibold leading-snug">{q.question}</p>
            <div className="mt-5 space-y-2">
              {q.options.map((o, i) => (
                <button key={o} onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))} className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${answers[q.id] === i ? "border-primary bg-primary-soft" : "hover:bg-muted"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${answers[q.id] === i ? "border-primary bg-primary text-primary-foreground" : ""}`}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between gap-2">
              <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>Previous</Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
              ) : (
                <Button onClick={() => {
                  const missing = questions.length - Object.keys(answers).length;
                  if (missing) toast.warning(`${missing} unanswered — counted as wrong`);
                  setStage("result");
                }}>Submit quiz</Button>
              )}
            </div>
          </SectionCard>
        </div>
      </AppShell>
    );

  return (
    <AppShell title="Quiz Review">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex flex-col items-center rounded-xl border bg-card p-6 text-center shadow-card">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><Trophy className="h-7 w-7" /></span>
          <p className="mt-3 font-display text-3xl font-bold">{result.percent}%</p>
          <p className="text-sm text-muted-foreground">{result.correct} of {result.total} correct · {difficulty} difficulty</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStage("setup")}><RotateCcw className="mr-1.5 h-4 w-4" />New quiz</Button>
            <Button onClick={() => { setAnswers({}); setCurrent(0); setStage("taking"); }}>Retry</Button>
          </div>
        </div>
        {questions.map((qq, idx) => {
          const ok = answers[qq.id] === qq.answer;
          return (
            <SectionCard key={qq.id}>
              <div className="flex gap-3">
                {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{idx + 1}. {qq.question}</p>
                  <p className="mt-2 text-sm">Correct: <span className="font-medium text-success">{qq.options[qq.answer]}</span></p>
                  {!ok && <p className="text-sm">Your answer: <span className="font-medium text-destructive">{answers[qq.id] !== undefined ? qq.options[answers[qq.id]!] : "Not answered"}</span></p>}
                  <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{qq.explanation}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Source: {qq.source}</p>
                </div>
              </div>
            </SectionCard>
          );
        })}
        <DemoNote />
      </div>
    </AppShell>
  );
}
