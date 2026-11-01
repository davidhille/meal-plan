// Mengen-Regeln für den Plan: dieselbe Hauptkomponente (Garnelen, Nudeln …) pro Kalenderwoche oder Kalendermonat
// höchstens (max) bzw. mindestens (min) so oft. Ergänzt die Ähnlichkeit über Namen (`isSimilarDish`,
// `overlapWithRecent`), die nur ähnliche Namen erkennt – „Gambas“, „Shrimps“ und „Garnelen“ oder „Penne“,
// „Tortelloni“ und „Lasagne“ haben keine gemeinsamen Wörter.
// Die Kategorien stehen in src/lib/varietyCategories.ts (gemeinsam mit den Einstellungen).
import { isoWeekKey } from "./nutrition";
import {
  DEFAULT_VARIETY_RULES,
  VARIETY_CATEGORIES,
  VARIETY_LIMIT,
  type VarietyCategory,
  type VarietyPeriod,
  type VarietyRule,
} from "../src/lib/varietyCategories";

export { DEFAULT_VARIETY_RULES, VARIETY_CATEGORIES };
export type { VarietyCategory, VarietyPeriod, VarietyRule };

const MAX_RULES = 20;

/**
 * Eingabe prüfen (jsonb kommt je nach Treiber als Liste oder Text). `null` = nichts eingestellt (Standard),
 * `[]` = bewusst keine Regeln. Unbekannte Kategorien, doppelte Regeln und Regeln ohne min/max fallen weg.
 */
export function parseVarietyRules(raw: unknown): VarietyRule[] | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const out: VarietyRule[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const { id, period, min, max } = v as Record<string, unknown>;
    if (typeof id !== "string" || !VARIETY_CATEGORIES.some((c) => c.id === id)) continue;
    if (period !== "week" && period !== "month") continue;
    const limit = VARIETY_LIMIT[period];
    const num = (x: unknown): number | undefined => {
      if (x === null || x === undefined || x === "") return undefined;
      const n = Math.round(Number(x));
      return Number.isFinite(n) ? Math.max(0, Math.min(limit, n)) : undefined;
    };
    const lo = num(min) || undefined; // 0 als Minimum = kein Minimum
    const hi = num(max);
    if (lo === undefined && hi === undefined) continue;
    if (lo !== undefined && hi !== undefined && lo > hi) continue;
    const key = `${id}|${period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rule: VarietyRule = { id, period };
    if (lo !== undefined) rule.min = lo;
    if (hi !== undefined) rule.max = hi;
    out.push(rule);
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

/** Zu welchen Kategorien gehört das Gericht? */
export function categoriesOf(name: string): VarietyCategory[] {
  const n = name.toLowerCase();
  return VARIETY_CATEGORIES.filter((c) => c.re.test(n));
}

/** Gehört das Gericht zur Kategorie? (für „an diesem Tag soll Fisch auf den Teller“) */
export const matchesCategory = (id: string, name: string) =>
  !!VARIETY_CATEGORIES.find((c) => c.id === id)?.re.test(name.toLowerCase());

/** Zähler je Zeitraum (Woche/Monat) und Kategorie */
export type VarietyCounts = Map<string, Map<string, number>>;

const periodKey = (date: string, period: VarietyPeriod) => (period === "week" ? `w${isoWeekKey(date)}` : `m${date.slice(0, 7)}`);

export function addToCounts(counts: VarietyCounts, date: string, name: string): void {
  for (const c of categoriesOf(name)) {
    for (const period of ["week", "month"] as const) {
      const key = periodKey(date, period);
      const byCategory = counts.get(key) ?? new Map<string, number>();
      byCategory.set(c.id, (byCategory.get(c.id) ?? 0) + 1);
      counts.set(key, byCategory);
    }
  }
}

export function countsOf(meals: { date: string; name: string }[]): VarietyCounts {
  const counts: VarietyCounts = new Map();
  for (const m of meals) addToCounts(counts, m.date, m.name);
  return counts;
}

const countFor = (counts: VarietyCounts, rule: VarietyRule, date: string) =>
  counts.get(periodKey(date, rule.period))?.get(rule.id) ?? 0;

/** Würde das Gericht an diesem Tag eine Höchstgrenze (max) überschreiten? */
export function exceedsCap(name: string, date: string, counts: VarietyCounts, rules: VarietyRule[]): boolean {
  const ids = new Set(categoriesOf(name).map((c) => c.id));
  return rules.some((r) => r.max !== undefined && ids.has(r.id) && countFor(counts, r, date) >= r.max);
}

/** Letzter Tag der Kalenderwoche (Sonntag) bzw. des Kalendermonats */
function periodEnd(date: string, period: VarietyPeriod): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (period === "week") d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  else d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** Tage von `from` bis `to` einschließlich */
const daysInclusive = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/**
 * Mindest-Regeln (min): an welchen Tagen soll welche Kategorie auf den Teller? `openDates` sind die Tage, die noch ein
 * Gericht bekommen; `planEnd` ist der letzte Tag des Plans. Fehlende Gerichte je Woche/Monat (min minus schon
 * Geplantes) werden gleichmäßig auf die offenen Tage verteilt. Deckt der Plan nur einen Teil des Zeitraums ab (z. B.
 * eine Woche eines Monats), übernimmt er nur seinen Anteil – die Planung der nächsten Wochen holt den Rest.
 */
export function minimumSlots(
  openDates: string[],
  counts: VarietyCounts,
  rules: VarietyRule[],
  planEnd: string
): Map<string, string> {
  const slots = new Map<string, string>();
  const dates = [...openDates].sort();
  for (const rule of rules) {
    if (!rule.min) continue;
    const byPeriod = new Map<string, string[]>();
    for (const d of dates) {
      const key = periodKey(d, rule.period);
      byPeriod.set(key, [...(byPeriod.get(key) ?? []), d]);
    }
    for (const days of byPeriod.values()) {
      const deficit = rule.min - countFor(counts, rule, days[0]);
      if (deficit <= 0) continue;
      const end = periodEnd(days[0], rule.period);
      const left = daysInclusive(days[0], end);
      const need =
        planEnd >= end ? Math.min(deficit, days.length) : Math.min(days.length, Math.ceil((deficit * days.length) / left));
      for (let i = 0; i < need; i++) {
        const target = Math.floor(((i + 0.5) * days.length) / need);
        // nächster noch freier Tag um den Zielpunkt
        for (let off = 0; off < days.length; off++) {
          const day = [days[target + off], days[target - off]].find((d) => d !== undefined && !slots.has(d));
          if (day) {
            slots.set(day, rule.id);
            break;
          }
        }
      }
    }
  }
  return slots;
}
