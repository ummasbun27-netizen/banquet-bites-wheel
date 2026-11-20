import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { menuFullWebp, menuThumbWebp } from "@/lib/menu-images";

describe("menu photo WebP mapping", () => {
  it("maps a stored /menu/*.jpg value to its 480px WebP thumbnail", () => {
    expect(menuThumbWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe("/menu/w480/317691ff-beans-1kg-clean.webp");
  });
  it("maps a stored /menu/*.jpg value to its full-size WebP", () => {
    expect(menuFullWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe("/menu/webp/317691ff-beans-1kg-clean.webp");
  });
  it("leaves uploaded photos and unknown files on their original URL", () => {
    expect(menuThumbWebp("/api/public/menu-photo/abc.jpg")).toBeUndefined();
    expect(menuThumbWebp("/menu/not-a-real-photo.jpg")).toBeUndefined();
  });
  it("every mapped WebP file exists in public/menu", async () => {
    const { readdirSync } = await import("node:fs");
    for (const f of readdirSync("public/menu").filter((n) => n.endsWith(".jpg"))) {
      const t = menuThumbWebp(`/menu/${f}`);
      const full = menuFullWebp(`/menu/${f}`);
      expect(t && existsSync(`public${t}`)).toBe(true);
      expect(full && existsSync(`public${full}`)).toBe(true);
    }
  });
});
