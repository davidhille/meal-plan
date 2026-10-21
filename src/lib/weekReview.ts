// Wochen-Rückblick: was wurde gekocht, was kam am besten an, was ist noch nicht bewertet
import { PlanMeal } from '../types';
import { toIso } from './dateUtils';

export interface WeekReview {
  /** Montag der Woche (YYYY-MM-DD), dient auch als Schlüssel zum Ausblenden */
  weekStart: string;
  weekEnd: string;
  cooked: PlanMeal[];
  brotzeit: number;
  /** Bestbewertete Gerichte der Woche (höchste Sterne, mind. 4) */
  best: { pm: PlanMeal; rating: number }[];
  unrated: PlanMeal[];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

/**
 * Welche Woche zurückblicken? Sonntag: die laufende Woche, Montag und Dienstag: die vergangene. Sonst keine.
 * Nur wenn mindestens zwei Gerichte schon gekocht sind (Tag ≤ heute).
 */
export function weekReview(meals: PlanMeal[], ratings: Record<string, number>, now = new Date()): WeekReview | null {
  const today = toIso(now);
  const dow = now.getDay(); // 0 = Sonntag
  if (![0, 1, 2].includes(dow)) return null;
  // Sonntag: Montag dieser Woche; Mo/Di: Montag der Vorwoche
  const weekStart = addDays(today, dow === 0 ? -6 : -(dow - 1) - 7);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = meals.filter((m) => !m.rejected && m.meal_date >= weekStart && m.meal_date <= weekEnd && m.meal_date <= today);
  const cooked = inWeek.filter((m) => !m.brotzeit);
  if (cooked.length < 2) return null;
  const rated = cooked.filter((m) => ratings[m.meal_name]).map((pm) => ({ pm, rating: ratings[pm.meal_name] }));
  const top = Math.max(0, ...rated.map((r) => r.rating));
  return {
    weekStart,
    weekEnd,
    cooked,
    brotzeit: inWeek.length - cooked.length,
    best: top >= 4 ? rated.filter((r) => r.rating === top) : [],
    unrated: cooked.filter((m) => !ratings[m.meal_name]),
  };
}
