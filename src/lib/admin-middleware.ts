import { createMiddleware } from "@tanstack/react-start";

/** Sends the signed-in owner's access token with each management request. */
export const attachAdminToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

/**
 * Every management server function goes through here: the caller must be signed in as a
 * confirmed user from the backend user list before the service-role client is handed out.
 */
export const managementDb = createMiddleware({ type: "function" })
  .middleware([attachAdminToken])
  .server(async ({ next }) => {
    const { verifyAdminRequest } = await import("./admin-auth.server");
    const { allowed } = await verifyAdminRequest();
    if (!allowed) throw new Error("Not allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { db: supabaseAdmin } });
  });
