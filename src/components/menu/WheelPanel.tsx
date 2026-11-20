import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Minus, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { wheelQuery } from "@/lib/menu-queries";
import { saveWheel, resetWheelToday, checkClaim, redeemClaim, type ClaimCheck } from "@/lib/wheel.functions";
import { prizeMode, limitForMode, wheelSchema, type Prize, type PrizeMode } from "@/lib/wheel-schema";

const base = "rounded-xl border border-border bg-input px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-1 focus:ring-ring sm:text-sm";
const field = `w-full ${base}`;
const modes: { id: PrizeMode; label: string; hint: string }[] = [
  { id: "u", label: "Unlimited", hint: "Wins rarely (about 1 in 10 spins), unless it is the most common win." },
  { id: "l", label: "Daily limit", hint: "Only the number of people you choose can win today." },
  { id: "z", label: "Display only", hint: "Shown on the wheel but nobody wins." },
];
const palette = ["#8d5524", "#2f9e44", "#f08c00", "#1c7ed6", "#d6336c", "#7048e8", "#0b7285", "#e8590c"];

const statusText = { valid: "Valid", used: "Used", expired: "Expired" } as const;

/** The cashier checks a guest's prize code; a code can be marked used only once. */
function ClaimVerifier({ claims }: { claims: { code: string; prize: string; created_at: string }[] }) {
  const client = useQueryClient();
  const check = useServerFn(checkClaim); const redeem = useServerFn(redeemClaim);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ClaimCheck | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(value = code) {
    if (!value.trim()) return;
    setBusy(true);
    try { setResult(await check({ data: { code: value } })); } catch { toast.error("Code could not be checked."); } finally { setBusy(false); }
  }
  async function markUsed() {
    if (!result?.found) return;
    setBusy(true);
    try {
      const { ok } = await redeem({ data: { code: result.code } });
      if (ok) toast.success("Prize marked as used."); else toast.error("This code is no longer valid.");
      setResult(await check({ data: { code: result.code } }));
      await client.invalidateQueries({ queryKey: wheelQuery.queryKey });
    } catch { toast.error("Code could not be marked."); } finally { setBusy(false); }
  }

  return <div className="mt-6 rounded-2xl border border-border bg-card p-5">
    <h2 className="text-lg font-semibold">Verify prize</h2>
    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
      <input aria-label="Prize code" className={`${base} min-w-0 flex-1 font-mono uppercase tracking-widest`} maxLength={12} placeholder="ABC234" value={code} onChange={(e) => { setCode(e.target.value); setResult(null); }} />
      <Button type="submit" variant="secondary" disabled={busy || !code.trim()}><Search />Check</Button>
    </form>
    {result && (result.found ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-3">
      <div><p className="font-semibold">{result.prize}</p>
        <p className={`text-sm ${result.status === "valid" ? "text-success" : "text-destructive"}`}>{statusText[result.status]}</p></div>
      {result.status === "valid" && <Button disabled={busy} onClick={() => void markUsed()}><BadgeCheck />Mark as used</Button>}
    </div> : <p className="mt-3 text-sm text-destructive">Code not found.</p>)}
    <p className="mt-4 text-sm font-medium">Today's unused codes</p>
    {claims.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">None yet.</p> : <ul className="mt-2 flex flex-wrap gap-2">
      {claims.map((c) => <li key={c.code}><button type="button" onClick={() => { setCode(c.code); void lookup(c.code); }} className="rounded-full bg-secondary px-3 py-1 text-xs hover:text-foreground">
        <span className="font-mono font-semibold tracking-wider">{c.code}</span> · {c.prize}</button></li>)}
    </ul>}
  </div>;
}

type Draft = { title: string; subtitle: string; max_spins: number; open_minute: number; close_minute: number; prizes: Prize[] };
const timeLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const halfHours = Array.from({ length: 49 }, (_, i) => i * 30);

export function WheelPanel() {
  const wheel = useQuery(wheelQuery);
  const client = useQueryClient();
  const save = useServerFn(saveWheel); const reset = useServerFn(resetWheelToday);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (wheel.data && !draft) setDraft({ title: wheel.data.title, subtitle: wheel.data.subtitle, max_spins: wheel.data.max_spins, open_minute: wheel.data.open_minute, close_minute: wheel.data.close_minute, prizes: wheel.data.prizes }); }, [wheel.data, draft]);

  if (wheel.isError) return <p className="mt-6 text-sm text-destructive">Wheel settings could not be loaded.</p>;
  if (!draft || !wheel.data) return <p className="mt-6 text-sm text-muted-foreground">Loading...</p>;
  const wins = wheel.data.wins;
  const setPrize = (i: number, patch: Partial<Prize>) => setDraft((d) => d && { ...d, prizes: d.prizes.map((p, j) => j === i ? { ...p, ...patch } : p) });

  async function submit() {
    const parsed = wheelSchema.safeParse(draft);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message.includes("Closing") ? "Closing time must be after opening time." : parsed.error.issues[0]?.message.includes("different") ? "Prize names must be different from each other." : "Every prize needs a name and icon; at least 2 prizes are required."); return; }
    setBusy(true);
    try { await save({ data: parsed.data }); await client.invalidateQueries({ queryKey: wheelQuery.queryKey }); toast.success("Wheel saved. Guests will see the new version."); }
    catch { toast.error("Wheel could not be saved."); } finally { setBusy(false); }
  }
  async function resetToday() {
    setBusy(true);
    try { await reset(); await client.invalidateQueries({ queryKey: wheelQuery.queryKey }); toast.success("Today's counts were reset."); }
    catch { toast.error("Could not reset."); } finally { setBusy(false); }
  }

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Lucky Wheel</h1><p className="mt-1 text-sm text-muted-foreground">Change the wheel's texts and prizes here</p></div>
      <Button variant="outline" onClick={() => void resetToday()} disabled={busy}><RotateCcw />Reset today</Button>
    </div>

    <ClaimVerifier claims={wheel.data.claims} />

    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5">
      <label className="block space-y-1.5"><span className="text-sm font-medium">Title</span><input className={field} maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="block space-y-1.5"><span className="text-sm font-medium">Subtitle</span><input className={field} maxLength={160} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></label>
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium">Each guest can spin at most
        <input type="number" min={0} max={99} className={`${base} w-20 text-center`} value={draft.max_spins} onChange={(e) => setDraft({ ...draft, max_spins: Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)) })} />
        times per day <span className="text-xs font-normal text-muted-foreground">(0 = unlimited)</span></label>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">Café open from
          <select aria-label="Opening time" className={base} value={draft.open_minute} onChange={(e) => setDraft({ ...draft, open_minute: Number(e.target.value) })}>
            {halfHours.slice(0, -1).map((m) => <option key={m} value={m}>{timeLabel(m)}</option>)}
          </select>
          to
          <select aria-label="Closing time" className={base} value={draft.close_minute} onChange={(e) => setDraft({ ...draft, close_minute: Number(e.target.value) })}>
            {halfHours.slice(1).map((m) => <option key={m} value={m}>{timeLabel(m)}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Daily-limit prizes are spread across these hours and adjust to how busy it is: quiet mornings roll prizes over to later, busy hours make each spin less likely to win. After any prize, the next one comes at least an hour later; every prize counts toward the limit the moment it is won, even if you never check its code.</p>
      </div>
    </div>

    <h2 className="mt-8 text-lg font-semibold">Prizes</h2>
    <div className="mt-3 space-y-3">
      {draft.prizes.map((p, i) => {
        const mode = prizeMode(p.limit);
        return <article key={i} className="rounded-2xl border border-border bg-card p-4" style={{ borderLeftWidth: 6, borderLeftColor: p.c }}>
          <div className="flex items-center gap-2">
            <input aria-label="Prize icon" className={`${base} w-14 shrink-0 px-1 text-center text-xl`} maxLength={8} value={p.e} onChange={(e) => setPrize(i, { e: e.target.value })} />
            <input aria-label="Prize name" className={`${base} min-w-0 flex-1 font-medium`} maxLength={24} value={p.t} onChange={(e) => setPrize(i, { t: e.target.value })} />
            <input aria-label="Prize color" type="color" className="size-11 shrink-0 cursor-pointer rounded-xl border border-border bg-input p-1" value={p.c} onChange={(e) => setPrize(i, { c: e.target.value })} />
            <Button size="icon" variant="ghost" aria-label={`${p.t} delete`} className="text-destructive hover:text-destructive" disabled={draft.prizes.length <= 2} onClick={() => setDraft({ ...draft, prizes: draft.prizes.filter((_, j) => j !== i) })}><Trash2 /></Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Winning rule">
            {modes.map((m) => <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setPrize(i, { limit: limitForMode(m.id, p.limit || 1) })}
              className={`rounded-xl px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${mode === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{m.label}</button>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            {mode === "l" ? <div className="flex items-center gap-2">At most
              <Button size="icon" variant="secondary" className="size-8 rounded-full" aria-label="Decrease" onClick={() => setPrize(i, { limit: Math.max(1, (p.limit ?? 1) - 1) })}><Minus /></Button>
              <span className="w-6 text-center font-semibold text-foreground">{p.limit}</span>
              <Button size="icon" variant="secondary" className="size-8 rounded-full" aria-label="Increase" onClick={() => setPrize(i, { limit: Math.min(999, (p.limit ?? 1) + 1) })}><Plus /></Button>
              people can win today</div> : <span>{modes.find((m) => m.id === mode)?.hint}</span>}
            {mode === "u" && !p.x && <button type="button" aria-pressed={!!p.f}
              onClick={() => setDraft({ ...draft, prizes: draft.prizes.map((q, j) => ({ ...q, f: j === i ? !p.f : false })) })}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${p.f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {p.f ? "Most common win: 4 in 5 spins without a big prize; the rest Maybe Next Time (twice in a row about 3 times a day)" : "Make most common win"}</button>}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">Given today: {wins[p.t] ?? 0}</span>
          </div>
        </article>;
      })}
    </div>
    <Button variant="secondary" className="mt-3 w-full rounded-xl" disabled={draft.prizes.length >= 16}
      onClick={() => setDraft({ ...draft, prizes: [...draft.prizes, { t: `New prize ${draft.prizes.length + 1}`, e: "🎁", c: palette[draft.prizes.length % palette.length]!, limit: null }] })}><Plus />Add prize</Button>

    <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
      <Button size="lg" className="w-full rounded-xl" disabled={busy} onClick={() => void submit()}><Save />Save</Button>
    </div>
  </>;
}
