import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { menuFullWebp, menuImage, menuStaticUrl, menuThumbWebp } from "@/lib/menu-images";

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

describe("VITE_MENU_STATIC_URL base URL", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("keeps relative /menu paths when the variable is not set", () => {
    vi.stubEnv("VITE_MENU_STATIC_URL", "");
    expect(menuImage("/menu/317691ff-beans-1kg-clean.jpg")).toBe("/menu/317691ff-beans-1kg-clean.jpg");
    expect(menuThumbWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe("/menu/w480/317691ff-beans-1kg-clean.webp");
    expect(menuFullWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe("/menu/webp/317691ff-beans-1kg-clean.webp");
  });
  it("prefixes every bundled /menu path when the variable is set", () => {
    vi.stubEnv("VITE_MENU_STATIC_URL", "https://cdn.example.com/menu-static/");
    const base = "https://cdn.example.com/menu-static";
    expect(menuImage("/menu/317691ff-beans-1kg-clean.jpg")).toBe(`${base}/menu/317691ff-beans-1kg-clean.jpg`);
    expect(menuThumbWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe(`${base}/menu/w480/317691ff-beans-1kg-clean.webp`);
    expect(menuFullWebp("/menu/317691ff-beans-1kg-clean.jpg")).toBe(`${base}/menu/webp/317691ff-beans-1kg-clean.webp`);
    expect(menuStaticUrl("/menu/scene/hero.jpg")).toBe(`${base}/menu/scene/hero.jpg`);
    expect(menuStaticUrl("/menu/ec4251e9-ummasbun-coffee-logo.webp")).toBe(`${base}/menu/ec4251e9-ummasbun-coffee-logo.webp`);
  });
  it("never touches non-/menu paths such as uploaded photos", () => {
    vi.stubEnv("VITE_MENU_STATIC_URL", "https://cdn.example.com/menu-static");
    expect(menuImage("/api/public/menu-photo/abc.jpg")).toBe("/api/public/menu-photo/abc.jpg");
    expect(menuThumbWebp("/api/public/menu-photo/abc.jpg")).toBeUndefined();
  });
});
