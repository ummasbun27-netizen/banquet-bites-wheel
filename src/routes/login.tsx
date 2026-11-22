import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Coffee, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({ meta: [
    { title: "Sign in — Coffee Menu Dashboard" }, { name: "description", content: "Owner sign-in for the coffee menu dashboard." },
    { property: "og:title", content: "Coffee Menu Dashboard Sign-in" }, { property: "og:description", content: "Sign in with an approved account to manage the menu." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: Login,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});
const field = "w-full rounded-xl border border-border bg-input px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-1 focus:ring-ring sm:text-sm";

/** Email + password only: accounts are created by the owner in the backend; nobody can sign up here. */
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the fields."); return; }
    setBusy(true); setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (signInError) {
      setError(signInError.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Email or password is incorrect.");
      return;
    }
    await navigate({ to: "/dashboard", replace: true });
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Coffee className="size-5" /></div>
        <div><h1 className="font-semibold leading-tight">Coffee Menu</h1><p className="text-xs text-muted-foreground">Dashboard sign-in</p></div>
      </div>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" className={field} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Sign in</Button>
        <p className="text-center text-xs text-muted-foreground">Only approved accounts can open the dashboard.</p>
      </form>
    </div>
  </main>;
}
