// Café social accounts shown in the guest menu's comment sheet. Links are typed by
// the owner in the dashboard; follower counts are not shown anywhere.
export type SocialId = "tiktok" | "instagram" | "facebook";
export type SocialAccount = { id: SocialId; url: string; position: number };
export const socialLabels: Record<SocialId, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" };
