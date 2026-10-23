import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, NotebookPen, Sparkles, AlertTriangle } from "lucide-react";
import { AppShell, DemoNote, EmptyState, SectionCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { documents } from "@/lib/sample-data";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "AI Notes — StudyMate AI" },
      { name: "description", content: "Generate summaries, chapter notes, definitions and revision sheets from your PDFs." },
      { property: "og:title", content: "AI Notes — StudyMate AI" },
      { property: "og:description", content: "Turn textbooks into revision-ready notes." },
    ],
  }),
  component: Notes,
});

const types = [
  { id: "summary", label: "Summary", desc: "Concise overview" },
  { id: "chapter", label: "Chapter-wise notes", desc: "Structured by chapter" },
  { id: "definitions", label: "Key definitions", desc: "Terms & meanings" },
  { id: "simple", label: "Simple explanation", desc: "Beginner friendly" },
  { id: "revision", label: "Revision notes", desc: "Last-minute bullets" },
];

const sample = {
  title: "CPU Scheduling — Summary",
  sections: [
    { h: "Overview", body: ["CPU scheduling decides which ready process runs next to maximise CPU utilisation and minimise waiting time."] },
    { h: "Key algorithms", body: ["FCFS — simple, non-preemptive, can cause convoy effect.", "SJF — optimal average waiting time, risk of starvation.", "Priority — may starve low priority; solved with aging.", "Round Robin — time quantum based, good response time."] },
    { h: "Criteria", body: ["CPU utilisation, throughput, turnaround time, waiting time, response time."] },
  ],
  source: "Operating Systems — Galvin, pp. 138–152",
};

function Notes() {
  const [doc, setDoc] = useState("d1");
  const [type, setType] = useState("summary");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("done");

  const generate = () => {
    setState("loading");
    setTimeout(() => setState(doc === "d6" ? "error" : "done"), 1400);
  };

  return (
    <AppShell title="AI Notes">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SectionCard title="Generate notes" description="Pick a document and note style">
          <label className="text-xs font-medium text-muted-foreground">Document</label>
          <Select value={doc} onValueChange={setDoc}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Note type</p>
          <div className="mt-1.5 space-y-1.5">
            {types.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)} className={`w-full rounded-lg border px-3 py-2 text-left transition ${type === t.id ? "border-primary bg-primary-soft" : "hover:bg-muted"}`}>
                <p className={`text-sm font-medium ${type === t.id ? "text-primary" : ""}`}>{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={generate} disabled={state === "loading"}>
            <Sparkles className="mr-1.5 h-4 w-4" />{state === "loading" ? "Generating…" : "Generate notes"}
          </Button>
        </SectionCard>

        <div>
          {state === "idle" && <EmptyState icon={NotebookPen} title="No notes yet" description="Choose a document and a note type, then generate." />}
          {state === "loading" && (
            <SectionCard>
              <Skeleton className="h-6 w-1/2" />
              <div className="mt-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4" style={{ width: `${60 + ((i * 17) % 40)}%` }} />)}</div>
            </SectionCard>
          )}
          {state === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold">Couldn't generate notes</p>
                <p className="mt-1 text-sm text-muted-foreground">This document failed processing, so there's no text to work with. Re-upload a clearer PDF from My Library.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setDoc("d1")}>Choose another document</Button>
              </div>
            </div>
          )}
          {state === "done" && (
            <SectionCard
              title={sample.title}
              description={`Sample output · ${types.find((t) => t.id === type)?.label}`}
              action={
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Copy notes" onClick={() => toast.success("Copied to clipboard")}><Copy className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Download notes" onClick={() => toast.info("Export will be available after backend setup")}><Download className="h-4 w-4" /></Button>
                </div>
              }
            >
              <div className="space-y-5">
                {sample.sections.map((s) => (
                  <div key={s.h}>
                    <h3 className="text-sm font-semibold text-primary">{s.h}</h3>
                    <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                      {s.body.map((b) => <li key={b} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />{b}</li>)}
                    </ul>
                  </div>
                ))}
                <p className="border-t pt-3 text-xs text-muted-foreground">Source: {sample.source}</p>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
      <DemoNote />
    </AppShell>
  );
}
