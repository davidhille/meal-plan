// Tages-Logik der Planung: Aufwand (schnell/aufwendig) nach Zubereitungszeit statt „Art pro Wochentag“ (David 21.11.2026),
// und eine Mindestzahl vegetarischer Gerichte pro Woche. Rein (ohne Datenbank), damit testbar.
import type { Recipe } from "./meals";

/** Bis zu dieser Zubereitungszeit (Minuten) gilt ein Gericht als schnell, darüber als aufwendig */
export const QUICK_MAX_MIN = 45;
export type Effort = "schnell" | "aufwendig";

/** Aufwand eines Gerichts: aus der Zeit; ohne Zeitangabe zählt die Art „Wochenende“ als aufwendig */
export function effortOf(r: Pick<Recipe, "durationMin" | "type">): Effort {
  if (r.durationMin) return r.durationMin > QUICK_MAX_MIN ? "aufwendig" : "schnell";
  return r.type === "wochenende" ? "aufwendig" : "schnell";
}

/** Sa/So darf aufwendig sein (bevorzugt), Mo–Fr schnell */
export function preferredEffortFor(dateStr: string): Effort {
  const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6 ? "aufwendig" : "schnell";
}

/** Standard: so viele vegetarische Gerichte pro Woche mindestens (früher Mo/Mi/Fr) */
export const DEFAULT_VEG_MIN = 3;

/**
 * Wie viele vegetarische Gerichte diese Woche noch fehlen. `slots` = Gerichte der Woche im Plan (feste und freie),
 * `vegCount` = davon schon vegetarisch. Bei Teilwochen anteilig (2 Tage → 1).
 */
export function vegMissing(vegMin: number, slots: number, vegCount: number): number {
  if (vegMin <= 0 || slots <= 0) return 0;
  const target = Math.min(slots, Math.ceil((vegMin * slots) / 7));
  return Math.max(0, target - vegCount);
}
