import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Coffee, LoaderCircle, MailCheck } from "lucide-react";
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
    { property: "og:title", content: "Coffee Menu Dashboard Sign-in" }, { property: "og:description", content: "Sign in with an approved email to manage the menu." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { name: "robots", content: "noindex" },
  ] }),
  component: Login,
});

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);

function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Enter a valid email address."); return; }
    setBusy(true); setError("");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: window.location.origin + "/dashboard", shouldCreateUser: false },
    });
    setBusy(false);
    if (otpError) setError(
      otpError.status === 429 ? "Too many attempts. Please wait a minute and try again."
      : otpError.status === 422 || /signup|not allowed|not found/i.test(otpError.message) ? "This email is not approved for the dashboard."
      : "Could not send the sign-in link. Please try again.");
    else setSent(true);
  }

  return <main className="flex min-h-screen items-center justify-center px-4 py-10">
    <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Coffee className="size-5" /></div>
        <div><h1 className="font-semibold leading-tight">Coffee Menu</h1><p className="text-xs text-muted-foreground">Dashboard sign-in</p></div>
      </div>
      {sent ? <div role="status" className="space-y-3 text-center">
        <MailCheck className="mx-auto size-10 text-primary" />
        <p className="text-lg font-semibold">Check your email for the sign-in link</p>
        <p className="text-sm text-muted-foreground">We sent it to {email.trim()}. Open it on this device to continue.</p>
        <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>Use a different email</Button>
      </div> : <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com"
            className="w-full rounded-xl border border-border bg-input px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-1 focus:ring-ring sm:text-sm" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Send sign-in link</Button>
        <p className="text-center text-xs text-muted-foreground">Only approved accounts can open the dashboard.</p>
      </form>}
    </div>
  </main>;
}
