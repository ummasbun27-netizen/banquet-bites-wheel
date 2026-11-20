/** Prize codes kept on the guest's phone so closing the wheel never loses them. */
export type SavedPrize = { code: string; prize: string; emoji: string; day: string };

const KEY = "carkprizes";
const MAX_SAVED = 10;

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Codes are valid only on the day they were won, so older ones are dropped. */
export function todaysPrizes(raw: string | null, day = localDay()): SavedPrize[] {
  try {
    const list: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(list)) return [];
    return list.filter((p): p is SavedPrize =>
      !!p && typeof p === "object"
      && typeof p.code === "string" && typeof p.prize === "string"
      && typeof p.emoji === "string" && p.day === day);
  } catch { return []; }
}

export function addPrize(list: SavedPrize[], prize: SavedPrize): SavedPrize[] {
  return [prize, ...list.filter((p) => p.code !== prize.code)].slice(0, MAX_SAVED);
}

export function loadPrizes(): SavedPrize[] {
  try { return todaysPrizes(localStorage.getItem(KEY)); } catch { return []; }
}

export function savePrize(prize: Omit<SavedPrize, "day">): SavedPrize[] {
  const next = addPrize(loadPrizes(), { ...prize, day: localDay() });
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ }
  return next;
}
