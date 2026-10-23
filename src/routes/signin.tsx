import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function SignIn() {
  const [error, setError] = useState("");
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue studying" footer={<>New here? <Link to="/signup" className="font-medium text-primary">Create an account</Link></>}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (!String(f.get("password")).length) return setError("Please enter your password.");
          setError("");
          toast.info("Sign-in isn't connected yet", { description: "This is a design preview." });
        }}
      >
        <div className="space-y-1.5"><Label htmlFor="email">College email</Label><Input id="email" name="email" type="email" required placeholder="you@college.edu" /></div>
        <div className="space-y-1.5">
          <div className="flex justify-between"><Label htmlFor="password">Password</Label><button type="button" className="text-xs text-primary">Forgot password?</button></div>
          <Input id="password" name="password" type="password" placeholder="••••••••" aria-invalid={!!error} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
    </AuthLayout>
  );
}
