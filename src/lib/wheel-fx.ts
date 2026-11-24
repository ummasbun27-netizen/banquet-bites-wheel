/**
 * Browser-only wheel effects (WebAudio sounds, vibration, confetti), ported from public/cark.html.
 * Nothing here runs at import time, so it is safe to import from SSR-rendered modules.
 */
type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let soundOn = true;
const SOUND_KEY = "carksnd";

export function loadSoundSetting() {
  try { soundOn = localStorage.getItem(SOUND_KEY) !== "0"; } catch { /* storage may be blocked */ }
  return soundOn;
}

export function setSoundSetting(on: boolean) {
  soundOn = on;
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch { /* storage may be blocked */ }
}

/** Create or resume the AudioContext; call from a user gesture (the SPIN tap). */
export function unlockAudio() {
  try {
    if (!ctx) {
      const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
      const C = w.AudioContext ?? w.webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch { /* audio not available */ }
  return ctx;
}

function tone(f: number, t0: number, d: number, type: OscillatorType = "sine", vol = 0.15, f2?: number) {
  const a = ctx;
  if (!a || !soundOn) return;
  try {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + d + 0.02);
  } catch { /* ignore */ }
}

export function vibrate(pattern: number | number[]) {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}

/** Short click; `speed` 0..1 raises pitch and volume. */
export function tickSound(speed: number) {
  tone(1500 - 300 * speed, 0, 0.035, "square", 0.05 + 0.04 * speed, 700);
  vibrate(8);
}
export function winSound() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, "triangle", 0.18));
  tone(1568, 0.6, 0.7, "sine", 0.15);
  vibrate([60, 40, 60, 40, 160]);
}
export function missSound() {
  tone(330, 0, 0.25, "sine", 0.14, 260);
  tone(247, 0.22, 0.4, "sine", 0.14, 180);
  vibrate(80);
}
export function creepSound() {
  tone(220, 0, 0.5, "sine", 0.06, 440);
}
/** Rising beeps while the gift box shakes. */
export function giftSound() {
  vibrate([30, 30, 30, 30, 30]);
  [0, 0.15, 0.3, 0.45, 0.6].forEach((t, k) => tone(300 + k * 60, t, 0.12, "square", 0.07));
}

const CONFETTI = ["#f03e3e", "#fab005", "#40c057", "#228be6", "#be4bdb", "#fd7e14", "#ffd43b"];
let confettiId = 0;

/** Big confetti on a full-screen canvas: centre + both sides, second burst at 700 ms, ~5 s. */
export function confetti(canvas: HTMLCanvasElement | null) {
  const id = ++confettiId;
  const c = canvas?.getContext("2d");
  if (!canvas || !c) return;
  const W = (canvas.width = window.innerWidth), H = (canvas.height = window.innerHeight);
  type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; round: boolean };
  const ps: P[] = [];
  const burst = (px: number, py: number, ang: number, spread: number, n: number, v0: number) => {
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spread, v = v0 * (0.55 + Math.random() * 0.7);
      ps.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 7, h: 4 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.45, c: CONFETTI[(Math.random() * CONFETTI.length) | 0] ?? "#fab005", round: Math.random() < 0.25 });
    }
  };
  burst(W * 0.5, H * 0.62, -Math.PI / 2, 1.8, 120, 17);
  burst(0, H * 0.8, -Math.PI / 3, 0.9, 90, 19);
  burst(W, H * 0.8, (-2 * Math.PI) / 3, 0.9, 90, 19);
  const t0 = performance.now();
  let second = false;
  const frame = (n: number) => {
    if (id !== confettiId) { c.clearRect(0, 0, W, H); return; }
    c.clearRect(0, 0, W, H);
    if (!second && n - t0 > 700) {
      second = true;
      burst(W * 0.25, H * 0.5, -Math.PI / 2, 1.4, 70, 15);
      burst(W * 0.75, H * 0.5, -Math.PI / 2, 1.4, 70, 15);
    }
    for (const p of ps) {
      p.vy += 0.3; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c;
      if (p.round) { c.beginPath(); c.arc(0, 0, p.w / 2, 0, 7); c.fill(); } else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    if (n - t0 < 5000) requestAnimationFrame(frame); else c.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(frame);
}

/** Stop any running confetti (it clears itself on the next frame). */
export function stopConfetti() {
  confettiId++;
}
