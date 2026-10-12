// API der Meal-Plan-App (ersetzt Supabase + Edge Functions). Wird von worker/index.ts für /api/* aufgerufen.
// Secrets (Cloudflare → Worker → Settings → Variables and Secrets):
//   DATABASE_URL  – Neon Connection String (Secret)
//   APP_PASSWORD  – Familien-Passwort für die App (Secret, optional; leer = kein Schutz)

import { neon } from "@neondatabase/serverless";
import { pickMeal, pickReplacement, preferredTypeFor, MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";
import { buildPlanItems, familyPortions } from "./shopping";
import { generateImage, fillMissingImages, serveImage, IMAGE_URL_SQL, type AiEnv } from "./images";

export interface Env extends AiEnv {
  DATABASE_URL: string;
  APP_PASSWORD?: string;
}

type Sql = ReturnType<typeof neon>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Spaltenlisten mit Datum als Text (YYYY-MM-DD), damit das Frontend Strings bekommt
const PLAN_COLS = `id, profile_id, start_date::text AS start_date, end_date::text AS end_date, status, created_at`;
const PLAN_MEAL_COLS = `id, plan_id, meal_date::text AS meal_date, meal_name, meal_type, ingredients, instructions, rejected, image_url, duration_min, created_at`;
const ROUTINE_COLS = `id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days, active, last_run_at, created_at`;

let schemaReady: Promise<unknown> | null = null;

async function migrate(sql: Sql) {
  await sql`ALTER TABLE routines ADD COLUMN IF NOT EXISTS last_run_at timestamptz`;
  await sql`ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS duration_min integer`;
  await sql`CREATE TABLE IF NOT EXISTS favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name text NOT NULL,
    meal_type text NOT NULL,
    ingredients text[] NOT NULL DEFAULT '{}',
    instructions text,
    duration_min integer,
    turnus_weeks integer,
    last_planned date,
    created_at timestamptz DEFAULT now(),
    UNIQUE (profile_id, meal_name))`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS image_data bytea`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS content_type text`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`;
  await sql`CREATE TABLE IF NOT EXISTS shopping_labels (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    sort integer NOT NULL DEFAULT 0,
    PRIMARY KEY (profile_id, id))`;
  await sql`CREATE TABLE IF NOT EXISTS ingredient_prefs (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    label text,
    asin text,
    product_name text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key))`;
  await sql`CREATE TABLE IF NOT EXISTS shopping_item_state (
    plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    item_key text NOT NULL,
    checked boolean NOT NULL DEFAULT false,
    label text,
    PRIMARY KEY (plan_id, item_key))`;
  await sql`CREATE TABLE IF NOT EXISTS shopping_extras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    name text NOT NULL,
    label text NOT NULL,
    checked boolean NOT NULL DEFAULT false,
    is_basic boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now())`;
}

const DEFAULT_LABELS = [
  { id: "knuspr", name: "Knuspr", color: "#22c55e" },
  { id: "metzger", name: "Metzger", color: "#f97316" },
];

const prefKey = (name: string) => name.trim().toLowerCase();

async function getLabels(sql: Sql, profileId: string) {
  let rows = await sql`SELECT id, name, color FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  if (rows.length === 0) {
    for (const [i, l] of DEFAULT_LABELS.entries()) {
      await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort)
        VALUES (${profileId}, ${l.id}, ${l.name}, ${l.color}, ${i}) ON CONFLICT DO NOTHING`;
    }
    rows = await sql`SELECT id, name, color FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  }
  return rows;
}

/** Komplette Einkaufsliste eines Plans: berechnete Zutaten + gespeicherter Zustand + eigene Artikel */
async function getShopping(sql: Sql, profileId: string, planId: string) {
  const [labels, meals, members, states, extras, prefs] = await Promise.all([
    getLabels(sql, profileId),
    sql`SELECT ingredients FROM plan_meals WHERE plan_id = ${planId} AND NOT rejected`,
    sql`SELECT type, age FROM family_members WHERE profile_id = ${profileId}`,
    sql`SELECT item_key, checked, label FROM shopping_item_state WHERE plan_id = ${planId}`,
    sql`SELECT id, name, label, checked, is_basic FROM shopping_extras WHERE plan_id = ${planId} ORDER BY created_at`,
    sql`SELECT name_key, label, asin, product_name FROM ingredient_prefs WHERE profile_id = ${profileId}`,
  ]);
  const labelIds = new Set(labels.map((l) => l.id));
  const portions = familyPortions(members as { type: string; age: number | null }[]);
  const built = buildPlanItems(meals.map((m) => m.ingredients as string[]), portions);
  const stateBy = new Map(states.map((r) => [r.item_key, r]));
  const prefBy = new Map(prefs.map((r) => [r.name_key, r]));
  const validLabel = (l: string | null | undefined, fallback: string) => (l && labelIds.has(l) ? l : fallback);

  const items = [
    ...built.items.map((i) => {
      const st = stateBy.get(i.key);
      const pref = prefBy.get(prefKey(i.baseName));
      return {
        id: `p:${i.key}`,
        name: i.display,
        baseName: i.baseName,
        label: validLabel(st?.label ?? pref?.label, validLabel(i.defaultLabel, "knuspr")),
        checked: !!st?.checked,
        isBasic: false,
        asin: pref?.asin ?? undefined,
        productName: pref?.product_name ?? undefined,
      };
    }),
    ...extras.map((x) => {
      const pref = prefBy.get(prefKey(x.name));
      return {
        id: `x:${x.id}`,
        name: x.name,
        baseName: x.name,
        label: validLabel(x.label, "knuspr"),
        checked: x.checked,
        isBasic: x.is_basic,
        asin: pref?.asin ?? undefined,
        productName: pref?.product_name ?? undefined,
      };
    }),
  ];
  return { labels, items, pantryNeeded: built.pantryNeeded, portions };
}

async function planOwned(sql: Sql, profileId: string, planId: string) {
  const rows = await sql`SELECT 1 FROM meal_plans WHERE id = ${planId} AND profile_id = ${profileId}`;
  return rows.length > 0;
}
/** Kleine Schema-Ergänzungen automatisch nachziehen (idempotent) */
function ensureSchema(sql: Sql) {
  schemaReady ??= migrate(sql).catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

const FAVORITE_COLS = `id, meal_name, meal_type, ingredients, instructions, duration_min, turnus_weeks,
  last_planned::text AS last_planned, created_at`;

async function loadFavorites(sql: Sql, profileId: string) {
  return sql.query(`SELECT ${FAVORITE_COLS} FROM favorites WHERE profile_id = $1 ORDER BY created_at`, [profileId]);
}

function favoriteToRecipe(f: Record<string, any>): Recipe {
  return {
    name: f.meal_name,
    type: f.meal_type,
    ingredients: f.ingredients ?? [],
    instructions: f.instructions ?? "",
    durationMin: f.duration_min ?? null,
  };
}

/** Alle Rezepte, aus denen geplant wird: feste Liste + Favoriten (die nicht in der Liste stehen) */
async function loadPool(sql: Sql, profileId: string): Promise<{ pool: Recipe[]; favorites: Record<string, any>[] }> {
  const favorites = await loadFavorites(sql, profileId);
  const names = new Set(MEAL_DATABASE.map((m) => m.name));
  const pool: Recipe[] = [...MEAL_DATABASE];
  for (const f of favorites) if (!names.has(f.meal_name)) pool.push(favoriteToRecipe(f));
  return { pool, favorites };
}

function addDaysIso(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Plan für [startDate, endDate] erzeugen und speichern */
async function createPlan(sql: Sql, profileId: string, startDate: string, endDate: string) {
  const ctx = await loadContext(sql, profileId);
  const { pool, favorites } = await loadPool(sql, profileId);
  ctx.favoriteNames = favorites.filter((f) => !f.turnus_weeks).map((f) => f.meal_name);

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

  // 2) Restliche Tage normal planen
  const meals: { date: string; recipe: Recipe }[] = [];
  for (const date of dates) {
    const fixed = assigned.get(date);
    const recipe = fixed ?? pickMeal(date, ctx, used, pool);
    if (recipe) meals.push({ date, recipe });
  }

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
async function replaceMeal(env: Env, sql: Sql, profileId: string, planMealId: string, reject: boolean,
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

  const best = pickReplacement(old.meal_date, ctx, pool, exclude);
  if (!best) return null;

  if (!reject) await sql`DELETE FROM plan_meals WHERE id = ${planMealId}`;
  const inserted = await sql.query(
    `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions, duration_min, rejected)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false) RETURNING ${PLAN_MEAL_COLS}`,
    [old.plan_id, old.meal_date, best.name, best.type, best.ingredients, best.instructions, best.durationMin ?? null]
  );
  const replacement = inserted[0];
  await markFavoritesPlanned(sql, profileId, old.plan_id);
  const img = await sql`SELECT image_url FROM meal_images WHERE meal_name = ${best.name} AND image_data IS NOT NULL`;
  if (img[0]) replacement.image_url = img[0].image_url;
  else waitUntil(generateImage(env, sql, best.name));
  return replacement;
}

async function latestPlan(sql: Sql, profileId: string) {
  const rows = await sql.query(
    `SELECT ${PLAN_COLS} FROM meal_plans WHERE profile_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [profileId]
  );
  return rows[0] ?? null;
}

async function getProfile(sql: Sql) {
  const rows = await sql`SELECT * FROM profiles ORDER BY created_at LIMIT 1`;
  if (rows[0]) return rows[0];
  const created = await sql`INSERT INTO profiles DEFAULT VALUES RETURNING *`;
  return created[0];
}

async function loadContext(sql: Sql, profileId: string): Promise<ScoringContext> {
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

export async function handleApi(
  request: Request,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void = () => {}
): Promise<Response> {
  // Bilder sind öffentlich (ein <img> kann kein Passwort mitschicken)
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path.startsWith("/api/images/") && env.DATABASE_URL) {
    const sql = neon(env.DATABASE_URL);
    return serveImage(sql, decodeURIComponent(path.slice("/api/images/".length)));
  }

  if (env.APP_PASSWORD && request.headers.get("X-App-Password") !== env.APP_PASSWORD) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.DATABASE_URL) return json({ error: "DATABASE_URL fehlt" }, 500);

  const sql = neon(env.DATABASE_URL);
  await ensureSchema(sql);
  const parts = new URL(request.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = `${request.method} /${parts.join("/")}`;
  const body = ["POST", "PUT", "PATCH"].includes(request.method) ? await request.json<any>().catch(() => ({})) : {};
  const id = parts[1];

  try {
    // ---------- Profil ----------
    if (route === "GET /profile") return json(await getProfile(sql));

    if (route === "PUT /profile") {
      const p = await getProfile(sql);
      const rows = await sql`UPDATE profiles
        SET health_goal = ${body.health_goal}, health_conditions = ${body.health_conditions ?? []}, updated_at = now()
        WHERE id = ${p.id} RETURNING *`;
      return json(rows[0]);
    }

    // ---------- Familie ----------
    if (route === "GET /family") {
      const p = await getProfile(sql);
      return json(await sql`SELECT * FROM family_members WHERE profile_id = ${p.id} ORDER BY created_at`);
    }
    if (route === "POST /family") {
      const p = await getProfile(sql);
      const rows = await sql`INSERT INTO family_members (profile_id, name, type, age, favorite_foods, disliked_foods)
        VALUES (${p.id}, ${body.name}, ${body.type}, ${body.age ?? null}, ${body.favorite_foods ?? []}, ${body.disliked_foods ?? []})
        RETURNING *`;
      return json(rows[0]);
    }
    if (parts[0] === "family" && id && request.method === "DELETE") {
      await sql`DELETE FROM family_members WHERE id = ${id}`;
      return json({ ok: true });
    }

    // ---------- Bewertungen ----------
    if (route === "GET /ratings") {
      const p = await getProfile(sql);
      const rows = await sql`SELECT meal_name, rating FROM meal_ratings WHERE profile_id = ${p.id}`;
      return json(Object.fromEntries(rows.map((r) => [r.meal_name, r.rating])));
    }
    if (route === "PUT /ratings") {
      const p = await getProfile(sql);
      const rows = await sql`INSERT INTO meal_ratings (profile_id, meal_name, rating, notes)
        VALUES (${p.id}, ${body.meal_name}, ${body.rating}, ${body.notes ?? null})
        ON CONFLICT (profile_id, meal_name) DO UPDATE SET rating = EXCLUDED.rating, notes = EXCLUDED.notes
        RETURNING *`;
      return json(rows[0]);
    }

    // ---------- Routinen ----------
    if (route === "GET /routines") {
      const p = await getProfile(sql);
      return json(await sql.query(`SELECT ${ROUTINE_COLS} FROM routines WHERE profile_id = $1 ORDER BY created_at`, [p.id]));
    }
    if (route === "POST /routines") {
      const p = await getProfile(sql);
      const rows = await sql.query(
        `INSERT INTO routines (profile_id, name, frequency, day_of_week, time, duration_days, active)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING ${ROUTINE_COLS}`,
        [p.id, body.name, body.frequency, body.day_of_week ?? null, body.time || null, body.duration_days ?? 7]
      );
      return json(rows[0]);
    }
    if (parts[0] === "routines" && id && request.method === "DELETE") {
      await sql`DELETE FROM routines WHERE id = ${id}`;
      return json({ ok: true });
    }

    // ---------- Pläne ----------
    if (route === "POST /plans") {
      const { startDate, endDate } = body;
      if (!startDate || !endDate) return json({ error: "startDate und endDate fehlen" }, 400);
      const p = await getProfile(sql);
      const plan = await createPlan(sql, p.id, startDate, endDate);
      waitUntil(fillMissingImages(env, sql, 7, plan.id));
      return json(plan);
    }

    if (parts[0] === "plans" && id && id !== "latest" && !parts[2] && request.method === "DELETE") {
      const p = await getProfile(sql);
      await sql`DELETE FROM meal_plans WHERE id = ${id} AND profile_id = ${p.id}`;
      return json({ ok: true, latest: await latestPlan(sql, p.id) });
    }

    // Neuester aktiver Plan (für das Laden nach einem Reload)
    if (route === "GET /plans/latest") {
      const p = await getProfile(sql);
      return json(await latestPlan(sql, p.id));
    }

    if (parts[0] === "plans" && id && parts[2] === "meals" && request.method === "GET") {
      return json(
        await sql.query(
          `SELECT pm.id, pm.plan_id, pm.meal_date::text AS meal_date, pm.meal_name, pm.meal_type, pm.ingredients,
                  pm.instructions, pm.rejected, ${IMAGE_URL_SQL} AS image_url, pm.duration_min, pm.created_at
           FROM plan_meals pm LEFT JOIN meal_images mi ON mi.meal_name = pm.meal_name
           WHERE pm.plan_id = $1 ORDER BY pm.meal_date`,
          [id]
        )
      );
    }

    // Gericht ablehnen (kommt nicht wieder) bzw. neu generieren (nur austauschen)
    if (parts[0] === "plan-meals" && id && (parts[2] === "reject" || parts[2] === "regenerate") && request.method === "POST") {
      const p = await getProfile(sql);
      const replacement = await replaceMeal(env, sql, p.id, id, parts[2] === "reject", waitUntil);
      if (!replacement) return json({ error: "Kein passender Ersatz gefunden" }, 404);
      return json({ replacement });
    }

    // Kompletten Plan neu generieren (gleicher Zeitraum, alter Plan wird ersetzt)
    if (parts[0] === "plans" && id && parts[2] === "regenerate" && request.method === "POST") {
      const p = await getProfile(sql);
      const rows = await sql.query(`SELECT ${PLAN_COLS} FROM meal_plans WHERE id = $1 AND profile_id = $2`, [id, p.id]);
      if (!rows[0]) return json({ error: "Plan nicht gefunden" }, 404);
      // Turnus-Zähler nicht durch den alten Plan blockieren lassen
      await sql`UPDATE favorites SET last_planned = NULL WHERE profile_id = ${p.id}
        AND last_planned BETWEEN ${rows[0].start_date}::date AND ${rows[0].end_date}::date`;
      await sql`DELETE FROM meal_plans WHERE id = ${id}`;
      const plan = await createPlan(sql, p.id, rows[0].start_date, rows[0].end_date);
      waitUntil(fillMissingImages(env, sql, 7, plan.id));
      return json(plan);
    }

    // ---------- Favoriten ----------
    if (route === "GET /favorites") {
      const p = await getProfile(sql);
      return json(await loadFavorites(sql, p.id));
    }
    if (route === "POST /favorites") {
      const p = await getProfile(sql);
      const rows = await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE id = $1`, [body.planMealId]);
      const pm = rows[0];
      if (!pm) return json({ error: "Gericht nicht gefunden" }, 404);
      await sql`INSERT INTO favorites (profile_id, meal_name, meal_type, ingredients, instructions, duration_min, last_planned)
        VALUES (${p.id}, ${pm.meal_name}, ${pm.meal_type}, ${pm.ingredients}, ${pm.instructions}, ${pm.duration_min}, ${pm.meal_date}::date)
        ON CONFLICT (profile_id, meal_name) DO NOTHING`;
      return json(await loadFavorites(sql, p.id));
    }
    if (parts[0] === "favorites" && id && request.method === "PATCH") {
      const p = await getProfile(sql);
      const weeks = Number(body.turnus_weeks) || null;
      await sql`UPDATE favorites SET turnus_weeks = ${weeks} WHERE id = ${id} AND profile_id = ${p.id}`;
      return json(await loadFavorites(sql, p.id));
    }
    if (parts[0] === "favorites" && id && request.method === "DELETE") {
      const p = await getProfile(sql);
      await sql`DELETE FROM favorites WHERE id = ${id} AND profile_id = ${p.id}`;
      return json(await loadFavorites(sql, p.id));
    }

    // ---------- Einkaufsliste ----------
    if (parts[0] === "plans" && id && parts[2] === "shopping") {
      const p = await getProfile(sql);
      if (!(await planOwned(sql, p.id, id))) return json({ error: "Plan nicht gefunden" }, 404);
      const itemId = parts[3] ? decodeURIComponent(parts[3]) : "";

      if (request.method === "GET" && !itemId) return json(await getShopping(sql, p.id, id));

      // Eigenen Artikel / Basic hinzufügen
      if (request.method === "POST" && !itemId) {
        const name = String(body.name ?? "").trim();
        if (!name) return json({ error: "Name fehlt" }, 400);
        await sql`INSERT INTO shopping_extras (plan_id, name, label, is_basic)
          VALUES (${id}, ${name}, ${body.label || "knuspr"}, ${!!body.isBasic})`;
        return json(await getShopping(sql, p.id, id));
      }

      // Abhaken / Label ändern
      if (request.method === "PATCH" && itemId) {
        if (itemId.startsWith("x:")) {
          const xid = itemId.slice(2);
          if (body.checked !== undefined) await sql`UPDATE shopping_extras SET checked = ${!!body.checked} WHERE id = ${xid} AND plan_id = ${id}`;
          if (body.label) {
            await sql`UPDATE shopping_extras SET label = ${body.label} WHERE id = ${xid} AND plan_id = ${id}`;
            if (!body.isBasic && body.baseName) {
              await sql`INSERT INTO ingredient_prefs (profile_id, name_key, label) VALUES (${p.id}, ${prefKey(body.baseName)}, ${body.label})
                ON CONFLICT (profile_id, name_key) DO UPDATE SET label = EXCLUDED.label, updated_at = now()`;
            }
          }
        } else if (itemId.startsWith("p:")) {
          const key = itemId.slice(2);
          await sql`INSERT INTO shopping_item_state (plan_id, item_key, checked, label)
            VALUES (${id}, ${key}, ${!!body.checked}, ${body.label ?? null})
            ON CONFLICT (plan_id, item_key) DO UPDATE SET
              checked = CASE WHEN ${body.checked === undefined} THEN shopping_item_state.checked ELSE EXCLUDED.checked END,
              label = COALESCE(EXCLUDED.label, shopping_item_state.label)`;
          // Label für künftige Pläne merken
          if (body.label && body.baseName) {
            await sql`INSERT INTO ingredient_prefs (profile_id, name_key, label) VALUES (${p.id}, ${prefKey(body.baseName)}, ${body.label})
              ON CONFLICT (profile_id, name_key) DO UPDATE SET label = EXCLUDED.label, updated_at = now()`;
          }
        }
        return json({ ok: true });
      }

      // Eigenen Artikel / Basic entfernen
      if (request.method === "DELETE" && itemId.startsWith("x:")) {
        await sql`DELETE FROM shopping_extras WHERE id = ${itemId.slice(2)} AND plan_id = ${id}`;
        return json({ ok: true });
      }
    }

    // Amazon-Produkt pro Zutat merken (gilt für alle Pläne)
    if (route === "PUT /ingredient-prefs") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Name fehlt" }, 400);
      await sql`INSERT INTO ingredient_prefs (profile_id, name_key, asin, product_name)
        VALUES (${p.id}, ${prefKey(name)}, ${body.asin ?? null}, ${body.productName ?? null})
        ON CONFLICT (profile_id, name_key) DO UPDATE SET asin = EXCLUDED.asin, product_name = EXCLUDED.product_name, updated_at = now()`;
      return json({ ok: true });
    }

    // ---------- Einkaufs-Labels ----------
    if (route === "GET /labels") {
      const p = await getProfile(sql);
      return json(await getLabels(sql, p.id));
    }
    if (route === "POST /labels") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Name fehlt" }, 400);
      const labelId = name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "") || `label-${Date.now()}`;
      await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort)
        VALUES (${p.id}, ${labelId}, ${name}, ${body.color || "#3b82f6"},
                (SELECT COALESCE(MAX(sort), 0) + 1 FROM shopping_labels WHERE profile_id = ${p.id}))
        ON CONFLICT (profile_id, id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`;
      return json(await getLabels(sql, p.id));
    }
    if (parts[0] === "labels" && id && request.method === "DELETE") {
      if (DEFAULT_LABELS.some((l) => l.id === id)) return json({ error: "Standard-Labels können nicht gelöscht werden" }, 400);
      const p = await getProfile(sql);
      await sql`DELETE FROM shopping_labels WHERE profile_id = ${p.id} AND id = ${id}`;
      // Artikel mit diesem Label wandern zurück zu Knuspr
      await sql`UPDATE ingredient_prefs SET label = NULL WHERE profile_id = ${p.id} AND label = ${id}`;
      await sql`UPDATE shopping_item_state SET label = NULL WHERE label = ${id}
        AND plan_id IN (SELECT id FROM meal_plans WHERE profile_id = ${p.id})`;
      await sql`UPDATE shopping_extras SET label = 'knuspr' WHERE label = ${id}
        AND plan_id IN (SELECT id FROM meal_plans WHERE profile_id = ${p.id})`;
      return json(await getLabels(sql, p.id));
    }

    // ---------- Bilder ----------
    // Bild (neu) erzeugen – für den Knopf im Rezept
    if (route === "POST /meal-images/generate") {
      const name = String(body.mealName ?? "").trim();
      if (!name) return json({ error: "mealName fehlt" }, 400);
      if (!body.force) {
        const existing = await sql`SELECT image_url FROM meal_images WHERE meal_name = ${name} AND image_data IS NOT NULL`;
        if (existing[0]) return json({ imageUrl: existing[0].image_url });
      }
      const url = await generateImage(env, sql, name);
      if (!url) return json({ error: "Bild konnte nicht erzeugt werden" }, 502);
      return json({ imageUrl: url });
    }

    return json({ error: `Unbekannte Route: ${route}` }, 404);
  } catch (err) {
    console.error(route, err);
    return json({ error: (err as Error).message }, 500);
  }
}

// ---------- Routinen automatisch ausführen (Cloudflare Cron, alle 15 Min) ----------

/** Aktuelles Datum/Uhrzeit in Deutschland */
function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`, weekday, day: Number(parts.day) };
}

/** Fällige Routinen ausführen: Plan ab morgen über duration_days Tage */
export async function runRoutines(env: Env) {
  if (!env.DATABASE_URL) return;
  const sql = neon(env.DATABASE_URL);
  await ensureSchema(sql);
  const now = berlinNow();

  const routines = await sql.query(
    `SELECT id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days,
            to_char(last_run_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS last_run_date
     FROM routines WHERE active = true`
  );

  for (const r of routines) {
    const dueToday = r.frequency === "weekly" ? r.day_of_week === now.weekday : now.day === 1;
    const timeReached = now.time >= (r.time || "00:00");
    if (!dueToday || !timeReached || r.last_run_date === now.date) continue;

    // Erst als ausgeführt markieren, damit parallele Läufe keinen doppelten Plan erzeugen
    const claimed = await sql`UPDATE routines SET last_run_at = now()
      WHERE id = ${r.id} AND (last_run_at IS NULL OR (last_run_at AT TIME ZONE 'Europe/Berlin')::date < ${now.date}::date)
      RETURNING id`;
    if (!claimed.length) continue;

    const start = addDaysIso(now.date, 1);
    const end = addDaysIso(start, Math.max(1, r.duration_days) - 1);
    await createPlan(sql, r.profile_id, start, end);
    console.log(`Routine "${r.name}" ausgeführt: Plan ${start} bis ${end}`);
  }

  // Fehlende Rezeptbilder nachziehen
  await fillMissingImages(env, sql, 5);
}
