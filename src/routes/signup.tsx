import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — StudyMate AI" },
      { name: "description", content: "Register for StudyMate AI, your personal AI study assistant." },
      { property: "og:title", content: "Create account — StudyMate AI" },
      { property: "og:description", content: "Start studying smarter with AI." },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const [error, setError] = useState("");
  return (
    <AuthLayout title="Create your account" subtitle="Free for students. Takes under a minute." footer={<>Already have an account? <Link to="/signin" className="font-medium text-primary">Sign in</Link></>}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const pw = String(new FormData(e.currentTarget).get("password"));
          if (pw.length < 8) return setError("Password must be at least 8 characters.");
          setError("");
          toast.info("Registration isn't connected yet", { description: "This is a design preview." });
        }}
      >
        <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" name="name" required placeholder="Jatin Sharma" /></div>
        <div className="space-y-1.5"><Label htmlFor="email">College email</Label><Input id="email" name="email" type="email" required placeholder="you@college.edu" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" placeholder="At least 8 characters" aria-invalid={!!error} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full">Create account</Button>
        <p className="text-center text-xs text-muted-foreground">By continuing you agree to the Terms and Privacy Policy.</p>
      </form>
    </AuthLayout>
  );
}
