// Muster-Vorschlag: blendet die Familie immer wieder Gerichte mit derselben Hauptzutat aus (Lamm, Fisch …), bietet die App an,
// die Hauptzutat ganz wegzulassen („Familien-Nein“, siehe dislikes.ts) – statt das Nein jedes Mal einzeln zu geben.
import type { Sql } from "./db";
import { FAMILY_DISLIKE_GROUPS, matchesDislikeGroup } from "./dislikes";
import { loadContext, loadPool } from "./repo";

interface Dish {
  name: string;
  ingredients: string[];
}

export interface DislikeHint {
  /** Kennung der Hauptzutat (wie `profiles.family_dislikes`) */
  id: string;
  label: string;
  /** Wie viele Gerichte dieser Hauptzutat schon ausgeblendet sind */
  count: number;
}

/** Beim wievielten ausgeblendeten Gericht der Hinweis kommt: beim 3., und wer ihn ignoriert, bekommt ihn beim 6. noch einmal */
export const HINT_AT_COUNTS = [3, 6];

/**
 * Reine Rechnung: Gehört das gerade ausgeblendete Gericht zu einer Hauptzutat, die noch nicht „nie“ ist und bei der die
 * Zahl der ausgeblendeten Gerichte jetzt 3 (oder 6) erreicht? `rejected` enthält das gerade ausgeblendete Gericht mit.
 */
export function dislikeHint(rejected: Dish[], justHidden: Dish, familyDislikes: string[]): DislikeHint | null {
  for (const [id, group] of Object.entries(FAMILY_DISLIKE_GROUPS)) {
    if (familyDislikes.includes(id) || !matchesDislikeGroup(justHidden, id)) continue;
    const names = new Set(rejected.filter((d) => matchesDislikeGroup(d, id)).map((d) => d.name));
    if (HINT_AT_COUNTS.includes(names.size)) return { id, label: group.label, count: names.size };
  }
  return null;
}

/**
 * Hinweis nach dem Ausblenden eines Gerichts; Fehler hier dürfen das Ausblenden nie stören.
 * Zutaten kommen aus der Sammlung (`loadPool`), `ingredients` ist der Ersatz, falls das Gericht dort nicht steht.
 */
export async function loadDislikeHintFor(sql: Sql, profileId: string, name: string, ingredients: string[] = []): Promise<DislikeHint | null> {
  try {
    const [rejected, ctx, { pool }] = await Promise.all([
      // Endgültig gelöschte Gerichte zählen nicht (gleiche Regel wie in den Kennzahlen)
      sql`SELECT DISTINCT meal_name FROM rejected_meals WHERE profile_id = ${profileId} AND reason IS DISTINCT FROM 'geloescht'`,
      loadContext(sql, profileId),
      loadPool(sql, profileId),
    ]);
    const byName = new Map(pool.map((m) => [m.name, m.ingredients]));
    const dishes: Dish[] = rejected.map((r) => ({ name: r.meal_name as string, ingredients: byName.get(r.meal_name as string) ?? [] }));
    return dislikeHint(dishes, { name, ingredients: byName.get(name) ?? ingredients }, ctx.familyDislikes ?? []);
  } catch {
    return null;
  }
}

/** Hinweis nach dem Ausblenden eines Plan-Gerichts */
export async function loadDislikeHint(sql: Sql, profileId: string, planMealId: string): Promise<DislikeHint | null> {
  try {
    const hidden = await sql`SELECT pm.meal_name, pm.ingredients FROM plan_meals pm
      JOIN meal_plans mp ON mp.id = pm.plan_id WHERE pm.id = ${planMealId} AND mp.profile_id = ${profileId}`;
    if (!hidden[0]) return null;
    return await loadDislikeHintFor(sql, profileId, hidden[0].meal_name as string, (hidden[0].ingredients as string[]) ?? []);
  } catch {
    return null;
  }
}
