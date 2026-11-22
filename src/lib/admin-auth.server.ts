import { getRequest } from "@tanstack/react-start/server";
import { bearerToken, isAllowedAdmin } from "./admin-access";

/** Checks the caller's bearer token with the auth server: only existing, confirmed backend users pass. */
export async function verifyAdminRequest(): Promise<{ signedIn: boolean; allowed: boolean }> {
  const token = bearerToken(getRequest()?.headers.get("authorization"));
  if (!token) return { signedIn: false, allowed: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { signedIn: false, allowed: false };
  return { signedIn: true, allowed: isAllowedAdmin(data.user) };
}
