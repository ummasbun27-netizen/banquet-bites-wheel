import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FerrisWheel, LoaderCircle, RotateCw } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { guestWheelSchema } from "@/lib/wheel-schema";
import { loadPrizes, savePrize, type SavedPrize } from "@/lib/saved-prizes";
import {
  SPIN_MS, easeOutSlow, sliceUnderPin, spinTarget, startRotation, tickSpeed,
} from "@/lib/wheel-geometry";
import {
  confetti, giftSound, loadSoundSetting, missSound, setSoundSetting, stopConfetti,
  tickSound, unlockAudio, vibrate, winSound,
} from "@/lib/wheel-fx";

const RIM_LIGHTS = Array.from({ length: 24 }, (_, j) => j);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function saveCount(n: number) {
  try { localStorage.setItem("carkspin", JSON.stringify({ d: today(), n })); } catch { /* storage may be blocked */ }
}
function spinCount() {
  try {
    const saved = JSON.parse(localStorage.getItem("carkspin") || "{}");
    return saved.d === today() ? saved.n : 0;
  } catch { return 0; }
}

/** Splits a prize name into one or two lines, like the original wheel. */
function wheelLines(t: string): string[] {
  const w = t.split(" ");
  if (w[0] === "Free") return [w[0], w.slice(1).join(" ")].filter(Boolean);
  if (w.length > 2) return [w[0] + " " + w[1], w.slice(2).join(" ")];
  return w;
}

/** Mount with the menu: settings load before the guest taps the wheel. */
export function GuestWheel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const config = useQuery({
    queryKey: ["guest-wheel"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/public/wheel-config", { signal });
      if (!response.ok) throw new Error("Wheel could not be loaded.");
      return guestWheelSchema.parse(await response.json());
    },
    staleTime: 30_000,
    retry: 1,
  });
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPrize[]>([]);
  const [hasSpun, setHasSpun] = useState(false);
  const [glow, setGlow] = useState(false);
  const [gift, setGift] = useState(false);
  const [sound, setSound] = useState(true);
  const frame = useRef<number | null>(null);
  const spinning = useRef(false);
  const rot = useRef(0);
  const lastSlice = useRef(-1);
  const timers = useRef<number[]>([]);
  const revealTimer = useRef<number | null>(null);
  const pin = useRef<HTMLDivElement>(null);
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (open) { setCount(spinCount()); setSaved(loadPrizes()); setSound(loadSoundSetting()); }
    else stopConfetti();
  }, [open]);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timers.current.forEach((t) => clearTimeout(t));
    if (revealTimer.current !== null) clearTimeout(revealTimer.current);
    stopConfetti();
  }, []);
  const settings = config.data;
  const prizes = settings?.prizes ?? [];
  const full = !!settings && settings.max_spins > 0 && count >= settings.max_spins;
  const result = winner === null ? undefined : prizes[winner];
  // Before the first spin, the first prize sits centred under the pin (not on a slice edge).
  const shownRotation = hasSpun ? rotation : startRotation(prizes.length);

  function wigglePin() {
    const el = pin.current;
    if (!el) return;
    el.classList.remove("wheel-tick");
    void el.offsetWidth;
    el.classList.add("wheel-tick");
  }

  /** Animates the wheel; ticks (sound, vibration, pin wiggle) whenever a new slice passes the pin. */
  function animate(from: number, to: number, duration: number, ease: (k: number) => number, done: () => void) {
    const n = prizes.length;
    const started = performance.now();
    let prev = from, prevTime = started;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const r = from + (to - from) * ease(progress);
      rot.current = r;
      setRotation(r);
      const speed = tickSpeed(r - prev, now - prevTime);
      prev = r; prevTime = now;
      const slice = sliceUnderPin(r, n);
      if (slice !== lastSlice.current) {
        if (lastSlice.current !== -1) { tickSound(speed); wigglePin(); }
        lastSlice.current = slice;
      }
      if (progress < 1) frame.current = requestAnimationFrame(step);
      else { frame.current = null; done(); }
    };
    frame.current = requestAnimationFrame(step);
  }

  function closeResult() {
    if (revealTimer.current !== null) { clearTimeout(revealTimer.current); revealTimer.current = null; }
    setWinner(null); setError("");
  }

  function toggleSound() {
    const on = !sound;
    setSound(on);
    setSoundSetting(on);
    if (on) { unlockAudio(); tickSound(0.5); }
  }

  async function spin() {
    if (!settings || spinning.current || full) return;
    spinning.current = true;
    // Create/resume audio inside the tap so phones allow the sounds.
    unlockAudio(); vibrate(15);
    setBusy(true); closeResult(); setCode(null);
    try {
      // The server counts spins per device; the saved count only drives the button text.
      const response = await fetch("/api/public/wheel-spin", { method: "POST" });
      const result: { index?: number; code?: string | null; used?: number; error?: string } = await response.json().catch(() => ({}));
      if (response.status === 429 && result.error === "device_limit") {
        saveCount(settings.max_spins); setCount(settings.max_spins);
        setBusy(false); spinning.current = false; return;
      }
      if (!response.ok) throw new Error("Can't spin right now. Please try again.");
      const index = result.index;
      if (typeof index !== "number" || !Number.isInteger(index) || !prizes[index]) throw new Error("Please try again.");
      const next = typeof result.used === "number" ? result.used : spinCount() + 1;
      saveCount(next);
      setCount(next);
      const n = prizes.length;
      const won = prizes[index];
      const code = result.code ?? null;
      const showResult = () => {
        if (code && won && !won.x) setSaved(savePrize({ code, prize: won.t, emoji: won.e }));
        setGlow(false); setBusy(false); spinning.current = false;
        setCode(code); setWinner(index);
        if (!won || won.x) { setGift(false); missSound(); return; }
        // A gift box shakes for a second, then opens onto the prize.
        setGift(true); giftSound();
        revealTimer.current = window.setTimeout(() => {
          revealTimer.current = null;
          setGift(false); winSound(); confetti(confettiCanvas.current);
        }, 1000);
      };
      // The server already chose the prize; one smooth spin lands straight on it.
      const start = hasSpun ? rot.current : startRotation(n);
      const target = spinTarget(start, index, n, Math.random() - 0.5);
      rot.current = start;
      lastSlice.current = sliceUnderPin(start, n);
      setHasSpun(true); setRotation(start); setGlow(true);
      // Always animate: the spin itself is the feature, even when the device asks for reduced motion.
      animate(start, target, SPIN_MS, easeOutSlow, showResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      setGlow(false); setBusy(false); spinning.current = false;
    }
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-50 mx-auto flex max-w-lg flex-col overflow-y-auto bg-background text-foreground outline-none">
        <div className="flex shrink-0 items-center px-4 pt-3">
          <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Back to menu" title="Back to menu"><ArrowLeft className="size-5" /></Button></Dialog.Close>
          <button type="button" onClick={toggleSound} aria-label="Sound" aria-pressed={sound} title={sound ? "Sound on" : "Sound off"} className="ml-auto flex size-[42px] items-center justify-center rounded-full border border-border bg-card text-xl">
            <span aria-hidden>{sound ? "🔊" : "🔇"}</span>
          </button>
        </div>
        <header className="px-4 pb-2 text-center">
          <Dialog.Title className="break-words text-3xl font-bold">{settings?.title || "🎡"}</Dialog.Title>
          <p className="mt-1.5 text-muted-foreground">{config.isError ? "Could not load the wheel." : settings?.subtitle}</p>
        </header>
        <div className="px-4 pb-10 pt-3">
          <section className="rounded-[20px] border border-border bg-card p-5">
            <div className={`relative mx-auto my-2 aspect-square w-[min(88vw,340px)] ${prizes.length > 0 ? `wheel-ring${glow ? " wheel-go" : ""}` : ""}`}>
              {prizes.length > 0 ? <>
              <svg viewBox="0 0 680 680" role="img" aria-label="Prize wheel" className="h-full w-full overflow-visible">
                <defs><filter id="wheel-text-shadow" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" /></filter></defs>
                <g transform={`rotate(${shownRotation} 340 340)`}>
                  {prizes.map((prize, i) => {
                    const arc = Math.PI * 2 / prizes.length;
                    const a = i * arc, b = a + arc;
                    const lines = wheelLines(prize.t);
                    const longest = Math.max(...lines.map((l) => l.length));
                    const size = Math.max(14, Math.min(26, Math.floor(140 / (longest * 0.58))));
                    return <g key={prize.t}>
                      <path d={`M340 340 L${340 + 332 * Math.cos(a)} ${340 + 332 * Math.sin(a)} A332 332 0 ${arc > Math.PI ? 1 : 0} 1 ${340 + 332 * Math.cos(b)} ${340 + 332 * Math.sin(b)} Z`} fill={prize.c} stroke="#fff" strokeWidth="4" />
                      <g transform={`translate(340 340) rotate(${(a + arc / 2) * 180 / Math.PI})`}>
                        <text x="292" y="3" fontSize="46" textAnchor="middle" dominantBaseline="middle" transform="rotate(90 292 3)">{prize.e}</text>
                        <g filter="url(#wheel-text-shadow)" fill="#fff" fontWeight="700" fontSize={size} textAnchor="end" dominantBaseline="middle" fontFamily="system-ui, sans-serif">
                          {lines.map((line, n) => <text key={n} x="246" y={lines.length > 1 ? (n === 0 ? -15 : 15) : 0}>{line}</text>)}
                        </g>
                      </g>
                    </g>;
                  })}
                </g>
                <g transform={`rotate(${shownRotation * 0.5} 340 340)`}>
                  {RIM_LIGHTS.map((j) => {
                    const a = j * Math.PI * 2 / RIM_LIGHTS.length;
                    return <circle key={j} cx={340 + 336 * Math.cos(a)} cy={340 + 336 * Math.sin(a)} r="4.5" fill={j % 2 ? "#ffe08a" : "#fff"} />;
                  })}
                </g>
                <circle cx="340" cy="340" r="34" fill="#fff" stroke="#d9480f" strokeWidth="6" />
              </svg>
              <div ref={pin} aria-hidden className="wheel-pin" />
              </> : <div className="flex h-full items-center justify-center rounded-full bg-secondary text-muted-foreground">
                {config.isError ? <FerrisWheel className="size-16" /> : <LoaderCircle aria-label="Loading wheel" className="size-10 animate-spin motion-reduce:animate-none" />}
              </div>}
            </div>
            {config.isError
              ? <Button variant="secondary" className="mx-auto mt-3.5 flex h-auto w-full max-w-[340px] rounded-full py-3.5" onClick={() => void config.refetch()}><RotateCw className="size-4" />Try again</Button>
              : <Button className="wheel-spin-btn mx-auto mt-[18px] flex h-auto w-full max-w-[340px] rounded-full py-3.5 text-lg font-bold" disabled={!settings || busy || full} onClick={() => void spin()}>
                  {!settings || busy ? "…" : full ? "Out of spins, come back tomorrow" : settings.max_spins > 0 ? `SPIN! (${Math.max(0, settings.max_spins - count)} left)` : "SPIN!"}
                </Button>}
          </section>
          {saved.length > 0 && <section aria-label="Your prize codes" className="mt-4 rounded-[20px] border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Your prize codes today</h2>
            <p className="text-sm text-muted-foreground">Saved on this phone — show a code at the counter.</p>
            <ul className="mt-3 space-y-2">
              {saved.map((p) => <li key={p.code} className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3">
                <span aria-hidden className="text-3xl">{p.emoji}</span>
                <span className="min-w-0 flex-1 break-words font-semibold">{p.prize}</span>
                <span className="font-mono text-xl font-extrabold tracking-[0.15em]">{p.code}</span>
              </li>)}
            </ul>
          </section>}
        </div>
        {(result || error) && <div className="fixed inset-0 z-10 flex items-center justify-center bg-overlay p-5" onClick={closeResult}>
          <div role="status" className="wheel-pop relative w-full max-w-[360px] overflow-hidden rounded-3xl bg-card px-5 py-6 text-center" onClick={(e) => e.stopPropagation()}>
            {!error && result && !result.x && !gift && <div aria-hidden className="wheel-rays" />}
            <div className="relative">
              <p key={error ? "error" : gift ? "gift" : "prize"} className={`text-[5.5rem] leading-[1.2] ${error ? "" : gift ? "wheel-gift-shake" : "wheel-reveal"}`}>{error ? "⚠️" : gift ? "🎁" : result?.e}</p>
              {!error && !gift && <p className="wheel-fade">{result?.x ? "Not this time" : "Congratulations! You won:"}</p>}
              {(error || !gift) && <p className={`my-1.5 break-words text-2xl font-extrabold ${error ? "" : "wheel-fade"}`}>{error ? "Please try again." : result?.x ? "Better luck next time!" : result?.t}</p>}
              {!error && !gift && !result?.x && code && <div className="wheel-fade mt-3 rounded-2xl bg-secondary px-4 py-3">
                <p className="text-sm text-muted-foreground">Your prize code</p>
                <p className="font-mono text-4xl font-extrabold tracking-[0.2em]">{code}</p>
                <p className="mt-1 text-sm text-muted-foreground">Valid today only — saved below on this phone. Show it at the counter.</p>
              </div>}
              <button type="button" className="mt-2.5 w-full text-muted-foreground" onClick={closeResult}>Close</button>
            </div>
          </div>
        </div>}
        <canvas ref={confettiCanvas} aria-hidden className="pointer-events-none fixed inset-0 z-20 h-full w-full" />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}