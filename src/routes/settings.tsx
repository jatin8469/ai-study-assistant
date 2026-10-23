import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { AppShell, SectionCard } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StudyMate AI" },
      { name: "description", content: "Manage your student profile, theme and account." },
      { property: "og:title", content: "Settings — StudyMate AI" },
      { property: "og:description", content: "Profile, appearance and account settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  useEffect(() => {
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-3xl space-y-4">
        <SectionCard title="Student profile" description="Shown in your sidebar and study reports">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14"><AvatarFallback className="bg-primary-soft text-lg font-semibold text-primary">JS</AvatarFallback></Avatar>
            <Button variant="outline" size="sm">Change photo</Button>
          </div>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); toast.success("Profile updated (demo — not saved)"); }}>
            <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" defaultValue="Jatin Sharma" /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" defaultValue="jatin@college.edu" /></div>
            <div className="space-y-1.5"><Label htmlFor="college">College</Label><Input id="college" defaultValue="Institute of Engineering & Technology" /></div>
            <div className="space-y-1.5"><Label htmlFor="branch">Branch & semester</Label><Input id="branch" defaultValue="Computer Engineering · Sem 5" /></div>
            <div className="sm:col-span-2"><Button type="submit">Save changes</Button></div>
          </form>
        </SectionCard>

        <SectionCard title="Appearance" description="Choose how StudyMate looks">
          <div className="grid grid-cols-3 gap-2">
            {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Monitor, "System"]] as const).map(([v, Icon, l]) => (
              <button key={v} onClick={() => setTheme(v)} className={`flex flex-col items-center gap-2 rounded-lg border py-4 text-sm font-medium ${theme === v ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"}`}>
                <Icon className="h-5 w-5" />{l}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Account">
          <div className="divide-y">
            {[["Email study reminders", "Daily nudge at 7 PM", true], ["Weekly progress report", "Summary every Sunday", true], ["Show page references in answers", "Cite PDF pages in AI Tutor", true]].map(([t, d, on]) => (
              <div key={t as string} className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm font-medium">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div>
                <Switch defaultChecked={on as boolean} />
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div><p className="text-sm font-medium text-destructive">Delete account</p><p className="text-xs text-muted-foreground">Permanently remove documents, notes and history.</p></div>
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => toast.error("Account deletion is disabled in the demo")}>Delete account</Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
