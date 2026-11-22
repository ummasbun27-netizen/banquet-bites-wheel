import { beforeEach, describe, expect, it, vi } from "vitest";
import { bearerToken, isAllowedAdmin } from "@/lib/admin-access";

const auth = vi.hoisted(() => ({ header: null as string | null, getUser: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: new Headers(auth.header ? { authorization: auth.header } : {}) }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { auth: { getUser: auth.getUser } } }));

import { verifyAdminRequest } from "@/lib/admin-auth.server";

const confirmed = "2026-11-01T00:00:00Z";

describe("dashboard allow-list", () => {
  it("allows a confirmed email on the list, ignoring case and spaces", () => {
    expect(isAllowedAdmin({ email: "Owner@Gmail.com", email_confirmed_at: confirmed }, " other@gmail.com , owner@gmail.com ")).toBe(true);
  });

  it("denies an email that is not on the list", () => {
    expect(isAllowedAdmin({ email: "guest@gmail.com", email_confirmed_at: confirmed }, "owner@gmail.com")).toBe(false);
  });

  it("denies an unconfirmed email even when it is on the list", () => {
    expect(isAllowedAdmin({ email: "owner@gmail.com", email_confirmed_at: null }, "owner@gmail.com")).toBe(false);
  });

  it("denies everyone when the list is empty or missing", () => {
    const user = { email: "owner@gmail.com", email_confirmed_at: confirmed };
    expect(isAllowedAdmin(user, "")).toBe(false);
    expect(isAllowedAdmin(user, undefined)).toBe(false);
    expect(isAllowedAdmin(user, " , ")).toBe(false);
  });

  it("reads only a Bearer token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe("server check for management requests", () => {
  beforeEach(() => { auth.getUser.mockReset(); auth.header = null; vi.stubEnv("ADMIN_EMAILS", "owner@gmail.com"); });

  it("rejects a request without a token and never asks the auth server", async () => {
    expect(await verifyAdminRequest()).toEqual({ signedIn: false, allowed: false });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("rejects a token the auth server does not accept", async () => {
    auth.header = "Bearer forged";
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("bad jwt") });
    expect((await verifyAdminRequest()).allowed).toBe(false);
  });

  it("allows the approved owner and rejects another signed-in account", async () => {
    auth.header = "Bearer good";
    auth.getUser.mockResolvedValue({ data: { user: { email: "owner@gmail.com", email_confirmed_at: confirmed } }, error: null });
    expect(await verifyAdminRequest()).toEqual({ signedIn: true, allowed: true });
    expect(auth.getUser).toHaveBeenCalledWith("good");
    auth.getUser.mockResolvedValue({ data: { user: { email: "someone@gmail.com", email_confirmed_at: confirmed } }, error: null });
    expect(await verifyAdminRequest()).toEqual({ signedIn: true, allowed: false });
  });
});
