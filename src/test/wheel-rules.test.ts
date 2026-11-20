import { describe, expect, it } from "vitest";
import { prizeMode, limitForMode, wheelSchema, wheelDay, dayFraction, prizeCeiling, prizeChance } from "@/lib/wheel-schema";

const prize = (t: string, limit: number | null) => ({ t, e: "🎁", c: "#8d5524", limit });

describe("lucky wheel rules", () => {
  it("no limit means anyone can win", () => expect(prizeMode(null)).toBe("u"));
  it("a limit of 0 means shown on the wheel but nobody wins", () => expect(prizeMode(0)).toBe("z"));
  it("a positive limit is a daily cap", () => expect(prizeMode(3)).toBe("l"));
  it("switching to daily limit keeps at least 1 winner", () => expect(limitForMode("l", 0)).toBe(1));
  it("prize names must be different", () => {
    expect(wheelSchema.safeParse({ title: "", subtitle: "", max_spins: 2, prizes: [prize("Free Tea", 1), prize("free tea", null)] }).success).toBe(false);
  });
  it("the wheel needs at least 2 prizes", () => {
    expect(wheelSchema.safeParse({ title: "", subtitle: "", max_spins: 2, prizes: [prize("Free Tea", 1)] }).success).toBe(false);
  });
  it("the day rolls over at midnight café time (UTC+3)", () => {
    expect(wheelDay(new Date("2026-11-16T20:59:00Z"))).toBe("2026-11-16");
    expect(wheelDay(new Date("2026-11-16T21:01:00Z"))).toBe("2026-11-17");
  });
});

import { guestWheelSchema } from "@/lib/wheel-schema";
test("guest wheel accepts public settings without daily limits", () => {
  const ok = guestWheelSchema.safeParse({ title: "Çark", subtitle: "", max_spins: 2, prizes: [{ t: "Kahve", e: "☕", c: "#8d5524", x: false }, { t: "Yok", e: "🙂", c: "#2f9e44", x: true }] });
  expect(ok.success).toBe(true);
});

// Café open 07:30–21:00 (450–1260 minutes), as the owner asked.
const OPEN = 450, CLOSE = 1260;
const at = (h: number, m = 0) => dayFraction(h * 60 + m, OPEN, CLOSE);

describe("limited prizes: ceiling across the open hours", () => {
  it("gives no limited prize before 07:30", () => {
    expect(prizeCeiling(3, at(7, 0))).toBe(0);
  });
  it("releases 1 of 3 prizes from 07:30, 2 from 12:00, 3 from 16:30", () => {
    expect(prizeCeiling(3, at(7, 31))).toBe(1);
    expect(prizeCeiling(3, at(11, 59))).toBe(1);
    expect(prizeCeiling(3, at(12, 1))).toBe(2);
    expect(prizeCeiling(3, at(16, 29))).toBe(2);
    expect(prizeCeiling(3, at(16, 31))).toBe(3);
  });
  it("releases every remaining prize after 21:00", () => {
    expect(prizeCeiling(3, at(21, 30))).toBe(3);
  });
  it("rejects a closing time before the opening time", () => {
    const p = (t: string) => ({ t, e: "🎁", c: "#8d5524", limit: null });
    expect(wheelSchema.safeParse({ title: "", subtitle: "", max_spins: 2, open_minute: 1260, close_minute: 450, prizes: [p("A"), p("B")] }).success).toBe(false);
  });
});

describe("limited prizes: chance adapts to how busy the café is", () => {
  it("is low on a busy morning and higher on a quiet one", () => {
    expect(prizeChance(3, at(9), 40, 100)).toBeLessThan(prizeChance(3, at(9), 2, 10));
  });
  it("reaches 100% just before closing so leftover prizes are still given", () => {
    expect(prizeChance(1, at(20, 55), 50, 60)).toBe(1);
  });
});

/** Simulates one day: spins at the given minutes, returns the minutes when the 3 limited prizes were won. */
function simulateDay(spinMinutes: number[], historyAvg: number | null, seed: number) {
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const wins: number[] = [];
  spinMinutes.forEach((m, i) => {
    const frac = dayFraction(m, OPEN, CLOSE);
    if (wins.length < prizeCeiling(3, frac) && rand() < prizeChance(3 - wins.length, frac, i, historyAvg)) wins.push(m);
  });
  return wins;
}
const evenly = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 0.5)) / n);

describe("limited prizes: simulated days", () => {
  it("on a busy day (120 spins) never gives 2 before 12:00 or 3 before 16:30, and gives all 3", () => {
    let allGiven = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const wins = simulateDay(evenly(120, OPEN, CLOSE), 120, seed);
      expect(wins.filter((m) => m < 720).length).toBeLessThanOrEqual(1);
      expect(wins.filter((m) => m < 990).length).toBeLessThanOrEqual(2);
      if (wins.length === 3) allGiven++;
    }
    expect(allGiven).toBeGreaterThanOrEqual(190);
  });
  it("when nobody comes in the morning, the prizes roll over to the evening (10 spins after 17:00)", () => {
    let allGiven = 0;
    for (let seed = 1; seed <= 200; seed++) if (simulateDay(evenly(10, 17 * 60, CLOSE), 40, seed).length === 3) allGiven++;
    expect(allGiven).toBeGreaterThanOrEqual(180);
  });
});

import { prizeGap, prizeGapBoost, UNLIMITED_PRIZE_CHANCE, MISS_CHANCE, DAILY_MISS_PAIRS, missRepeatChance } from "@/lib/wheel-schema";

describe("prizes never come in the same hour, except when needed to give them all", () => {
  it("keeps a one-hour gap when there is enough time left", () => {
    expect(prizeGap(CLOSE - 9 * 60, 6)).toBe(60);
  });
  it("shortens the gap only when the remaining prizes would not fit before 21:00", () => {
    expect(prizeGap(60, 3)).toBe(20);
  });
  it("unlimited prizes win only about 1 in 10 spins", () => expect(UNLIMITED_PRIZE_CHANCE).toBe(0.1));
});

/** Simulates the owner's setup (Free Coffee ×4, 10 Off ×2) with the gap; returns win minutes. */
function simulateGapDay(spinMinutes: number[], historyAvg: number | null, seed: number) {
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const limits = [4, 2];
  const won = [0, 0];
  const wins: number[] = [];
  spinMinutes.forEach((m, i) => {
    const frac = dayFraction(m, OPEN, CLOSE);
    const remaining = limits.reduce((s, l, k) => s + l - won[k]!, 0);
    const last = wins[wins.length - 1];
    const gap = prizeGap(CLOSE - m, remaining);
    if (last !== undefined && m - last < gap) return;
    const boost = prizeGapBoost(CLOSE - m, remaining, gap);
    const lucky = limits.map((l, k) => won[k]! < prizeCeiling(l, frac) && rand() < Math.min(1, prizeChance(l - won[k]!, frac, i, historyAvg) * boost));
    const k = lucky.findIndex(Boolean);
    if (k >= 0) { won[k]!++; wins.push(m); }
  });
  return wins;
}

describe("owner's setup: 4 free coffees and 2 discounts a day", () => {
  it("on a normal day (120 spins) prizes come less than an hour apart only rarely, and all 6 are given", () => {
    let allGiven = 0, pairs = 0, close = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const wins = simulateGapDay(evenly(120, OPEN, CLOSE), 120, seed);
      wins.slice(1).forEach((m, j) => { pairs++; if (m - wins[j]! < 60) close++; });
      if (wins.length === 6) allGiven++;
    }
    expect(close / pairs).toBeLessThan(0.03);
    expect(allGiven).toBeGreaterThanOrEqual(295);
  });
  it("on a quiet day (30 spins) all 6 are still given", () => {
    let allGiven = 0;
    for (let seed = 1; seed <= 300; seed++) if (simulateGapDay(evenly(30, OPEN, CLOSE), 30, seed).length === 6) allGiven++;
    expect(allGiven).toBeGreaterThanOrEqual(290);
  });
  it("big prizes stay few: at most the 6 limited ones a day", () => {
    const wins = simulateGapDay(evenly(120, OPEN, CLOSE), 120, 7);
    expect(wins.length).toBeLessThanOrEqual(6);
  });
});

/** Fallback spins only (no big prize): returns [misses, back-to-back pairs]. */
function simulateMisses(spins: number, seed: number): [number, number] {
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  let misses = 0, pairs = 0, last = false;
  evenly(spins, OPEN, CLOSE).forEach((m, i) => {
    const frac = dayFraction(m, OPEN, CLOSE);
    const chance = last ? missRepeatChance(DAILY_MISS_PAIRS - pairs, frac, i, spins) : MISS_CHANCE;
    const miss = rand() < chance;
    if (miss) { misses++; if (last) pairs++; }
    last = miss;
  });
  return [misses, pairs];
}

describe("when no big prize comes out", () => {
  it("Maybe Next Time comes 1 in 5 spins, the rest are 10 Birr Off", () => expect(MISS_CHANCE).toBe(0.2));
  it("Maybe Next Time twice in a row happens at most 3 times a day", () => {
    for (let seed = 1; seed <= 200; seed++) expect(simulateMisses(120, seed)[1]).toBeLessThanOrEqual(3);
  });
  it("on a normal day (120 spins) about 3 back-to-back pairs happen and about 1 in 5 spins is a miss", () => {
    let pairs = 0, misses = 0;
    for (let seed = 1; seed <= 200; seed++) { const [m, p] = simulateMisses(120, seed); misses += m; pairs += p; }
    expect(pairs / 200).toBeGreaterThan(2);
    expect(misses / (200 * 120)).toBeGreaterThan(0.15);
    expect(misses / (200 * 120)).toBeLessThan(0.25);
  });
  it("no more back-to-back pairs once 3 have happened today", () => expect(missRepeatChance(0, 0.5, 60, 120)).toBe(0));
  it("guests never see which prize is the most common win", () => {
    const guest = guestWheelSchema.parse({ title: "", subtitle: "", max_spins: 2, prizes: [{ t: "10 Birr Off", e: "💸", c: "#2f9e44", f: true }] });
    expect(guest.prizes[0]).not.toHaveProperty("f");
  });
});
