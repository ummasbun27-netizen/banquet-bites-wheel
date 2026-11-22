/**
 * Dashboard access rule: any account the owner added in the backend user list, with a confirmed
 * email, may manage the menu. Public sign-up is switched off, so nobody else can create an account.
 */
export type AdminCandidate = { email?: string | null | undefined; email_confirmed_at?: string | null | undefined };

export function isAllowedAdmin(user: AdminCandidate | null | undefined): boolean {
  return !!user?.email?.trim() && !!user.email_confirmed_at;
}

export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match?.[1] ?? null;
}
