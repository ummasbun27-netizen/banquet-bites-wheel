// CDN caching for the public guest menu only. Applied in src/server.ts after the
// normal response is produced (not via Nitro routeRules, which can swallow SSR on Vercel).
export const MENU_CACHE_CONTROL = "public, max-age=0, s-maxage=30, stale-while-revalidate=600";

export function shouldCacheMenuResponse(request: Request, response: Response): boolean {
  if (request.method !== "GET") return false;
  if (response.status !== 200) return false;
  if (response.headers.has("set-cookie")) return false;
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return false;
  }
  return pathname === "/menu";
}

export function withMenuCacheHeader(request: Request, response: Response): Response {
  if (!shouldCacheMenuResponse(request, response)) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", MENU_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
