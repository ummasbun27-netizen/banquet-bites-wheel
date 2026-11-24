/**
 * Pure wheel maths (degrees), ported from the tested public/cark.html.
 * Slice i covers [rotation + i*arc, rotation + (i+1)*arc], measured clockwise from 3 o'clock;
 * the pin sits at the top (270°). The wheel turns clockwise, so indexes descend under the pin.
 */
export const PIN_ANGLE = 270;
export const SPIN_TURNS = 7;
export const SPIN_MS = 7200;
export const CREEP_PAUSE_MS = 650;
export const CREEP_MS = 1400;
export const CREEP_RESULT_DELAY_MS = 350;
export const NEAR_MISS_CHANCE = 0.7;

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

/** A real prize (not the miss slice) on a wheel with more than two slices may stop one slice short first. */
export function isNearMiss(prize: { x?: boolean | undefined } | undefined, n: number, random: number) {
  return !!prize && !prize.x && n > 2 && random < NEAR_MISS_CHANCE;
}

/** Slice the main spin stops on: the winner, or the slice just before it for a near-miss. */
export function landingSlice(winner: number, n: number, nearMiss: boolean) {
  return nearMiss ? (winner + 1) % n : winner;
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

/** Final rotation of the near-miss crawl: forward onto the centre of the winning slice, about one slice. */
export function creepTarget(current: number, winner: number, n: number) {
  const arc = sliceArc(n);
  let delta = mod(PIN_ANGLE - (winner + 0.5) * arc - current, 360);
  if (delta > arc * 1.6) delta = arc;
  return current + delta;
}

/** Quintic ease-out: very slow at the end. */
export const easeOutQuint = (k: number) => 1 - Math.pow(1 - k, 5);
/** Soft ease-in-out for the near-miss crawl. */
export const easeInOutQuad = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Tick loudness/pitch factor 0..1 from how far the wheel moved since the last frame. */
export function tickSpeed(deltaDeg: number, dtMs: number) {
  const radPerFrame = (Math.abs(deltaDeg) * Math.PI / 180) / Math.max(1, dtMs) * 16;
  return Math.min(1, radPerFrame * 6);
}
