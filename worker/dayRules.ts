// Regeln pro Wochentag: „frei“ (wird nicht geplant) oder „höchstens X Minuten“ Kochzeit.
import type { Recipe } from "./meals";

export interface DayRule {
  off?: boolean;
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
    const v = value as { off?: unknown; maxMinutes?: unknown };
    if (v.off === true) out[key] = { off: true };
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
