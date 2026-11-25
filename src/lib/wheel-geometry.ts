/**
 * Pure wheel maths (degrees), ported from the tested public/cark.html.
 * Slice i covers [rotation + i*arc, rotation + (i+1)*arc], measured clockwise from 3 o'clock;
 * the pin sits at the top (270°). The wheel turns clockwise, so indexes descend under the pin.
 */
export const PIN_ANGLE = 270;
export const SPIN_TURNS = 6;
export const SPIN_MS = 6500;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function sliceArc(n: number) {
  return 360 / Math.max(n, 1);
}

/** Rotation that centres the first prize under the pin. */
export function startRotation(n: number) {
  return PIN_ANGLE - 0.5 * sliceArc(n);
}

/** Index of the slice currently under the pin. */
export function sliceUnderPin(rotation: number, n: number) {
  if (n < 1) return 0;
  return Math.floor(mod(PIN_ANGLE - rotation, 360) / sliceArc(n)) % n;
}

/**
 * Final rotation of the main spin: at least `turns` full clockwise turns, stopping inside `slice`.
 * `jitter` in [-0.5, 0.5) moves the stop up to a quarter slice off centre (never across an edge).
 */
export function spinTarget(current: number, slice: number, n: number, jitter = 0, turns = SPIN_TURNS) {
  const arc = sliceArc(n);
  const want = PIN_ANGLE - (slice + 0.5) * arc + jitter * arc * 0.5;
  return current + mod(want - mod(current, 360), 360) + 360 * turns;
}

/** Long, smooth ease-out (power 3.5): slows gently and rests once, on the target. */
export const easeOutSlow = (k: number) => 1 - Math.pow(1 - k, 3.5);

/** Tick loudness/pitch factor 0..1 from how far the wheel moved since the last frame. */
export function tickSpeed(deltaDeg: number, dtMs: number) {
  const radPerFrame = (Math.abs(deltaDeg) * Math.PI / 180) / Math.max(1, dtMs) * 16;
  return Math.min(1, radPerFrame * 6);
}

/** Random display order (Fisher-Yates): a permutation of 0..n-1; entry p is the original prize index on slice p. */
export function shuffleOrder(n: number, random: () => number = Math.random) {
  const order = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    const t = order[i]!; order[i] = order[j]!; order[j] = t;
  }
  return order;
}

/** Slice position of an original prize index in the display order (-1 if missing). */
export function positionOf(order: readonly number[], originalIndex: number) {
  return order.indexOf(originalIndex);
}
