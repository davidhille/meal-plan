// Pause, bevor ein Gericht wieder in den Plan darf – je besser bewertet, desto kürzer, aber nie „fast wöchentlich“.
// Entscheidung von David 1.11.2026: gestaffelt nach Sternen; schlecht Bewertetes (1–2 ★) praktisch nie wieder.
import { RECENT_DAYS } from "./meals";

/** Länger zurück als dieses Jahr schaut die Planung nicht (Obergrenze der Pause und der Verlauf-Abfrage) */
export const MAX_PAUSE_DAYS = 365;

/** Pause in Tagen nach Sternen; unbewertet = `RECENT_DAYS` (5 Wochen) */
export function repeatPauseDays(rating: number | undefined): number {
  if (!rating) return RECENT_DAYS;
  if (rating >= 5) return 56; // 8 Wochen
  if (rating >= 4) return 63; // 9 Wochen
  if (rating >= 3) return 70; // 10 Wochen
  return MAX_PAUSE_DAYS; // 1–2 ★: praktisch nie wieder (nur wenn sonst gar nichts übrig ist)
}

/** Tage von `from` bis `to` (JJJJ-MM-TT) */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Gerichte, die ab `today` noch Pause haben: zuletzt geplant (`history`, jeweils das späteste Datum) vor weniger
 * Tagen, als die Pause nach ihrer Bewertung dauert.
 */
export function pausedNames(
  history: { date: string; name: string }[],
  ratings: Record<string, number>,
  today: string
): string[] {
  const last = new Map<string, string>();
  for (const h of history) {
    const seen = last.get(h.name);
    if (!seen || h.date > seen) last.set(h.name, h.date);
  }
  const out: string[] = [];
  for (const [name, date] of last) {
    if (daysBetween(date, today) < repeatPauseDays(ratings[name])) out.push(name);
  }
  return out;
}
