import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, MessageSquareText, NotebookPen, ListChecks, Search, Upload, ArrowRight, Flame, Clock, Target } from "lucide-react";
import { AppShell, DemoNote, SectionCard, StatusBadge } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, useAuth } from "@/lib/firebase-client";
import { conversations, quizScores, weeklyActivity } from "@/lib/sample-data";
import { fetchHistoryList, formatRelativeTime, useStudyDocuments, type ApiHistoryItem } from "@/lib/study-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyMate AI" },
      { name: "description", content: "Your study overview: recent documents, AI conversations, activity and quiz performance." },
      { property: "og:title", content: "Dashboard — StudyMate AI" },
      { property: "og:description", content: "Your personal AI study assistant dashboard." },
    ],
  }),
  component: Dashboard,
});

const quick = [
  { title: "Ask AI Tutor", desc: "Get explanations from your PDFs", icon: MessageSquareText, to: "/tutor" },
  { title: "Generate Notes", desc: "Summaries & revision sheets", icon: NotebookPen, to: "/notes" },
  { title: "Practice Quiz", desc: "Test yourself with MCQs", icon: ListChecks, to: "/quiz" },
  { title: "Upload PDF", desc: "Add notes or textbooks", icon: Upload, to: "/library" },
] as const;

function Dashboard() {
  const { displayName } = useAuth();
  const { docs } = useStudyDocuments();
  const [search, setSearch] = useState("");
  const [recentChats, setRecentChats] = useState<ApiHistoryItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        void apiRequest;
        const list = await fetchHistoryList("chat");
        setRecentChats(list.slice(0, 3));
      } catch {
        // ignore
      }
    })();
  }, []);

  const firstName = displayName.split(" ")[0] || "Student";
  const filteredDocs = search.trim()
    ? docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()) || d.subject.toLowerCase().includes(search.toLowerCase()))
    : docs;

  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/library">
            <Upload className="mr-1.5 h-4 w-4" />Upload document
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Semester 5 · Study Workspace</p>
          <h2 className="mt-1 text-2xl font-bold">Welcome back, {firstName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You have {docs.length} study documents indexed and ready for AI Q&amp;A, notes, and quizzes.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents, subjects…"
            className="bg-card pl-9"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quick.map((q) => (
          <Link
            key={q.title}
            to={q.to}
            className="group rounded-xl border bg-card p-4 shadow-card transition hover:border-primary/40"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
              <q.icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-sm font-semibold">{q.title}</p>
            <p className="text-xs text-muted-foreground">{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { i: Flame, l: "Day streak", v: "6" },
          { i: Clock, l: "Hours this week", v: "8.3" },
          { i: Target, l: "Avg. quiz score", v: "76%" },
        ].map((s) => (
          <div key={s.l} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card">
            <s.i className="hidden h-5 w-5 text-primary sm:block" />
            <div>
              <p className="font-display text-xl font-bold">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Recent documents"
          className="lg:col-span-2"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/library">
                View all<ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {filteredDocs.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.subject} · {d.pages} pages · {d.uploaded}
                  </p>
                </div>
                <StatusBadge status={d.status} progress={d.progress} />
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard
          title="Recent AI conversations"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/tutor">Open</Link>
            </Button>
          }
        >
          <ul className="space-y-3">
            {recentChats.length > 0
              ? recentChats.map((c) => (
                  <li key={c.id}>
                    <Link to="/tutor" className="-m-2 block rounded-lg p-2 hover:bg-muted">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatRelativeTime(c.createdAt)} · {c.documentTitle}
                      </p>
                    </Link>
                  </li>
                ))
              : conversations.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <Link to="/tutor" className="-m-2 block rounded-lg p-2 hover:bg-muted">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.time} · {c.doc}
                      </p>
                    </Link>
                  </li>
                ))}
          </ul>
        </SectionCard>
        <SectionCard title="Study activity" description="Minutes per day, this week" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivity}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} stroke="var(--muted-foreground)" />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                />
                <Bar dataKey="minutes" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Quiz performance" description="Score % over last attempts">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quizScores}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="attempt" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} width={30} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }} />
                <Line type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
      <DemoNote />
    </AppShell>
  );
}
