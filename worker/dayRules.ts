// Regeln pro Wochentag: „frei“ (wird nicht geplant), „Brotzeit“ (nicht kochen, nur Platzhalter) oder „höchstens X Minuten“ Kochzeit.
import type { Recipe } from "./meals";
import { isoWeekKey } from "./nutrition";

export interface DayRule {
  off?: boolean;
  /** An diesem Wochentag immer Brotzeit statt Kochen */
  brotzeit?: boolean;
  maxMinutes?: number;
}
/** Schlüssel 0–6 wie getUTCDay (0 = Sonntag) */
export type DayRules = Partial<Record<string, DayRule>>;

export const MINUTE_CHOICES = [15, 20, 30, 45, 60];

/** Eingaben prüfen: nur 0–6, nur „frei“ oder eine der erlaubten Minuten */
export function parseDayRules(raw: unknown): DayRules {
  const out: DayRules = {};
  // Je nach Treiber kommt jsonb als Objekt oder als Text
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(key) || !value || typeof value !== "object") continue;
    const v = value as { off?: unknown; brotzeit?: unknown; maxMinutes?: unknown };
    if (v.off === true) out[key] = { off: true };
    else if (v.brotzeit === true) out[key] = { brotzeit: true };
    else if (MINUTE_CHOICES.includes(Number(v.maxMinutes))) out[key] = { maxMinutes: Number(v.maxMinutes) };
  }
  return out;
}

export function ruleFor(date: string, rules: DayRules | undefined): DayRule {
  if (!rules) return {};
  return rules[String(new Date(`${date}T00:00:00Z`).getUTCDay())] ?? {};
}

export const isOffDay = (date: string, rules: DayRules | undefined) => !!ruleFor(date, rules).off;

/** Passt ein Gericht in die Zeit? Ohne Zeitangabe: ja, außer es ist ein (meist aufwendiges) Wochenend-Gericht */
export function fitsTime(recipe: Recipe, maxMinutes: number | undefined): boolean {
  if (!maxMinutes) return true;
  return recipe.durationMin ? recipe.durationMin <= maxMinutes : recipe.type !== "wochenende";
}

/**
 * Gerichte, die an diesem Tag in die Zeit passen (leer, wenn keins passt). Gerichte mit bekannter, passender Zeit
 * gehen vor; solche ohne Zeitangabe nur, wenn es keine anderen gibt.
 */
export function withinTime(pool: Recipe[], date: string, rules: DayRules | undefined): Recipe[] {
  const max = ruleFor(date, rules).maxMinutes;
  if (!max) return pool;
  const known = pool.filter((r) => !!r.durationMin && r.durationMin <= max);
  return known.length ? known : pool.filter((r) => fitsTime(r, max));
}

export const isBrotzeitDay = (date: string, rules: DayRules | undefined) => !!ruleFor(date, rules).brotzeit;

/** Name des Eintrags im Plan */
export const BROTZEIT = "Brotzeit";

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

/**
 * Welche der zu planenden Tage Brotzeit werden: feste Brotzeit-Wochentage immer; dazu automatisch so viele, dass es
 * insgesamt `perWeek` pro Kalenderwoche sind (feste Tage und schon vorhandene Brotzeiten zählen mit). Deckt der Plan
 * nur einen Teil einer Woche ab, anteilig. Bevorzugt Tage mit wenig Zeit, dann Montag–Freitag, möglichst verteilt.
 */
export function pickBrotzeitDates(
  dates: string[],
  rules: DayRules | undefined,
  perWeek: number,
  /** Alle geplanten oder zu planenden Tage der betroffenen Wochen (ohne freie) – für den Anteil */
  covered: string[] = dates,
  /** Schon vorhandene Brotzeit-Tage (beim Verlängern) */
  existing: string[] = []
): Set<string> {
  const chosen = new Set(dates.filter((d) => isBrotzeitDay(d, rules)));
  const per = Math.max(0, Math.min(7, Math.round(perWeek) || 0));
  if (!per) return chosen;
  // Wochentage, die überhaupt geplant werden (ohne freie)
  const plannable = [0, 1, 2, 3, 4, 5, 6].filter((d) => !rules?.[String(d)]?.off).length || 7;
  const byWeek = new Map<string, string[]>();
  for (const d of dates) byWeek.set(isoWeekKey(d), [...(byWeek.get(isoWeekKey(d)) ?? []), d]);
  for (const [week, days] of byWeek) {
    const coveredDays = new Set([...covered, ...days].filter((d) => isoWeekKey(d) === week)).size;
    const target = Math.min(per, Math.round((per * coveredDays) / plannable));
    const inWeek = [...existing.filter((d) => isoWeekKey(d) === week), ...days.filter((d) => chosen.has(d))];
    let missing = target - inWeek.length;
    const pool = days.filter((d) => !chosen.has(d));
    while (missing > 0 && pool.length) {
      const score = (d: string) => {
        const r = ruleFor(d, rules);
        const time = r.maxMinutes ? 3 - Math.min(2, r.maxMinutes / 30) : 0;
        const workday = weekday(d) >= 1 && weekday(d) <= 5 ? 1 : 0;
        const gap = inWeek.length ? Math.min(...inWeek.map((x) => Math.abs(dayNumber(x) - dayNumber(d)))) : 7;
        return time * 10 + workday * 5 + Math.min(gap, 7);
      };
      pool.sort((a, b) => score(b) - score(a) || a.localeCompare(b));
      const best = pool.shift()!;
      chosen.add(best);
      inWeek.push(best);
      missing--;
    }
  }
  return chosen;
}
