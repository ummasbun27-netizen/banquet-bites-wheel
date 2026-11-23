import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createMenuClient } from "./menu.functions";
import { managementDb } from "./admin-middleware";
import type { SocialAccount } from "./social";

export const getSocial = createServerFn({ method: "GET" }).handler(async (): Promise<SocialAccount[]> => {
  const client = createMenuClient(process.env['SUPABASE_URL'], process.env['SUPABASE_PUBLISHABLE_KEY']);
  const { data, error } = await client.from("social_accounts").select("id, url, position").order("position");
  if (error) throw new Error("Social accounts could not be loaded.");
  return (data ?? []) as SocialAccount[];
});

// Dashboard view: includes accounts without a link, which guests cannot read.
export const getSocialAdmin = createServerFn({ method: "GET" }).middleware([managementDb]).handler(async ({ context }): Promise<SocialAccount[]> => {
  const { data, error } = await context.db.from("social_accounts").select("id, url, position").order("position");
  if (error) throw new Error("Social accounts could not be loaded.");
  return (data ?? []) as SocialAccount[];
});

export const socialInput = z.object({ accounts: z.array(z.object({
  id: z.enum(["tiktok", "instagram"]),
  url: z.string().trim().max(300).refine((u) => u === "" || /^https:\/\//.test(u), "Links must start with https://"),
})).max(2) });

export const saveSocial = createServerFn({ method: "POST" }).middleware([managementDb]).inputValidator((i) => socialInput.parse(i)).handler(async ({ data, context }) => {
  for (const a of data.accounts) {
    const r = await context.db.from("social_accounts").update({ url: a.url }).eq("id", a.id);
    if (r.error) throw new Error("Social accounts could not be saved.");
  }
  return { ok: true };
});
