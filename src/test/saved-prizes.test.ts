import { describe, expect, it } from "vitest";
import { addPrize, todaysPrizes, type SavedPrize } from "@/lib/saved-prizes";

const coffee: SavedPrize = { code: "ABC234", prize: "Free Coffee", emoji: "☕", day: "2026-11-20" };

describe("saved prize codes", () => {
  it("keeps today's won codes after the wheel is closed and reopened", () => {
    const raw = JSON.stringify(addPrize([], coffee));
    expect(todaysPrizes(raw, "2026-11-20")).toEqual([coffee]);
  });

  it("drops codes won on an earlier day, because codes are valid only that day", () => {
    const raw = JSON.stringify([coffee]);
    expect(todaysPrizes(raw, "2026-11-21")).toEqual([]);
  });

  it("does not store the same code twice", () => {
    expect(addPrize([coffee], coffee)).toHaveLength(1);
  });
});
