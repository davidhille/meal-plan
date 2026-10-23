// Gemeinsame Datenbank-Zugriffe: Profil, Bewertungs-Kontext, Rezept-Pool, Favoriten, Pläne.
import type { Row, Sql } from "./db";
import { parseDayRules } from "./dayRules";
import { MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";

// Spaltenlisten mit Datum als Text (YYYY-MM-DD), damit das Frontend Strings bekommt
export const PLAN_COLS = `id, profile_id, start_date::text AS start_date, end_date::text AS end_date, status, created_at, share_hash IS NOT NULL AS shared`;
export const PLAN_MEAL_COLS = `id, plan_id, meal_date::text AS meal_date, meal_name, meal_type, ingredients, instructions, rejected, image_url, duration_min, dessert, brotzeit, guests, created_at`;
export const ROUTINE_COLS = `id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days, active, last_run_at, created_at`;

export const FAVORITE_COLS = `id, meal_name, meal_type, ingredients, instructions, duration_min, turnus_weeks,
  last_planned::text AS last_planned, created_at`;

/** Favoriten der Familie, mit Bild (eigene Fassung der Familie vor dem gemeinsamen Bild) */
export async function loadFavorites(sql: Sql, profileId: string) {
  const cols = FAVORITE_COLS.split(",").map((c) => `f.${c.trim()}`).join(", ");
  return sql.query(
    `SELECT ${cols}, CASE WHEN mi.image_data IS NOT NULL THEN mi.image_url END AS image_url
     FROM favorites f
     LEFT JOIN LATERAL (SELECT image_url, image_data FROM meal_images x WHERE x.meal_name = f.meal_name
       AND (x.profile_id IS NULL OR x.profile_id = $1) ORDER BY x.profile_id IS NULL LIMIT 1) mi ON true
     WHERE f.profile_id = $1 ORDER BY f.created_at`,
    [profileId]
  );
}

export function favoriteToRecipe(f: Row): Recipe {
  return {
    name: f.meal_name,
    type: f.meal_type,
    ingredients: f.ingredients ?? [],
    instructions: f.instructions ?? "",
    durationMin: f.duration_min ?? null,
  };
}

/** Alle Rezepte, aus denen geplant wird: feste Liste + KI-Rezepte + Favoriten */
export async function loadPool(sql: Sql, profileId: string): Promise<{ pool: Recipe[]; favorites: Row[] }> {
  const [favorites, dbRecipes] = await Promise.all([
    loadFavorites(sql, profileId),
    // Eigene Rezepte plus KI-Rezepte aller Familien (unbearbeitet); eigene zuletzt, damit sie gleichnamige ersetzen
    sql`SELECT name, type, ingredients, instructions, duration_min, replaces FROM recipes
      WHERE profile_id = ${profileId} OR (source = 'ai' AND replaces IS NULL)
      ORDER BY profile_id = ${profileId}, created_at`,
  ]);
  const pool: Recipe[] = [...MEAL_DATABASE];
  const index = new Map(pool.map((m, i) => [m.name, i]));
  for (const r of dbRecipes) {
    const recipe: Recipe = { name: r.name, type: r.type, ingredients: r.ingredients, instructions: r.instructions, durationMin: r.duration_min };
    // Bearbeitete Gerichte ersetzen das Original (Foto aus der Sammlung bleibt)
    const target = (r.replaces as string | null) ?? r.name;
    const i = index.get(target) ?? index.get(r.name);
    if (i === undefined) {
      index.set(r.name, pool.length);
      pool.push(recipe);
    } else {
      pool[i] = { ...recipe, imageUrl: pool[i].imageUrl };
      index.delete(target);
      index.set(r.name, i);
    }
  }
  for (const f of favorites) if (!index.has(f.meal_name)) pool.push(favoriteToRecipe(f));
  return { pool, favorites };
}

export async function planOwned(sql: Sql, profileId: string, planId: string) {
  const rows = await sql`SELECT 1 FROM meal_plans WHERE id = ${planId} AND profile_id = ${profileId}`;
  return rows.length > 0;
}

export async function latestPlan(sql: Sql, profileId: string) {
  const rows = await sql.query(
    `SELECT ${PLAN_COLS} FROM meal_plans WHERE profile_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [profileId]
  );
  return rows[0] ?? null;
}

/** Das eine Familienprofil (wird beim ersten Aufruf angelegt) */
/**
 * Familie der angemeldeten Person. Ohne Anmeldung (nur im Übergang, solange es keine Zugänge gibt, und für den
 * ersten Zugang) die erste Familie – sie wird beim allerersten Aufruf angelegt.
 */
export async function getProfile(sql: Sql, user?: { profileId: string } | null) {
  if (user) {
    const own = await sql`SELECT * FROM profiles WHERE id = ${user.profileId}`;
    if (!own[0]) throw new Error("Familie nicht gefunden");
    return own[0];
  }
  const rows = await sql`SELECT * FROM profiles ORDER BY created_at LIMIT 1`;
  if (rows[0]) return rows[0];
  const created = await sql`INSERT INTO profiles DEFAULT VALUES RETURNING *`;
  return created[0];
}

export async function loadContext(sql: Sql, profileId: string): Promise<ScoringContext> {
  const [profiles, members, ratings, rejected] = await Promise.all([
    sql`SELECT health_focus, health_conditions, meat_max_per_week, day_rules, brotzeit_per_week, family_dislikes FROM profiles WHERE id = ${profileId}`,
    sql`SELECT type, age, favorite_foods, disliked_foods FROM family_members WHERE profile_id = ${profileId}`,
    sql`SELECT meal_name, rating, notes FROM meal_ratings WHERE profile_id = ${profileId}
      ORDER BY COALESCE(updated_at, created_at) DESC`,
    sql`SELECT meal_name FROM rejected_meals WHERE profile_id = ${profileId}`,
  ]);
  const p = profiles[0] ?? {};
  return {
    profileId,
    healthFocus: p.health_focus || [],
    healthConditions: p.health_conditions || [],
    meatMaxPerWeek: p.meat_max_per_week ?? null,
    dayRules: parseDayRules(p.day_rules),
    brotzeitPerWeek: Number(p.brotzeit_per_week) || 0,
    month: new Date().getMonth() + 1,
    familyMembers: members as ScoringContext["familyMembers"],
    familyDislikes: p.family_dislikes || [],
    mealRatings: Object.fromEntries(ratings.map((r) => [r.meal_name, r.rating])),
    // Neueste Kommentare zu Bewertungen – gehen als Rückmeldung in die KI-Rezepte
    feedback: ratings
      .filter((r) => r.notes && String(r.notes).trim())
      .slice(0, 12)
      .map((r) => `„${r.meal_name}“ (${r.rating} von 5 Sternen): ${String(r.notes).trim().slice(0, 200)}`),
    rejectedMeals: rejected.map((r) => r.meal_name),
  };
}
