import { createServerFn } from "@tanstack/react-start";
import { attachAdminToken } from "./admin-middleware";

/** Lets the panel show a friendly screen instead of failing every request for a rejected account. */
export const getAdminAccess = createServerFn({ method: "GET" }).middleware([attachAdminToken]).handler(async () => {
  const { verifyAdminRequest } = await import("./admin-auth.server");
  const { allowed } = await verifyAdminRequest();
  return { allowed };
});
