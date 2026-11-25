import { describe, expect, it } from "vitest";
import { SPIN_TURNS, easeOutSlow, sliceUnderPin, spinTarget, startRotation } from "@/lib/wheel-geometry";

describe("guest wheel geometry", () => {
  it("starts with the first prize centred under the pin", () => {
    expect(startRotation(8)).toBe(270 - 22.5);
    expect(sliceUnderPin(startRotation(8), 8)).toBe(0);
  });

  it("one spin stops on the server's winning slice after at least 6 turns", () => {
    expect(SPIN_TURNS).toBe(6);
    for (const n of [3, 6, 8, 12]) {
      for (let index = 0; index < n; index++) {
        for (const jitter of [-0.49, 0, 0.49]) {
          for (const start of [startRotation(n), 123.4, 5000.7]) {
            const end = spinTarget(start, index, n, jitter);
            expect(sliceUnderPin(end, n)).toBe(index);
            expect(end - start).toBeGreaterThanOrEqual(6 * 360);
          }
        }
      }
    }
  });

  it("eases out monotonically from 0 to 1", () => {
    expect(easeOutSlow(0)).toBe(0);
    expect(easeOutSlow(1)).toBe(1);
    let prev = 0;
    for (let k = 0.05; k <= 1; k += 0.05) { expect(easeOutSlow(k)).toBeGreaterThanOrEqual(prev); prev = easeOutSlow(k); }
  });
});

import { positionOf, shuffleOrder } from "@/lib/wheel-geometry";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

describe("shuffled slice order", () => {
  it("is a permutation containing each index once", () => {
    for (const n of [1, 2, 5, 8, 12]) for (const seed of [1, 7, 42]) {
      const order = shuffleOrder(n, seeded(seed));
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("positionOf round-trips", () => {
    const order = shuffleOrder(9, seeded(3));
    for (let w = 0; w < 9; w++) expect(order[positionOf(order, w)]).toBe(w);
  });

  it("lands the server's original prize under the pin", () => {
    for (const n of [3, 6, 8, 11]) for (const seed of [2, 9, 123]) {
      const order = shuffleOrder(n, seeded(seed));
      for (let w = 0; w < n; w++) for (const jitter of [-0.5, 0, 0.49]) {
        const end = spinTarget(startRotation(n) + seed * 13, positionOf(order, w), n, jitter);
        expect(order[sliceUnderPin(end, n)]).toBe(w);
      }
    }
  });
});
