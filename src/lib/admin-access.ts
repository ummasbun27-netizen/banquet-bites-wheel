/** Pure allow-list rules for the management panel; the list itself lives in the ADMIN_EMAILS env var. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export type AdminCandidate = { email?: string | null | undefined; email_confirmed_at?: string | null | undefined };

/** Only a confirmed email that is on the list may manage the menu. An empty list denies everyone. */
export function isAllowedAdmin(user: AdminCandidate | null | undefined, rawList: string | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email || !user?.email_confirmed_at) return false;
  return parseAdminEmails(rawList).has(email);
}

export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match?.[1] ?? null;
}
