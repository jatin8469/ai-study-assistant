import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand p-10 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/15"><GraduationCap className="h-5 w-5" /></span>StudyMate AI</Link>
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">Your personal AI study assistant.</h2>
          <ul className="mt-6 space-y-3 text-sm opacity-90">
            {["Ask questions about your own PDFs", "Get notes and revision sheets in seconds", "Practice MCQs with explanations"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs opacity-70">Computer Engineering college project · 2026</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2 font-display font-bold lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground"><GraduationCap className="h-4 w-4" /></span>StudyMate AI</Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <Button variant="outline" className="mt-6 w-full" type="button">
            <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.03 0-.6-.07-1.07-.15-1.52Z" /></svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          {children}
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </div>
    </div>
  );
}
