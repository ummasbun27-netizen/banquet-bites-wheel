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
