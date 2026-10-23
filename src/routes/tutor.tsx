import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Send, Sparkles, BookOpen, FileText, Paperclip } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { conversations, documents } from "@/lib/sample-data";

export const Route = createFileRoute("/tutor")({
  head: () => ({
    meta: [
      { title: "AI Tutor — StudyMate AI" },
      { name: "description", content: "Chat with an AI tutor about your uploaded study documents." },
      { property: "og:title", content: "AI Tutor — StudyMate AI" },
      { property: "og:description", content: "Ask questions and get explanations with page references." },
    ],
  }),
  component: Tutor,
});

type Msg = { role: "user" | "ai"; text: string; sources?: string[]; pending?: boolean };

const initial: Msg[] = [
  { role: "user", text: "Explain Round Robin scheduling with an example." },
  {
    role: "ai",
    text: "Round Robin (RR) gives every process a fixed time slice called the time quantum. Processes wait in a circular ready queue; when a process's quantum expires it is pre-empted and moved to the back.\n\nExample with quantum = 4 ms: P1 (10 ms), P2 (4 ms), P3 (6 ms). Order: P1 → P2 → P3 → P1 → P3 → P1. P2 finishes at 8 ms, P3 at 18 ms, P1 at 20 ms.\n\nA smaller quantum improves response time but increases context-switch overhead.",
    sources: ["Galvin p. 146", "Galvin p. 147"],
  },
];

const suggestions = ["Compare SJF and Priority scheduling", "What is a context switch?", "Give me 3 exam questions on this", "Explain like I'm new to OS"];

function ConversationList() {
  return (
    <div className="flex h-full flex-col">
      <Button className="m-3"><Plus className="mr-1.5 h-4 w-4" />New chat</Button>
      <p className="px-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
      <ul className="flex-1 space-y-1 overflow-y-auto px-2">
        {conversations.map((c, i) => (
          <li key={c.id}>
            <button className={`w-full rounded-lg px-3 py-2 text-left ${i === 0 ? "bg-primary-soft" : "hover:bg-muted"}`}>
              <p className={`truncate text-sm font-medium ${i === 0 ? "text-primary" : ""}`}>{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">{c.time} · {c.doc}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tutor() {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [ctx, setCtx] = useState("d1");
  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: "", pending: true }]);
    setInput("");
  };
  return (
    <AppShell
      title="AI Tutor"
      actions={
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="sm" className="lg:hidden">Chats</Button></SheetTrigger>
          <SheetContent side="left" className="w-72 p-0"><SheetTitle className="sr-only">Conversations</SheetTitle><ConversationList /></SheetContent>
        </Sheet>
      }
    >
      <div className="grid h-[calc(100vh-7.5rem)] overflow-hidden rounded-xl border bg-card shadow-card lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r lg:block"><ConversationList /></aside>
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Context:</span>
            <Select value={ctx} onValueChange={setCtx}>
              <SelectTrigger className="h-8 w-auto max-w-[260px] text-sm"><SelectValue>{ctx === "all" ? "All documents" : documents.find((d) => d.id === ctx)?.title}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All documents</SelectItem>
                {documents.filter((d) => d.status === "ready").map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground md:max-w-[70%]">{m.text}</div>
              ) : (
                <div key={i} className="flex max-w-[92%] gap-3 md:max-w-[80%]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    {m.pending ? (
                      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />)}
                          <span className="ml-2 text-xs text-muted-foreground">Responses will stream here once the AI is connected</span>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-line rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed">{m.text}</div>
                    )}
                    {m.sources && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs text-muted-foreground"><FileText className="h-3 w-3" />{s}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="border-t p-3 md:p-4">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border px-3 py-1 text-xs hover:border-primary/40 hover:bg-primary-soft">{s}</button>)}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/30">
              <Button type="button" variant="ghost" size="icon" aria-label="Attach document"><Paperclip className="h-4 w-4" /></Button>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} placeholder="Ask about your document…" className="min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
              <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
