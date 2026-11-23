import { describe, expect, it } from "vitest";
import { socialInput } from "@/lib/social.functions";

describe("social accounts", () => {
  it("accepts only TikTok and Instagram", () => {
    expect(socialInput.safeParse({ accounts: [{ id: "tiktok", url: "" }, { id: "instagram", url: "https://instagram.com/x" }] }).success).toBe(true);
    expect(socialInput.safeParse({ accounts: [{ id: "facebook", url: "" }] }).success).toBe(false);
  });
  it("allows at most two accounts", () => {
    expect(socialInput.safeParse({ accounts: [{ id: "tiktok", url: "" }, { id: "instagram", url: "" }, { id: "tiktok", url: "" }] }).success).toBe(false);
  });
});
