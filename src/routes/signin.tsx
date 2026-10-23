import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, getValidIdToken } from "@/lib/firebase-client";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — StudyMate AI" },
      { name: "description", content: "Sign in to your StudyMate AI account." },
      { property: "og:title", content: "Sign in — StudyMate AI" },
      { property: "og:description", content: "Continue studying with your AI assistant." },
    ],
  }),
  component: SignIn,
});

function formatFirebaseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) {
    return "Invalid email or password. Please check your credentials or create an account.";
  }
  if (msg.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Unable to sign in right now. Please try again.";
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address above first to receive a password reset link.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetPassword(email.trim());
      toast.success("Password reset email sent", {
        description: `Check ${email.trim()} for instructions to reset your password.`,
      });
    } catch (err) {
      setError(formatFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGuestContinue = async () => {
    setBusy(true);
    setError("");
    try {
      await getValidIdToken();
      toast.success("Signed in to guest study session");
      await navigate({ to: "/" });
    } catch {
      setError("Could not start guest session. Please sign in with email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue studying with your AI assistant"
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!email.trim()) return setError("Please enter your email address.");
          if (!password.length) return setError("Please enter your password.");
          setError("");
          setBusy(true);
          try {
            await signIn(email.trim(), password);
            toast.success("Welcome back to StudyMate AI!");
            await navigate({ to: "/" });
          } catch (err) {
            setError(formatFirebaseError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
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
          <div className="flex justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => void handleResetPassword()}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={!!error}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <div className="relative py-1 text-center text-xs text-muted-foreground">
          <span className="bg-card px-2">or</span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => void handleGuestContinue()}
        >
          Continue with Instant Student Demo
        </Button>
      </form>
    </AuthLayout>
  );
}
