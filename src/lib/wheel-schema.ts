import { z } from "zod";

/** limit: null = anyone can win (unlimited), 0 = shown only, n = at most n winners per day. */
export const prizeSchema = z.object({
  t: z.string().trim().min(1).max(24),
  e: z.string().trim().min(1).max(8),
  c: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  limit: z.number().int().min(0).max(999).nullable(),
  x: z.boolean().optional(),
  /** Common consolation prize (unlimited): wins most spins when no daily-limit prize comes out. */
  f: z.boolean().optional(),
});
export const wheelSchema = z.object({
  title: z.string().trim().max(80),
  subtitle: z.string().trim().max(160),
  max_spins: z.number().int().min(0).max(99),
  /** Café opening hours as minutes after midnight (local time); limited prizes are spread across them. */
  open_minute: z.number().int().min(0).max(1410).default(450),
  close_minute: z.number().int().min(30).max(1440).default(1260),
  prizes: z.array(prizeSchema).min(2).max(16)
    .refine((p) => new Set(p.map((x) => x.t.toLocaleLowerCase("tr"))).size === p.length, "Prize names must be different."),
}).refine((w) => w.close_minute > w.open_minute, "Closing time must be after opening time.");
/** Public wheel data for guests: daily limits stay on the server. */
export const guestWheelSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  max_spins: z.number().int().min(0),
  prizes: z.array(prizeSchema.omit({ limit: true, f: true })),
});
export type Prize = z.infer<typeof prizeSchema>;
export type WheelSettings = z.infer<typeof wheelSchema>;
export type PrizeMode = "u" | "l" | "z";

export function prizeMode(limit: number | null): PrizeMode {
  return limit === null ? "u" : limit === 0 ? "z" : "l";
}
export function limitForMode(mode: PrizeMode, count: number): number | null {
  return mode === "u" ? null : mode === "z" ? 0 : Math.max(1, Math.round(count) || 1);
}
/** The wheel's day follows the café's local time (UTC+3). */
export function wheelDay(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

/*
 * Daily-limit prize pacing. The database functions wheel_day_fraction(), wheel_prize_ceiling() and
 * wheel_prize_chance() decide on every spin; these mirrors use the same formulas for tests.
 */

/** Share of today's open hours that has passed: 0 before opening, 1 after closing. */
export function dayFraction(localMinute: number, open: number, close: number): number {
  return Math.max(0, Math.min(1, (localMinute - open) / (close - open)));
}

/**
 * Hard ceiling: open hours are split into `limit` equal parts and each part releases one more
 * winner (3 prizes, 07:30–21:00: 07:30, 12:00, 16:30). Unwon prizes roll over to later parts.
 */
export function prizeCeiling(limit: number, frac: number): number {
  if (frac <= 0) return 0;
  if (frac >= 1) return limit;
  return Math.min(limit, Math.floor(limit * frac) + 1);
}

/**
 * Chance that this spin wins one of the prize's remaining copies: remaining copies divided by the
 * spins still expected today. Expected spins for the whole day are the larger of today's pace so far
 * and the average of the last 7 days (30 with no history), so a busy day lowers the chance and a
 * quiet morning does not hand everything to the first evening guests. Near closing the chance
 * reaches 100% so leftover prizes still go out.
 */
export function prizeChance(remaining: number, frac: number, todaySpins: number, historyAvg: number | null): number {
  const observed = todaySpins / Math.max(frac, 0.1);
  const total = Math.max(observed, historyAvg ?? 30);
  const expectedLeft = Math.max(total * (1 - frac), 1);
  return Math.min(1, remaining / expectedLeft);
}

/** Other unlimited real prizes win on this share of spins (when the gap allows). */
export const UNLIMITED_PRIZE_CHANCE = 0.1;
/**
 * When no daily-limit prize comes out, "Maybe Next Time" wins this share of spins and the consolation
 * prize (f) the rest (mirrors spin_wheel). Consolation wins do not reset the gap between prizes.
 */
export const MISS_CHANCE = 0.2;
/** "Maybe Next Time" twice in a row happens about this many times a day, never more. */
export const DAILY_MISS_PAIRS = 3;

/**
 * Right after a "Maybe Next Time", chance of another one (mirrors wheel_miss_repeat_chance): pairs still
 * allowed today divided by the misses still expected today, so pairs spread over the day.
 */
export function missRepeatChance(pairsLeft: number, frac: number, todaySpins: number, historyAvg: number | null): number {
  if (pairsLeft <= 0) return 0;
  const total = Math.max(todaySpins / Math.max(frac, 0.1), historyAvg ?? 30);
  const missesLeft = Math.max(Math.max(total * (1 - frac), 1) * MISS_CHANCE, 1);
  return Math.min(1, pairsLeft / missesLeft);
}

/**
 * Minimum minutes between two real prizes (mirrors wheel_prize_gap): one hour, shortened only when the
 * limited prizes still to give would not otherwise fit into the open minutes left today.
 */
export function prizeGap(minutesLeft: number, remaining: number): number {
  if (remaining <= 0) return 60;
  return Math.min(60, Math.max(minutesLeft, 0) / remaining);
}

/**
 * Spins inside a gap cannot win, so open spins get a proportionally higher chance (mirrors
 * wheel_prize_gap_boost); this keeps prizes on schedule instead of bunching up before closing.
 */
export function prizeGapBoost(minutesLeft: number, remaining: number, gap: number): number {
  if (minutesLeft <= 0 || remaining <= 1) return 1;
  return minutesLeft / Math.max(minutesLeft - (remaining - 1) * gap, minutesLeft * 0.25);
}
