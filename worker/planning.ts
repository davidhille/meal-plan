// Planung: Plan erstellen, Gerichte austauschen, Rezept-Übersicht.
import type { Sql } from "./db";
import type { Env } from "./http";
import { pickMeal, pickReplacement, preferredTypeFor, scoreMeal, violatesHealthConditions, MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";
import { generateImage } from "./images";
import { generateRecipes } from "./aiRecipes";
import { PLAN_COLS, PLAN_MEAL_COLS, favoriteToRecipe, loadContext, loadPool } from "./repo";
import { isMeatDish, isoWeekKey } from "./nutrition";

/** Gerichte, die in den 3 Wochen vor `startDate` schon geplant waren */
async function recentMealNames(sql: Sql, profileId: string, startDate: string): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT pm.meal_name FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
    WHERE mp.profile_id = ${profileId} AND NOT pm.rejected
      AND pm.meal_date >= ${startDate}::date - 21 AND pm.meal_date < ${startDate}::date`;
  return rows.map((r) => r.meal_name as string);
}

/** Wie viele frische KI-Rezepte braucht dieser Plan, und welche Typen? */
function aiTypesNeeded(dates: string[], skip: Set<string>, pool: Recipe[], ctx: ScoringContext): Recipe["type"][] {
  const need: Record<Recipe["type"], number> = { vegetarisch: 0, fleisch: 0, wochenende: 0 };
  for (const d of dates) if (!skip.has(d)) need[preferredTypeFor(d)]++;
  const types: Recipe["type"][] = [];
  for (const t of Object.keys(need) as Recipe["type"][]) {
    if (!need[t]) continue;
    const fresh = pool.filter((m) => m.type === t && !ctx.recentNames?.includes(m.name) && scoreMeal(m, ctx) >= 0).length;
    const deficit = Math.max(0, need[t] - fresh);
    for (let i = 0; i < deficit; i++) types.push(t);
  }
  // Die Grundsammlung reicht meist: dann nur ein neues KI-Rezept als Überraschung
  // (spart das Tageskontingent von Workers AI für die Bilder)
  if (types.length === 0) {
    const present = (Object.keys(need) as Recipe["type"][]).filter((t) => need[t] > 0);
    if (present.length) types.push(present[Math.floor(Math.random() * present.length)]);
  }
  return types.slice(0, 6);
}

export function addDaysIso(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Gerichte für alle Tage auswählen. Feste Tage (Turnus-Favoriten) bleiben; mit Fleisch-Grenze
 * (ctx.meatMaxPerWeek) gibt es pro Kalenderwoche höchstens so viele Fleischgerichte – an „Fleisch-Tagen“
 * dann Fisch oder vegetarisch.
 */
export function pickDays(
  dates: string[],
  ctx: ScoringContext,
  used: Set<string>,
  pool: Recipe[],
  assigned: Map<string, Recipe> = new Map()
): { date: string; recipe: Recipe }[] {
  const max = ctx.meatMaxPerWeek;
  const meatPerWeek = new Map<string, number>();
  const addMeat = (date: string, r: Recipe) => {
    if (max == null || !isMeatDish(r)) return;
    const k = isoWeekKey(date);
    meatPerWeek.set(k, (meatPerWeek.get(k) ?? 0) + 1);
  };
  for (const [date, r] of assigned) addMeat(date, r);
  const meatFree = max == null ? pool : pool.filter((r) => !isMeatDish(r));

  const meals: { date: string; recipe: Recipe }[] = [];
  for (const date of dates) {
    const fixed = assigned.get(date);
    const limitReached = max != null && (meatPerWeek.get(isoWeekKey(date)) ?? 0) >= max;
    const recipe = fixed ?? pickMeal(date, ctx, used, limitReached ? meatFree : pool);
    if (!recipe) continue;
    if (!fixed) addMeat(date, recipe);
    meals.push({ date, recipe });
  }
  return meals;
}

/** Plan für [startDate, endDate] erzeugen und speichern */
export async function createPlan(env: Env, sql: Sql, profileId: string, startDate: string, endDate: string) {
  const ctx = await loadContext(sql, profileId);
  const { pool, favorites } = await loadPool(sql, profileId);
  ctx.favoriteNames = favorites.filter((f) => !f.turnus_weeks).map((f) => f.meal_name);
  ctx.recentNames = await recentMealNames(sql, profileId, startDate);
  ctx.month = Number(startDate.slice(5, 7));

  const dates: string[] = [];
  for (let d = startDate; d <= endDate; d = addDaysIso(d, 1)) dates.push(d);

  // 1) Fällige Turnus-Favoriten fest einplanen (am liebsten an einem passenden Tag)
  const assigned = new Map<string, Recipe>();
  const used = new Set<string>();
  const due = favorites
    .filter((f) => f.turnus_weeks > 0 && !ctx.rejectedMeals.includes(f.meal_name))
    .filter((f) => !f.last_planned || addDaysIso(f.last_planned, f.turnus_weeks * 7) <= endDate)
    .sort((a, b) => String(a.last_planned ?? "").localeCompare(String(b.last_planned ?? "")));
  for (const f of due) {
    const free = dates.filter((d) => !assigned.has(d));
    if (free.length === 0) break;
    const earliest = f.last_planned ? addDaysIso(f.last_planned, f.turnus_weeks * 7) : startDate;
    const candidates = free.filter((d) => d >= earliest);
    const day = candidates.find((d) => preferredTypeFor(d) === f.meal_type) ?? candidates[0];
    if (!day) continue;
    assigned.set(day, favoriteToRecipe(f));
    used.add(f.meal_name);
  }

  // 2) Frische KI-Rezepte für Abwechslung und fehlende Kandidaten (z. B. bei vegan/glutenfrei)
  const assignedDates = new Set(assigned.keys());
  const types = aiTypesNeeded(dates, assignedDates, pool, ctx);
  const fresh = await generateRecipes(env, sql, types, ctx, pool.map((m) => m.name));
  pool.push(...fresh);
  ctx.newNames = fresh.map((r) => r.name);

  // 3) Restliche Tage planen
  const meals = pickDays(dates, ctx, used, pool, assigned);

  const planRows = await sql.query(
    `INSERT INTO meal_plans (profile_id, start_date, end_date, status) VALUES ($1, $2, $3, 'active') RETURNING ${PLAN_COLS}`,
    [profileId, startDate, endDate]
  );
  const plan = planRows[0];
  if (meals.length) {
    await sql.query(
      `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions, duration_min)
       SELECT $1, d::date, n, t, string_to_array(i, E'\\x1f'), ins, NULLIF(dur, 0)
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[]) AS x(d, n, t, i, ins, dur)`,
      [
        plan.id,
        meals.map((m) => m.date),
        meals.map((m) => m.recipe.name),
        meals.map((m) => m.recipe.type),
        meals.map((m) => m.recipe.ingredients.join("\x1f")),
        meals.map((m) => m.recipe.instructions),
        meals.map((m) => m.recipe.durationMin ?? 0),
      ]
    );
    await markFavoritesPlanned(sql, profileId, plan.id);
  }
  return plan;
}

/** Turnus-Zähler: letztes geplantes Datum je Favorit aktualisieren */
async function markFavoritesPlanned(sql: Sql, profileId: string, planId: string) {
  await sql`UPDATE favorites f SET last_planned = x.d
    FROM (SELECT meal_name, max(meal_date) AS d FROM plan_meals WHERE plan_id = ${planId} AND NOT rejected GROUP BY meal_name) x
    WHERE f.profile_id = ${profileId} AND f.meal_name = x.meal_name
      AND (f.last_planned IS NULL OR f.last_planned < x.d)`;
}

/**
 * Gericht austauschen. reject=true: kommt auf die Ausschlussliste (Ablehnen),
 * reject=false: nur austauschen (Neu generieren).
 */
export async function replaceMeal(env: Env, sql: Sql, profileId: string, planMealId: string, reject: boolean,
  waitUntil: (p: Promise<unknown>) => void) {
  const rows = await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE id = $1`, [planMealId]);
  const old = rows[0];
  if (!old) return null;

  if (reject) {
    await sql`UPDATE plan_meals SET rejected = true WHERE id = ${planMealId}`;
    await sql`INSERT INTO rejected_meals (profile_id, meal_name) VALUES (${profileId}, ${old.meal_name})`;
  }

  const ctx = await loadContext(sql, profileId);
  const { pool, favorites } = await loadPool(sql, profileId);
  ctx.favoriteNames = favorites.filter((f) => !f.turnus_weeks).map((f) => f.meal_name);
  const existing = await sql`SELECT meal_name FROM plan_meals WHERE plan_id = ${old.plan_id}`;
  const exclude = new Set<string>([...existing.map((r) => r.meal_name as string), old.meal_name]);

  ctx.recentNames = await recentMealNames(sql, profileId, old.meal_date);
  ctx.month = Number(String(old.meal_date).slice(5, 7));

  // Fleisch-Grenze: zählt die anderen Gerichte derselben Kalenderwoche im Plan
  let candidates = pool;
  let limitReached = false;
  if (ctx.meatMaxPerWeek != null) {
    const week = isoWeekKey(old.meal_date);
    const others = await sql`SELECT meal_name, ingredients, meal_date::text AS d FROM plan_meals
      WHERE plan_id = ${old.plan_id} AND id <> ${planMealId} AND NOT rejected`;
    const meat = others.filter(
      (o) => isoWeekKey(o.d) === week && isMeatDish({ name: o.meal_name, ingredients: o.ingredients ?? [], type: "fleisch", instructions: "" })
    ).length;
    limitReached = meat >= ctx.meatMaxPerWeek;
    if (limitReached) candidates = pool.filter((r) => !isMeatDish(r));
  }
  // Ist die Grenze erreicht, soll auch die KI nichts mit Fleisch liefern
  const dayType = limitReached && preferredTypeFor(old.meal_date) === "fleisch" ? "vegetarisch" : preferredTypeFor(old.meal_date);
  const fromAi = async () =>
    (await generateRecipes(env, sql, [dayType], ctx, pool.map((m) => m.name))).find((r) => !limitReached || !isMeatDish(r)) ?? null;

  let best: Recipe | null = null;
  // „Neu generieren“: am liebsten ein ganz neues KI-Rezept
  if (!reject) best = await fromAi();
  best ??= pickReplacement(old.meal_date, ctx, candidates, exclude);
  // Pool erschöpft (z. B. vegan) → KI als Rettung
  if (!best && reject) best = await fromAi();
  if (!best) return null;

  if (!reject) await sql`DELETE FROM plan_meals WHERE id = ${planMealId}`;
  const inserted = await sql.query(
    `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions, duration_min, dessert, rejected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING ${PLAN_MEAL_COLS}`,
    // Der Nachtisch bleibt beim Austauschen am Tag hängen
    [old.plan_id, old.meal_date, best.name, best.type, best.ingredients, best.instructions, best.durationMin ?? null,
      old.dessert ? JSON.stringify(old.dessert) : null]
  );
  const replacement = inserted[0];
  await markFavoritesPlanned(sql, profileId, old.plan_id);
  const img = await sql`SELECT image_url FROM meal_images WHERE meal_name = ${best.name} AND image_data IS NOT NULL`;
  if (img[0]) replacement.image_url = img[0].image_url;
  else waitUntil(generateImage(env, sql, best.name));
  return replacement;
}

/**
 * Alle Gerichte (ohne ausgeblendete). Solche, die nicht zu den Gesundheitseinstellungen passen, sind mit
 * `unsuitable` markiert – sie werden nie automatisch geplant, lassen sich aber ansehen und bearbeiten.
 */
export async function recipeCatalog(sql: Sql, profileId: string) {
  const [{ pool, favorites }, ctx, images, dbRecipes] = await Promise.all([
    loadPool(sql, profileId),
    loadContext(sql, profileId),
    sql`SELECT meal_name, image_url, source, credit_name, credit_url FROM meal_images WHERE image_data IS NOT NULL`,
    sql`SELECT name, source, replaces FROM recipes`,
  ]);
  const imageBy = new Map(images.map((r) => [r.meal_name as string, r]));
  const hidden = new Set(ctx.rejectedMeals);
  const builtIn = new Set(MEAL_DATABASE.map((m) => m.name));
  const rowBy = new Map(dbRecipes.map((r) => [r.name as string, r]));
  const favoriteNames = new Set(favorites.map((f) => f.meal_name as string));
  const origin = (name: string) => {
    const row = rowBy.get(name);
    if (builtIn.has(name) || row?.replaces) return "basis";
    if (row?.source === "import") return "import";
    if (row?.source === "ai") return "ki";
    return favoriteNames.has(name) || row ? "favorit" : "ki";
  };
  const recipes = pool
    .filter((r) => !hidden.has(r.name))
    .map((r) => {
      const img = imageBy.get(r.name);
      return {
        name: r.name,
        type: r.type,
        ingredients: r.ingredients,
        instructions: r.instructions,
        durationMin: r.durationMin ?? null,
        imageUrl: (img?.image_url as string | undefined) ?? r.imageUrl ?? null,
        imageCredit: img
          ? img.source !== "ai" && img.credit_name ? { name: img.credit_name, url: img.credit_url } : null
          : r.imageUrl ? { name: "TheMealDB", url: "https://www.themealdb.com/" } : null,
        origin: origin(r.name),
        /** Gericht der Grundsammlung, das bearbeitet wurde (lässt sich zurücksetzen) */
        edited: !!rowBy.get(r.name)?.replaces,
        unsuitable: violatesHealthConditions(r, ctx.healthConditions),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { recipes, hidden: [...hidden].sort((a, b) => a.localeCompare(b, "de")), healthConditions: ctx.healthConditions };
}

/** Gericht im Plan gezielt durch ein Rezept aus der Übersicht ersetzen (Nachtisch bleibt am Tag) */
export async function replaceWithRecipe(env: Env, sql: Sql, profileId: string, planMealId: string, recipeName: string,
  waitUntil: (p: Promise<unknown>) => void) {
  const owned = await sql`SELECT 1 FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
    WHERE pm.id = ${planMealId} AND mp.profile_id = ${profileId}`;
  if (!owned[0]) return null;
  const rows = await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE id = $1`, [planMealId]);
  const old = rows[0];
  if (!old) return null;
  const { pool } = await loadPool(sql, profileId);
  const recipe = pool.find((r) => r.name === recipeName);
  if (!recipe) return null;
  await sql`DELETE FROM plan_meals WHERE id = ${planMealId}`;
  const inserted = await sql.query(
    `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions, duration_min, dessert, rejected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING ${PLAN_MEAL_COLS}`,
    [old.plan_id, old.meal_date, recipe.name, recipe.type, recipe.ingredients, recipe.instructions, recipe.durationMin ?? null,
      old.dessert ? JSON.stringify(old.dessert) : null]
  );
  const replacement = inserted[0];
  await markFavoritesPlanned(sql, profileId, old.plan_id);
  const img = await sql`SELECT image_url FROM meal_images WHERE meal_name = ${recipe.name} AND image_data IS NOT NULL`;
  if (img[0]) replacement.image_url = img[0].image_url;
  else waitUntil(generateImage(env, sql, recipe.name));
  return replacement;
}
