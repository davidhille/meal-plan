// Gemeinsame Datenbank-Zugriffe: Profil, Bewertungs-Kontext, Rezept-Pool, Favoriten, Pläne.
import type { Row, Sql } from "./db";
import { MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";

// Spaltenlisten mit Datum als Text (YYYY-MM-DD), damit das Frontend Strings bekommt
export const PLAN_COLS = `id, profile_id, start_date::text AS start_date, end_date::text AS end_date, status, created_at`;
export const PLAN_MEAL_COLS = `id, plan_id, meal_date::text AS meal_date, meal_name, meal_type, ingredients, instructions, rejected, image_url, duration_min, dessert, created_at`;
export const ROUTINE_COLS = `id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days, active, last_run_at, created_at`;

export const FAVORITE_COLS = `id, meal_name, meal_type, ingredients, instructions, duration_min, turnus_weeks,
  last_planned::text AS last_planned, created_at`;

export async function loadFavorites(sql: Sql, profileId: string) {
  return sql.query(`SELECT ${FAVORITE_COLS} FROM favorites WHERE profile_id = $1 ORDER BY created_at`, [profileId]);
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
    sql`SELECT name, type, ingredients, instructions, duration_min FROM recipes`,
  ]);
  const pool: Recipe[] = [...MEAL_DATABASE];
  const names = new Set(pool.map((m) => m.name));
  for (const r of dbRecipes) {
    if (names.has(r.name)) continue;
    pool.push({ name: r.name, type: r.type, ingredients: r.ingredients, instructions: r.instructions, durationMin: r.duration_min });
    names.add(r.name);
  }
  for (const f of favorites) if (!names.has(f.meal_name)) pool.push(favoriteToRecipe(f));
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
export async function getProfile(sql: Sql) {
  const rows = await sql`SELECT * FROM profiles ORDER BY created_at LIMIT 1`;
  if (rows[0]) return rows[0];
  const created = await sql`INSERT INTO profiles DEFAULT VALUES RETURNING *`;
  return created[0];
}

export async function loadContext(sql: Sql, profileId: string): Promise<ScoringContext> {
  const [profiles, members, ratings, rejected] = await Promise.all([
    sql`SELECT health_goal, health_conditions FROM profiles WHERE id = ${profileId}`,
    sql`SELECT type, age, favorite_foods, disliked_foods FROM family_members WHERE profile_id = ${profileId}`,
    sql`SELECT meal_name, rating FROM meal_ratings WHERE profile_id = ${profileId}`,
    sql`SELECT meal_name FROM rejected_meals WHERE profile_id = ${profileId}`,
  ]);
  const p = profiles[0] ?? {};
  return {
    healthGoal: p.health_goal || "balanced",
    healthConditions: p.health_conditions || [],
    familyMembers: members as ScoringContext["familyMembers"],
    mealRatings: Object.fromEntries(ratings.map((r) => [r.meal_name, r.rating])),
    rejectedMeals: rejected.map((r) => r.meal_name),
  };
}
