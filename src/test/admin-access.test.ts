import { beforeEach, describe, expect, it, vi } from "vitest";
import { bearerToken, isAllowedAdmin } from "@/lib/admin-access";

const auth = vi.hoisted(() => ({ header: null as string | null, getUser: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: new Headers(auth.header ? { authorization: auth.header } : {}) }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { getUser: auth.getUser } } }));

import { verifyAdminRequest } from "@/lib/admin-auth.server";

const confirmed = "2026-11-01T00:00:00Z";

describe("dashboard access", () => {
  it("allows a backend user with a confirmed email", () => {
    expect(isAllowedAdmin({ email: "ummasbun27@gmail.com", email_confirmed_at: confirmed })).toBe(true);
  });

  it("denies a user whose email is not confirmed", () => {
    expect(isAllowedAdmin({ email: "ummasbun27@gmail.com", email_confirmed_at: null })).toBe(false);
  });

  it("denies when there is no user", () => {
    expect(isAllowedAdmin(null)).toBe(false);
  });

  it("reads only a Bearer token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("server check for management requests", () => {
  beforeEach(() => { auth.getUser.mockReset(); auth.header = null; });

  it("rejects a request without a token and never asks the auth server", async () => {
    expect(await verifyAdminRequest()).toEqual({ signedIn: false, allowed: false });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("rejects a token the auth server does not accept", async () => {
    auth.header = "Bearer forged";
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad jwt") });
    expect((await verifyAdminRequest()).allowed).toBe(false);
  });

  it("allows a confirmed backend user the auth server recognises", async () => {
    auth.header = "Bearer good";
    auth.getUser.mockResolvedValue({ data: { user: { email: "ummasbun27@gmail.com", email_confirmed_at: confirmed } }, error: null });
    expect(await verifyAdminRequest()).toEqual({ signedIn: true, allowed: true });
    expect(auth.getUser).toHaveBeenCalledWith("good");
  });
});
