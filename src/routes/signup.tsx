import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/firebase-client";

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

function formatSignUpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("auth/email-already-in-use")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (msg.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("auth/weak-password")) {
    return "Password must be at least 6 characters.";
  }
  return "Could not create your account right now. Please try again.";
}

function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for students. Takes under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Please enter your full name.");
          if (!email.trim()) return setError("Please enter your email address.");
          if (password.length < 8) return setError("Password must be at least 8 characters.");
          setError("");
          setBusy(true);
          try {
            await signUp(name.trim(), email.trim(), password);
            toast.success("Account created!", {
              description: "Welcome to StudyMate AI. Your starter textbooks are ready.",
            });
            await navigate({ to: "/" });
          } catch (err) {
            setError(formatSignUpError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jatin Sharma"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">College email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            aria-invalid={!!error}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </form>
    </AuthLayout>
  );
}
