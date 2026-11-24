import { describe, expect, it } from "vitest";
import { creepTarget, isNearMiss, landingSlice, sliceUnderPin, spinTarget, startRotation } from "@/lib/wheel-geometry";

describe("guest wheel geometry", () => {
  it("starts with the first prize centred under the pin", () => {
    expect(startRotation(8)).toBe(270 - 22.5);
    expect(sliceUnderPin(startRotation(8), 8)).toBe(0);
  });

  it("stops on the server's winning slice after at least 7 turns", () => {
    for (const jitter of [-0.49, 0, 0.49]) {
      const end = spinTarget(startRotation(8), 5, 8, jitter);
      expect(sliceUnderPin(end, 8)).toBe(5);
      expect(end - startRotation(8)).toBeGreaterThanOrEqual(7 * 360);
    }
  });

  it("near-miss stops one slice before the prize, then crawls onto it", () => {
    expect(landingSlice(3, 8, true)).toBe(4);
    expect(landingSlice(7, 8, true)).toBe(0);
    const first = spinTarget(0, landingSlice(3, 8, true), 8, 0.3);
    expect(sliceUnderPin(first, 8)).toBe(4);
    expect(sliceUnderPin(creepTarget(first, 3, 8), 8)).toBe(3);
  });

  it("never near-misses on the miss slice or a two-slice wheel", () => {
    expect(isNearMiss({ x: true }, 8, 0)).toBe(false);
    expect(isNearMiss({}, 2, 0)).toBe(false);
    expect(isNearMiss({}, 8, 0.69)).toBe(true);
    expect(isNearMiss({}, 8, 0.7)).toBe(false);
  });
});
