import { describe, expect, it } from "vitest";
import { MENU_CACHE_CONTROL, withMenuCacheHeader } from "@/lib/menu-cache";

const BASE = "https://example.com";
const ok = (init?: ResponseInit) => new Response("<html></html>", { status: 200, ...init });
const cc = (r: Response) => r.headers.get("cache-control");

describe("menu CDN cache header", () => {
  it("adds the CDN cache header to a successful GET /menu", () => {
    const r = withMenuCacheHeader(new Request(`${BASE}/menu`), ok());
    expect(cc(r)).toBe("public, max-age=0, s-maxage=30, stale-while-revalidate=600");
    expect(cc(r)).toBe(MENU_CACHE_CONTROL);
  });
  it("keeps the query string case on /menu cacheable (pathname is exactly /menu)", () => {
    expect(cc(withMenuCacheHeader(new Request(`${BASE}/menu?table=4`), ok()))).toBe(MENU_CACHE_CONTROL);
  });
  it("never caches other paths", () => {
    for (const p of ["/", "/dashboard", "/login", "/api/public/wheel-config", "/_serverFn/abc", "/menu/", "/menu/x.jpg", "/menus"]) {
      expect(cc(withMenuCacheHeader(new Request(`${BASE}${p}`), ok()))).toBeNull();
    }
  });
  it("never caches non-GET requests", () => {
    expect(cc(withMenuCacheHeader(new Request(`${BASE}/menu`, { method: "POST" }), ok()))).toBeNull();
    expect(cc(withMenuCacheHeader(new Request(`${BASE}/menu`, { method: "HEAD" }), ok()))).toBeNull();
  });
  it("never caches non-200 responses", () => {
    expect(cc(withMenuCacheHeader(new Request(`${BASE}/menu`), new Response("x", { status: 500 })))).toBeNull();
    expect(cc(withMenuCacheHeader(new Request(`${BASE}/menu`), new Response(null, { status: 307, headers: { location: "/" } })))).toBeNull();
  });
  it("never caches a response that sets a cookie", () => {
    const r = withMenuCacheHeader(new Request(`${BASE}/menu`), ok({ headers: { "set-cookie": "a=1" } }));
    expect(cc(r)).toBeNull();
  });
});
