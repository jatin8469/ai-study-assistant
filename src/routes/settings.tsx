import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, Moon, Sun, LogOut, LogIn } from "lucide-react";
import { AppShell, SectionCard } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/firebase-client";

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
  const { displayName, email, initials, isAnonymous, studentMeta, updateStudentProfile, signOut } = useAuth();
  const [name, setName] = useState(displayName);
  const [college, setCollege] = useState(studentMeta.college);
  const [branch, setBranch] = useState(studentMeta.branch);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const navigate = useNavigate();

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  useEffect(() => {
    setCollege(studentMeta.college);
    setBranch(studentMeta.branch);
  }, [studentMeta.college, studentMeta.branch]);

  useEffect(() => {
    const dark =
      theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-3xl space-y-4">
        <SectionCard title="Student profile" description="Shown in your sidebar and study reports">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary-soft text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {isAnonymous ? "Authenticated via Firebase Guest Session" : email}
                </p>
              </div>
            </div>
            {isAnonymous ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/signin">
                  <LogIn className="mr-1.5 h-4 w-4" />Sign in with college email
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut();
                  toast.success("Signed out");
                  await navigate({ to: "/signin" });
                }}
              >
                <LogOut className="mr-1.5 h-4 w-4" />Sign out
              </Button>
            )}
          </div>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await updateStudentProfile({ name, college, branch });
                toast.success("Student profile saved");
              } catch {
                toast.error("Could not update profile");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="college">College</Label>
              <Input id="college" value={college} onChange={(e) => setCollege(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch">Branch &amp; semester</Label>
              <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Appearance" description="Choose how StudyMate looks">
          <div className="grid grid-cols-3 gap-2">
            {([
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
              ["system", Monitor, "System"],
            ] as const).map(([v, Icon, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTheme(v)}
                className={`flex flex-col items-center gap-2 rounded-lg border py-4 text-sm font-medium ${
                  theme === v ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
                {l}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Account">
          <div className="divide-y">
            {(
              [
                ["Email study reminders", "Daily nudge at 7 PM", true],
                ["Weekly progress report", "Summary every Sunday", true],
                ["Show page references in answers", "Cite PDF pages in AI Tutor", true],
              ] as const
            ).map(([t, d, on]) => (
              <div key={t} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t}</p>
                  <p className="text-xs text-muted-foreground">{d}</p>
                </div>
                <Switch defaultChecked={on} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
