import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, MessageSquareText, NotebookPen } from "lucide-react";
import { AppShell, DemoNote, SectionCard, StatusBadge } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { conversations, documents, notesHistory, quizAttempts, quizScores } from "@/lib/sample-data";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Study History — StudyMate AI" },
      { name: "description", content: "Review past chats, notes, uploads, quiz attempts and progress." },
      { property: "og:title", content: "Study History — StudyMate AI" },
      { property: "og:description", content: "Track your study progress over time." },
    ],
  }),
  component: History,
});

function Row({ icon: Icon, title, meta, right }: { icon: React.ComponentType<{ className?: string }>; title: string; meta: string; right?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{meta}</p></div>
      {right}
    </li>
  );
}

function History() {
  return (
    <AppShell title="Study History">
      <div className="grid gap-4 md:grid-cols-4">
        {[["24", "AI chats"], ["11", "Notes generated"], ["6", "Documents"], ["14", "Quizzes taken"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border bg-card p-4 shadow-card"><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
        ))}
      </div>
      <SectionCard title="Quiz score progress" description="Last 3 weeks" className="mt-4">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={quizScores}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="attempt" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={30} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }} />
              <Area type="monotone" dataKey="score" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <Tabs defaultValue="quizzes" className="mt-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="quizzes">Quiz attempts</TabsTrigger>
          <TabsTrigger value="chats">Chats</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="docs">Uploads</TabsTrigger>
        </TabsList>
        <TabsContent value="quizzes">
          <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Topic</th><th className="hidden px-4 py-2.5 font-medium sm:table-cell">Difficulty</th><th className="px-4 py-2.5 font-medium">Score</th><th className="px-4 py-2.5 font-medium">Date</th></tr></thead>
              <tbody className="divide-y">
                {quizAttempts.map((a) => {
                  const pct = Math.round((a.score / a.total) * 100);
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3"><p className="font-medium">{a.topic}</p><p className="text-xs text-muted-foreground">{a.subject}</p></td>
                      <td className="hidden px-4 py-3 sm:table-cell">{a.difficulty}</td>
                      <td className="px-4 py-3"><span className={`font-semibold ${pct >= 75 ? "text-success" : pct >= 60 ? "text-warning" : "text-destructive"}`}>{a.score}/{a.total}</span></td>
                      <td className="px-4 py-3 text-muted-foreground">{a.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="chats"><SectionCard><ul className="divide-y">{conversations.map((c) => <Row key={c.id} icon={MessageSquareText} title={c.title} meta={`${c.doc} · ${c.time}`} />)}</ul></SectionCard></TabsContent>
        <TabsContent value="notes"><SectionCard><ul className="divide-y">{notesHistory.map((n) => <Row key={n.id} icon={NotebookPen} title={n.title} meta={`${n.type} · ${n.date}`} />)}</ul></SectionCard></TabsContent>
        <TabsContent value="docs"><SectionCard><ul className="divide-y">{documents.map((d) => <Row key={d.id} icon={FileText} title={d.title} meta={`${d.subject} · ${d.uploaded}`} right={<StatusBadge status={d.status} />} />)}</ul></SectionCard></TabsContent>
      </Tabs>
      <DemoNote />
    </AppShell>
  );
}
