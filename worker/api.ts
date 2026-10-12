// API der Meal-Plan-App (ersetzt Supabase + Edge Functions). Wird von worker/index.ts für /api/* aufgerufen.
// Secrets (Cloudflare → Worker → Settings → Variables and Secrets):
//   DATABASE_URL  – Neon Connection String (Secret)
//   APP_PASSWORD  – Familien-Passwort für die App (Secret, optional; leer = kein Schutz)

import { neon } from "@neondatabase/serverless";
import { pickMeal, pickReplacement, preferredTypeFor, scoreMeal, violatesHealthConditions, MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";
import { buildPlanItems, familyPortions, mergeKey } from "./shopping";
import { generateImage, fillMissingImages, serveImage, IMAGE_URL_SQL, IMAGE_CREDIT_SQL, type AiEnv } from "./images";
import { generateRecipes } from "./aiRecipes";
import { importRecipeFromUrl, ImportError } from "./recipeImport";
import {
  encrypt, decrypt, ShopError, knusprLogin, knusprSearch, knusprAddToCart, knusprGetCart, knusprRemoveFromCart, knusprSetQuantity, picnicLogin, picnicVerify, picnicSearch,
  type ShopEnv,
} from "./shops";

export interface Env extends AiEnv, ShopEnv {
  DATABASE_URL: string;
  APP_PASSWORD?: string;
  CREDENTIALS_KEY?: string;
}

type Sql = ReturnType<typeof neon>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Spaltenlisten mit Datum als Text (YYYY-MM-DD), damit das Frontend Strings bekommt
const PLAN_COLS = `id, profile_id, start_date::text AS start_date, end_date::text AS end_date, status, created_at`;
const PLAN_MEAL_COLS = `id, plan_id, meal_date::text AS meal_date, meal_name, meal_type, ingredients, instructions, rejected, image_url, duration_min, dessert, created_at`;
const ROUTINE_COLS = `id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days, active, last_run_at, created_at`;

let schemaReady: Promise<unknown> | null = null;

// Bei jeder Schema-Änderung unten hochzählen. Der Stand steht als Kommentar an der Tabelle `profiles`,
// damit ein aktueller Worker beim Kaltstart gar keine DDL ausführt: ALTER TABLE sperrt die Tabelle
// auch dann, wenn die Spalte schon existiert, und kann so alle Anfragen blockieren.
const SCHEMA_VERSION = "schema:2026101205";

async function migrate(sql: Sql) {
  const current = await sql`SELECT obj_description('public.profiles'::regclass, 'pg_class') AS v`;
  if (current[0]?.v === SCHEMA_VERSION) return;
  await runMigrations(sql);
  // Nur eine Abkürzung für den nächsten Kaltstart – darf die Anfrage nicht scheitern lassen
  await sql.query(`COMMENT ON TABLE profiles IS '${SCHEMA_VERSION}'`).catch((e) => console.warn("Schema-Stand nicht gespeichert", e));
}

async function runMigrations(sql: Sql) {
  await sql`ALTER TABLE routines ADD COLUMN IF NOT EXISTS last_run_at timestamptz`;
  await sql`ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS duration_min integer`;
  // Nachtisch zum Gericht: { name, ingredients, instructions, durationMin, imageUrl, yield } aus der Sammlung im Frontend
  await sql`ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS dessert jsonb`;
  // Eigene Filter für die Rezept-Übersicht (Suchbegriffe und/oder maximale Zubereitungszeit)
  await sql`CREATE TABLE IF NOT EXISTS recipe_filters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    scope text NOT NULL DEFAULT 'beide' CHECK (scope IN ('gerichte', 'nachtische', 'beide')),
    keywords text[] NOT NULL DEFAULT '{}',
    max_minutes integer,
    created_at timestamptz DEFAULT now())`;
  await sql`CREATE TABLE IF NOT EXISTS recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    type text NOT NULL CHECK (type IN ('vegetarisch', 'fleisch', 'wochenende')),
    ingredients text[] NOT NULL,
    instructions text NOT NULL,
    duration_min integer,
    source text NOT NULL DEFAULT 'ai',
    created_at timestamptz DEFAULT now())`;
  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url text`;
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
  await sql`ALTER TABLE shopping_labels ADD COLUMN IF NOT EXISTS provider text`;
  await sql`UPDATE shopping_labels SET provider = 'knuspr' WHERE id = 'knuspr' AND provider IS NULL`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS standard_label text`;
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metzger_auto boolean NOT NULL DEFAULT true`;
  await sql`CREATE TABLE IF NOT EXISTS shop_connections (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider text NOT NULL,
    email text NOT NULL,
    secret_enc text NOT NULL,
    secret_iv text NOT NULL,
    device_id text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, provider))`;
  await sql`CREATE TABLE IF NOT EXISTS product_links (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    provider text NOT NULL,
    product_id text NOT NULL,
    product_name text,
    image_url text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key, provider))`;
  await sql`CREATE TABLE IF NOT EXISTS pantry_items (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key))`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS image_data bytea`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS content_type text`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS source text`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS credit_name text`;
  await sql`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS credit_url text`;
  // Einmalig (2026101203): Ersatzfotos der ersten, zu lockeren Suche verwerfen – werden neu gesucht
  await sql`UPDATE meal_images SET image_data = NULL WHERE source IN ('pexels', 'pixabay', 'openverse')`;
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
  { id: "knuspr", name: "Knuspr", color: "#22c55e", provider: "knuspr" },
  { id: "metzger", name: "Metzger", color: "#f97316", provider: null },
];

/** Online-Shops, die sich in den Einstellungen aktivieren lassen (Label-ID = Provider) */
const SHOP_LABELS: Record<string, { name: string; color: string }> = {
  amazon: { name: "Amazon", color: "#f59e0b" },
  knuspr: { name: "Knuspr", color: "#22c55e" },
  picnic: { name: "Picnic", color: "#e11d48" },
};

const prefKey = (name: string) => name.trim().toLowerCase();

async function getLabels(sql: Sql, profileId: string) {
  let rows = await sql`SELECT id, name, color, provider FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  if (rows.length === 0) {
    for (const [i, l] of DEFAULT_LABELS.entries()) {
      await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort, provider)
        VALUES (${profileId}, ${l.id}, ${l.name}, ${l.color}, ${i}, ${l.provider}) ON CONFLICT DO NOTHING`;
    }
    rows = await sql`SELECT id, name, color, provider FROM shopping_labels WHERE profile_id = ${profileId} ORDER BY sort, name`;
  }
  return rows;
}

/** Komplette Einkaufsliste eines Plans: berechnete Zutaten + gespeicherter Zustand + eigene Artikel */
async function getShopping(sql: Sql, profileId: string, planId: string, range?: { from: string; to: string }) {
  const from = range?.from ?? "0001-01-01";
  const to = range?.to ?? "9999-12-31";
  // Pro Woche eigene Häkchen: Schlüssel bekommt das Wochen-Startdatum vorangestellt
  // Mehrere Wochen zusammen haben eigene Häkchen (andere Mengen als die einzelnen Wochen)
  const multiWeek = range && (Date.parse(range.to) - Date.parse(range.from)) / 86400000 > 7;
  const keyPrefix = range ? (multiWeek ? `${range.from}..${range.to}:` : `${range.from}:`) : "";
  const [labels, meals, members, states, extras, prefs, links, settingsRows, pantry] = await Promise.all([
    getLabels(sql, profileId),
    sql`SELECT ingredients, dessert FROM plan_meals WHERE plan_id = ${planId} AND NOT rejected
      AND meal_date BETWEEN ${from}::date AND ${to}::date`,
    sql`SELECT type, age FROM family_members WHERE profile_id = ${profileId}`,
    sql`SELECT item_key, checked, label FROM shopping_item_state WHERE plan_id = ${planId}`,
    sql`SELECT id, name, label, checked, is_basic FROM shopping_extras WHERE plan_id = ${planId} ORDER BY created_at`,
    sql`SELECT name_key, label FROM ingredient_prefs WHERE profile_id = ${profileId}`,
    sql`SELECT name_key, provider, product_id, product_name, image_url FROM product_links WHERE profile_id = ${profileId}`,
    sql`SELECT standard_label, metzger_auto FROM profiles WHERE id = ${profileId}`,
    sql`SELECT name_key, name FROM pantry_items WHERE profile_id = ${profileId} ORDER BY name`,
  ]);
  const labelIds = new Set(labels.map((l) => l.id));
  const portions = familyPortions(members as { type: string; age: number | null }[]);
  const built = buildPlanItems(
    meals.map((m) => m.ingredients as string[]),
    portions,
    new Set(pantry.map((r) => r.name_key as string)),
    // Nachtische haben eine feste Menge (z. B. ein ganzer Kuchen) und werden nicht umgerechnet
    meals.flatMap((m) => (m.dessert?.ingredients ? [m.dessert.ingredients as string[]] : []))
  );
  const stateBy = new Map(states.map((r) => [r.item_key, r]));
  const prefBy = new Map(prefs.map((r) => [r.name_key, r]));
  const validLabel = (l: string | null | undefined, fallback: string) => (l && labelIds.has(l) ? l : fallback);
  const settings = settingsRows[0] ?? {};
  const standard = validLabel(settings.standard_label, labelIds.has("knuspr") ? "knuspr" : (labels[0]?.id as string));
  const meatLabel = settings.metzger_auto !== false && labelIds.has("metzger") ? "metzger" : standard;
  const providerOf = new Map(labels.map((l) => [l.id as string, l.provider as string | null]));
  const linkBy = new Map(links.map((r) => [`${r.name_key}|${r.provider}`, r]));
  const productFor = (name: string, label: string) => {
    const provider = providerOf.get(label);
    const link = provider ? linkBy.get(`${prefKey(name)}|${provider}`) : undefined;
    return link
      ? { productId: link.product_id as string, productName: link.product_name as string, productImage: link.image_url as string | undefined }
      : {};
  };

  const items = [
    ...built.items.map((i) => {
      const st = stateBy.get(keyPrefix + i.key);
      const pref = prefBy.get(prefKey(i.baseName));
      const label = validLabel(st?.label ?? pref?.label, i.defaultLabel === "metzger" ? meatLabel : standard);
      return {
        id: `p:${keyPrefix}${i.key}`,
        name: i.display,
        baseName: i.baseName,
        label,
        checked: !!st?.checked,
        isBasic: false,
        ...productFor(i.baseName, label),
      };
    }),
    ...extras.map((x) => {
      const label = validLabel(x.label, standard);
      return {
        id: `x:${x.id}`,
        name: x.name,
        baseName: x.name,
        label,
        checked: x.checked,
        isBasic: x.is_basic,
        ...productFor(x.name, label),
      };
    }),
  ];
  return {
    labels,
    items,
    pantryNeeded: built.pantryNeeded,
    customPantry: pantry.map((r) => r.name as string),
    portions,
    standardLabel: standard,
  };
}

// ---------- Shops: Hilfsfunktionen ----------

async function enableShopLabel(sql: Sql, profileId: string, provider: string) {
  const meta = SHOP_LABELS[provider];
  await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort, provider)
    VALUES (${profileId}, ${provider}, ${meta.name}, ${meta.color},
            (SELECT COALESCE(MAX(sort), 0) + 1 FROM shopping_labels WHERE profile_id = ${profileId}), ${provider})
    ON CONFLICT (profile_id, id) DO UPDATE SET provider = EXCLUDED.provider`;
}

async function saveConnection(env: Env, sql: Sql, profileId: string, provider: string, email: string, secret: string, deviceId: string | null) {
  const enc = await encrypt(env, secret);
  await sql`INSERT INTO shop_connections (profile_id, provider, email, secret_enc, secret_iv, device_id, updated_at)
    VALUES (${profileId}, ${provider}, ${email}, ${enc.ciphertext}, ${enc.iv}, ${deviceId}, now())
    ON CONFLICT (profile_id, provider) DO UPDATE SET email = EXCLUDED.email, secret_enc = EXCLUDED.secret_enc,
      secret_iv = EXCLUDED.secret_iv, device_id = EXCLUDED.device_id, updated_at = now()`;
}

async function loadConnection(env: Env, sql: Sql, profileId: string, provider: string) {
  const rows = await sql`SELECT email, secret_enc, secret_iv, device_id FROM shop_connections
    WHERE profile_id = ${profileId} AND provider = ${provider}`;
  if (!rows[0]) return null;
  try {
    return {
      email: rows[0].email as string,
      secret: await decrypt(env, rows[0].secret_enc, rows[0].secret_iv),
      deviceId: rows[0].device_id as string | null,
    };
  } catch {
    // Schlüssel geändert → Verbindung unbrauchbar, neu verbinden lassen
    return null;
  }
}

/** Zustand für die Einstellungen: Standard-Liste, Metzger-Automatik, aktive Shops, Verbindungen */
async function getShopState(sql: Sql, profileId: string) {
  const [labels, settings, conns] = await Promise.all([
    getLabels(sql, profileId),
    sql`SELECT standard_label, metzger_auto FROM profiles WHERE id = ${profileId}`,
    sql`SELECT provider, email, updated_at FROM shop_connections WHERE profile_id = ${profileId}`,
  ]);
  const ids = new Set(labels.map((l) => l.id));
  return {
    labels,
    standardLabel: settings[0]?.standard_label && ids.has(settings[0].standard_label) ? settings[0].standard_label : ids.has("knuspr") ? "knuspr" : labels[0]?.id,
    metzgerAuto: settings[0]?.metzger_auto !== false,
    activeShops: labels.filter((l) => l.provider).map((l) => l.provider),
    connections: Object.fromEntries(conns.map((c) => [c.provider, { email: c.email, since: c.updated_at }])),
  };
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

/** Alle Rezepte, aus denen geplant wird: feste Liste + KI-Rezepte + Favoriten */
async function loadPool(sql: Sql, profileId: string): Promise<{ pool: Recipe[]; favorites: Record<string, any>[] }> {
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

function addDaysIso(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Plan für [startDate, endDate] erzeugen und speichern */
async function createPlan(env: Env, sql: Sql, profileId: string, startDate: string, endDate: string) {
  const ctx = await loadContext(sql, profileId);
  const { pool, favorites } = await loadPool(sql, profileId);
  ctx.favoriteNames = favorites.filter((f) => !f.turnus_weeks).map((f) => f.meal_name);
  ctx.recentNames = await recentMealNames(sql, profileId, startDate);

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

  ctx.recentNames = await recentMealNames(sql, profileId, old.meal_date);
  const dayType = preferredTypeFor(old.meal_date);
  let best: Recipe | null = null;
  // „Neu generieren“: am liebsten ein ganz neues KI-Rezept
  if (!reject) best = (await generateRecipes(env, sql, [dayType], ctx, pool.map((m) => m.name)))[0] ?? null;
  best ??= pickReplacement(old.meal_date, ctx, pool, exclude);
  // Pool erschöpft (z. B. vegan) → KI als Rettung
  if (!best && reject) best = (await generateRecipes(env, sql, [dayType], ctx, pool.map((m) => m.name)))[0] ?? null;
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

/** Nachtisch aus dem Request prüfen und auf die erlaubten Felder beschränken */
function parseDessert(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const name = String(d.name ?? "").trim().slice(0, 200);
  const ingredients = (Array.isArray(d.ingredients) ? d.ingredients : [])
    .map((i) => String(i).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 40);
  const imageUrl = typeof d.imageUrl === "string" && /^https:\/\/www\.themealdb\.com\//.test(d.imageUrl) ? d.imageUrl : null;
  const yieldText = String(d.yield ?? "").trim().slice(0, 100);
  const instructions = String(d.instructions ?? "").trim().slice(0, 5000);
  const durationMin = Number(d.durationMin) > 0 ? Math.round(Number(d.durationMin)) : null;
  if (!name || !ingredients.length) return null;
  return { name, ingredients, instructions, durationMin, imageUrl, yield: yieldText };
}

/** Alle Gerichte, die geplant werden können (ohne ausgeblendete und solche, die nicht zum Profil passen) */
async function recipeCatalog(sql: Sql, profileId: string) {
  const [{ pool, favorites }, ctx, images, dbRecipes] = await Promise.all([
    loadPool(sql, profileId),
    loadContext(sql, profileId),
    sql`SELECT meal_name, image_url, source, credit_name, credit_url FROM meal_images WHERE image_data IS NOT NULL`,
    sql`SELECT name, source FROM recipes`,
  ]);
  const imageBy = new Map(images.map((r) => [r.meal_name as string, r]));
  const hidden = new Set(ctx.rejectedMeals);
  const builtIn = new Set(MEAL_DATABASE.map((m) => m.name));
  const sourceBy = new Map(dbRecipes.map((r) => [r.name as string, r.source as string]));
  const favoriteNames = new Set(favorites.map((f) => f.meal_name as string));
  const recipes = pool
    .filter((r) => !hidden.has(r.name) && !violatesHealthConditions(r, ctx.healthConditions))
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
        origin: builtIn.has(r.name) ? "basis" : sourceBy.get(r.name) === "import" ? "import" : favoriteNames.has(r.name) && !sourceBy.has(r.name) ? "favorit" : "ki",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return { recipes, hidden: [...hidden].sort((a, b) => a.localeCompare(b, "de")) };
}

/** Gericht im Plan gezielt durch ein Rezept aus der Übersicht ersetzen (Nachtisch bleibt am Tag) */
async function replaceWithRecipe(env: Env, sql: Sql, profileId: string, planMealId: string, recipeName: string,
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

async function listRecipeFilters(sql: Sql, profileId: string) {
  return sql`SELECT id, name, scope, keywords, max_minutes AS "maxMinutes" FROM recipe_filters
    WHERE profile_id = ${profileId} ORDER BY created_at`;
}

/** Eigenen Filter prüfen: Name plus Suchbegriffe und/oder maximale Zeit */
function parseRecipeFilter(raw: Record<string, unknown>) {
  const name = String(raw.name ?? "").trim().slice(0, 40);
  const scope = ["gerichte", "nachtische", "beide"].includes(raw.scope as string) ? (raw.scope as string) : "beide";
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .map((k) => String(k).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);
  const maxMinutes = Number(raw.maxMinutes) > 0 ? Math.min(Math.round(Number(raw.maxMinutes)), 1440) : null;
  if (!name || (!keywords.length && !maxMinutes)) return null;
  return { name, scope, keywords, maxMinutes };
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
  const path = new URL(request.url).pathname;

  // Bilder sind öffentlich (ein <img> kann kein Passwort mitschicken)
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
    if (parts[0] === "family" && id && request.method === "PUT") {
      const p = await getProfile(sql);
      const rows = await sql`UPDATE family_members SET name = ${body.name}, type = ${body.type}, age = ${body.age ?? null},
        favorite_foods = ${body.favorite_foods ?? []}, disliked_foods = ${body.disliked_foods ?? []}
        WHERE id = ${id} AND profile_id = ${p.id} RETURNING *`;
      return rows[0] ? json(rows[0]) : json({ error: "Nicht gefunden" }, 404);
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
      const plan = await createPlan(env, sql, p.id, startDate, endDate);
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
                  pm.instructions, pm.rejected, ${IMAGE_URL_SQL} AS image_url, ${IMAGE_CREDIT_SQL}, pm.duration_min, pm.dessert, pm.created_at
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

    // ---------- Rezept-Übersicht ----------
    if (route === "GET /recipes/catalog") {
      const p = await getProfile(sql);
      return json(await recipeCatalog(sql, p.id));
    }
    // Gericht ausblenden (wird nie mehr vorgeschlagen) bzw. wieder einblenden
    if (route === "POST /recipes/hide" || route === "POST /recipes/unhide") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Name fehlt" }, 400);
      if (route === "POST /recipes/hide") {
        await sql`INSERT INTO rejected_meals (profile_id, meal_name, reason)
          SELECT ${p.id}, ${name}, 'ausgeblendet'
          WHERE NOT EXISTS (SELECT 1 FROM rejected_meals WHERE profile_id = ${p.id} AND meal_name = ${name})`;
      } else {
        await sql`DELETE FROM rejected_meals WHERE profile_id = ${p.id} AND meal_name = ${name}`;
      }
      return json(await recipeCatalog(sql, p.id));
    }
    // Gericht im Plan durch ein bestimmtes Rezept ersetzen
    if (parts[0] === "plan-meals" && id && parts[2] === "replace" && request.method === "POST") {
      const p = await getProfile(sql);
      const replacement = await replaceWithRecipe(env, sql, p.id, id, String(body.name ?? ""), waitUntil);
      if (!replacement) return json({ error: "Gericht oder Rezept nicht gefunden" }, 404);
      return json({ replacement });
    }

    // Nachtisch an ein Gericht hängen (oder mit dessert: null entfernen)
    if (parts[0] === "plan-meals" && id && parts[2] === "dessert" && request.method === "PUT") {
      const p = await getProfile(sql);
      const owner = await sql`SELECT pm.id FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
        WHERE pm.id = ${id} AND mp.profile_id = ${p.id}`;
      if (!owner[0]) return json({ error: "Gericht nicht gefunden" }, 404);
      const dessert = parseDessert(body.dessert);
      if (body.dessert && !dessert) return json({ error: "Ungültiger Nachtisch" }, 400);
      await sql`UPDATE plan_meals SET dessert = ${dessert ? JSON.stringify(dessert) : null}::jsonb WHERE id = ${id}`;
      return json({ dessert });
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
      const plan = await createPlan(env, sql, p.id, rows[0].start_date, rows[0].end_date);
      waitUntil(fillMissingImages(env, sql, 7, plan.id));
      return json(plan);
    }

    // ---------- Eigene Rezepte (Import per Link) ----------
    if (route === "POST /recipes/import") {
      try {
        return json({ recipe: await importRecipeFromUrl(String(body.url ?? "")) });
      } catch (e) {
        if (e instanceof ImportError) return json({ error: e.message }, 422);
        throw e;
      }
    }
    if (route === "POST /recipes") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      const type = ["vegetarisch", "fleisch", "wochenende"].includes(body.type) ? body.type : "vegetarisch";
      const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : []).map((i: unknown) => String(i).trim()).filter(Boolean);
      const instructions = String(body.instructions ?? "").trim();
      const duration = Number(body.durationMin) > 0 ? Math.round(Number(body.durationMin)) : null;
      if (!name || ingredients.length === 0) return json({ error: "Name und Zutaten fehlen" }, 400);
      await sql`INSERT INTO recipes (name, type, ingredients, instructions, duration_min, source, source_url)
        VALUES (${name}, ${type}, ${ingredients}, ${instructions}, ${duration}, 'import', ${body.sourceUrl || null})
        ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, ingredients = EXCLUDED.ingredients,
          instructions = EXCLUDED.instructions, duration_min = EXCLUDED.duration_min,
          source = 'import', source_url = EXCLUDED.source_url`;
      // Als Favorit: wird bei der Planung bevorzugt (ohne Turnus)
      if (body.favorite) {
        await sql`INSERT INTO favorites (profile_id, meal_name, meal_type, ingredients, instructions, duration_min)
          VALUES (${p.id}, ${name}, ${type}, ${ingredients}, ${instructions}, ${duration})
          ON CONFLICT (profile_id, meal_name) DO UPDATE SET meal_type = EXCLUDED.meal_type,
            ingredients = EXCLUDED.ingredients, instructions = EXCLUDED.instructions, duration_min = EXCLUDED.duration_min`;
      }
      return json({ ok: true, favorites: await loadFavorites(sql, p.id) });
    }
    if (route === "GET /recipes") {
      return json(await sql`SELECT id, name, type, duration_min, source, source_url, created_at::text AS created_at
        FROM recipes WHERE source = 'import' ORDER BY created_at DESC`);
    }
    if (parts[0] === "recipes" && id && request.method === "DELETE") {
      await sql`DELETE FROM recipes WHERE id = ${id} AND source = 'import'`;
      return json({ ok: true });
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

      const qs = new URL(request.url).searchParams;
      const range = qs.get("from") && qs.get("to") ? { from: qs.get("from")!, to: qs.get("to")! } : undefined;
      if (request.method === "GET" && !itemId) return json(await getShopping(sql, p.id, id, range));

      // Eigenen Artikel / Basic hinzufügen (oder mehrere auf einmal, z. B. Zutaten eines Nachtischs)
      if (request.method === "POST" && !itemId) {
        const names = (Array.isArray(body.names) ? body.names : [body.name])
          .map((n: unknown) => String(n ?? "").trim())
          .filter(Boolean)
          .slice(0, 50);
        if (!names.length) return json({ error: "Name fehlt" }, 400);
        await sql`INSERT INTO shopping_extras (plan_id, name, label, is_basic)
          SELECT ${id}, n, ${body.label || "knuspr"}, ${!!body.isBasic} FROM unnest(${names}::text[]) AS n`;
        return json(await getShopping(sql, p.id, id, range));
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

    // Produkt eines Shops pro Zutat merken (gilt für alle Pläne)
    if (route === "PUT /product-links") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      if (!name || !body.provider || !body.productId) return json({ error: "Angaben fehlen" }, 400);
      await sql`INSERT INTO product_links (profile_id, name_key, provider, product_id, product_name, image_url)
        VALUES (${p.id}, ${prefKey(name)}, ${body.provider}, ${String(body.productId)}, ${body.productName ?? null}, ${body.imageUrl ?? null})
        ON CONFLICT (profile_id, name_key, provider) DO UPDATE SET product_id = EXCLUDED.product_id,
          product_name = EXCLUDED.product_name, image_url = EXCLUDED.image_url, updated_at = now()`;
      return json({ ok: true });
    }

    // Verknüpfung wieder lösen (Zutat hat dann kein festes Produkt mehr)
    if (route === "DELETE /product-links") {
      const p = await getProfile(sql);
      const name = String(new URL(request.url).searchParams.get("name") ?? "").trim();
      const provider = String(new URL(request.url).searchParams.get("provider") ?? "");
      if (!name || !provider) return json({ error: "Angaben fehlen" }, 400);
      await sql`DELETE FROM product_links WHERE profile_id = ${p.id} AND name_key = ${prefKey(name)} AND provider = ${provider}`;
      return json({ ok: true });
    }

    // ---------- Shops (Einstellungen, Verbinden, Suche, Warenkorb) ----------
    if (parts[0] === "shops") {
      const p = await getProfile(sql);
      const provider = parts[1];
      const action = parts[2];

      if (request.method === "GET" && !provider) return json(await getShopState(sql, p.id));

      if (provider === "settings" && request.method === "PUT") {
        await sql`UPDATE profiles SET standard_label = ${body.standardLabel ?? null},
          metzger_auto = ${body.metzgerAuto !== false} WHERE id = ${p.id}`;
        return json(await getShopState(sql, p.id));
      }

      if (!provider || !SHOP_LABELS[provider]) return json({ error: "Unbekannter Shop" }, 404);

      // Amazon braucht kein Konto – nur die Liste ein-/ausschalten
      if (provider === "amazon" && action === "enable" && request.method === "POST") {
        await enableShopLabel(sql, p.id, "amazon");
        return json(await getShopState(sql, p.id));
      }

      if (action === "connect" && request.method === "POST") {
        const email = String(body.email ?? "").trim();
        const password = String(body.password ?? "");
        if (!email || !password) return json({ error: "E-Mail und Passwort angeben" }, 400);
        if (provider === "knuspr") {
          await knusprLogin(email, password); // prüft die Zugangsdaten
          await saveConnection(env, sql, p.id, "knuspr", email, password, null);
        } else if (provider === "picnic") {
          const login = await picnicLogin(email, password);
          if (login.needs2fa) {
            // Noch nichts speichern – erst nach dem SMS-Code
            return json({ needs2fa: true, tempAuthKey: login.authKey, deviceId: login.deviceId });
          }
          await saveConnection(env, sql, p.id, "picnic", email, login.authKey, login.deviceId);
        } else {
          return json({ error: "Dieser Shop braucht kein Konto" }, 400);
        }
        await enableShopLabel(sql, p.id, provider);
        return json(await getShopState(sql, p.id));
      }

      if (provider === "picnic" && action === "verify" && request.method === "POST") {
        const authKey = await picnicVerify(String(body.tempAuthKey), String(body.deviceId), String(body.code ?? ""));
        await saveConnection(env, sql, p.id, "picnic", String(body.email ?? ""), authKey, String(body.deviceId));
        await enableShopLabel(sql, p.id, "picnic");
        return json(await getShopState(sql, p.id));
      }

      // Shop trennen bzw. deaktivieren (Liste weg, Artikel fallen auf die Standard-Liste zurück)
      if (request.method === "DELETE" && !action) {
        await sql`DELETE FROM shop_connections WHERE profile_id = ${p.id} AND provider = ${provider}`;
        if (provider !== "knuspr") await sql`DELETE FROM shopping_labels WHERE profile_id = ${p.id} AND id = ${provider}`;
        return json(await getShopState(sql, p.id));
      }

      if (action === "search" && request.method === "POST") {
        const query = String(body.query ?? "").trim();
        if (!query) return json({ results: [] });
        const conn = await loadConnection(env, sql, p.id, provider);
        if (!conn) return json({ error: "not_connected" }, 409);
        const results =
          provider === "knuspr"
            ? await knusprSearch(await knusprLogin(conn.email, conn.secret), query)
            : await picnicSearch(conn.secret, conn.deviceId ?? "", query);
        return json({ results });
      }

      // Was liegt schon im Knuspr-Warenkorb?
      if (provider === "knuspr" && action === "cart" && request.method === "GET") {
        const conn = await loadConnection(env, sql, p.id, "knuspr");
        if (!conn) return json({ error: "not_connected" }, 409);
        return json({ items: await knusprGetCart(await knusprLogin(conn.email, conn.secret)) });
      }

      // Alle offenen, verknüpften Artikel einer Liste in den Knuspr-Warenkorb legen
      if (provider === "knuspr" && action === "cart" && request.method === "POST") {
        const conn = await loadConnection(env, sql, p.id, "knuspr");
        if (!conn) return json({ error: "not_connected" }, 409);
        // { items: [{ productId, quantity }] } oder (älter) { productIds: [...] }
        const wanted: { productId: string; quantity: number }[] = Array.isArray(body.items)
          ? body.items.map((i: any) => ({ productId: String(i.productId), quantity: Math.min(Math.max(Math.round(Number(i.quantity) || 1), 1), 50) }))
          : (Array.isArray(body.productIds) ? body.productIds : []).map((pid: unknown) => ({ productId: String(pid), quantity: 1 }));
        const cookie = await knusprLogin(conn.email, conn.secret);
        let added = 0;
        const failed: string[] = [];
        for (const w of wanted) (await knusprAddToCart(cookie, w.productId, w.quantity)) ? added++ : failed.push(w.productId);
        return json({ added, failed });
      }

      // Menge im Knuspr-Warenkorb ändern (0 = entfernen)
      if (provider === "knuspr" && action === "cart" && request.method === "PATCH") {
        const conn = await loadConnection(env, sql, p.id, "knuspr");
        if (!conn) return json({ error: "not_connected" }, 409);
        const cookie = await knusprLogin(conn.email, conn.secret);
        const item = (await knusprGetCart(cookie)).find((c) => c.productId === String(body.productId));
        if (!item) return json({ error: "Artikel liegt nicht (mehr) im Warenkorb" }, 404);
        await knusprSetQuantity(cookie, item, Math.min(Math.max(Math.round(Number(body.quantity) || 0), 0), 50));
        return json({ items: await knusprGetCart(cookie) });
      }

      // Knuspr-Warenkorb leeren
      if (provider === "knuspr" && action === "cart" && request.method === "DELETE") {
        const conn = await loadConnection(env, sql, p.id, "knuspr");
        if (!conn) return json({ error: "not_connected" }, 409);
        const cookie = await knusprLogin(conn.email, conn.secret);
        const items = await knusprGetCart(cookie);
        let failed = 0;
        for (const item of items) {
          if (!item.orderFieldId || !(await knusprRemoveFromCart(cookie, item.orderFieldId))) failed++;
        }
        const rest = await knusprGetCart(cookie);
        if (failed && rest.length) return json({ error: `${rest.length} Artikel konnten nicht entfernt werden.`, items: rest }, 502);
        return json({ items: rest });
      }

      return json({ error: "Unbekannte Shop-Aktion" }, 404);
    }

    // ---------- Eigener Vorrat (Zutaten, die nie auf die Liste sollen) ----------
    if (route === "POST /pantry") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").replace(/\(.*?\)/g, "").trim();
      if (!name) return json({ error: "Name fehlt" }, 400);
      await sql`INSERT INTO pantry_items (profile_id, name_key, name) VALUES (${p.id}, ${mergeKey(name)}, ${name})
        ON CONFLICT DO NOTHING`;
      return json({ ok: true });
    }
    if (parts[0] === "pantry" && id && request.method === "DELETE") {
      const p = await getProfile(sql);
      await sql`DELETE FROM pantry_items WHERE profile_id = ${p.id} AND name_key = ${mergeKey(decodeURIComponent(id))}`;
      return json({ ok: true });
    }

    // ---------- Eigene Rezept-Filter ----------
    if (route === "GET /recipe-filters") {
      const p = await getProfile(sql);
      return json(await listRecipeFilters(sql, p.id));
    }
    if (route === "POST /recipe-filters" || (parts[0] === "recipe-filters" && id && request.method === "PUT")) {
      const p = await getProfile(sql);
      const f = parseRecipeFilter(body);
      if (!f) return json({ error: "Name und Suchbegriffe oder Zeit angeben" }, 400);
      if (request.method === "POST") {
        await sql`INSERT INTO recipe_filters (profile_id, name, scope, keywords, max_minutes)
          VALUES (${p.id}, ${f.name}, ${f.scope}, ${f.keywords}, ${f.maxMinutes})`;
      } else {
        await sql`UPDATE recipe_filters SET name = ${f.name}, scope = ${f.scope}, keywords = ${f.keywords}, max_minutes = ${f.maxMinutes}
          WHERE id = ${id} AND profile_id = ${p.id}`;
      }
      return json(await listRecipeFilters(sql, p.id));
    }
    if (parts[0] === "recipe-filters" && id && request.method === "DELETE") {
      const p = await getProfile(sql);
      await sql`DELETE FROM recipe_filters WHERE id = ${id} AND profile_id = ${p.id}`;
      return json(await listRecipeFilters(sql, p.id));
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
    if (parts[0] === "labels" && id && request.method === "PUT") {
      const p = await getProfile(sql);
      const name = String(body.name ?? "").trim();
      if (!name) return json({ error: "Name fehlt" }, 400);
      // Shop- und Standard-Listen behalten ihren Namen
      await sql`UPDATE shopping_labels SET name = ${name}, color = ${body.color || "#3b82f6"}
        WHERE profile_id = ${p.id} AND id = ${id} AND provider IS NULL AND id <> 'metzger'`;
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
      const res = await generateImage(env, sql, name);
      if ("error" in res) return json({ error: res.error, quota: !!res.quota }, res.quota ? 429 : 502);
      const credit = await sql`SELECT source, credit_name, credit_url FROM meal_images WHERE meal_name = ${name}`;
      return json({ imageUrl: res.url, source: res.source, creditName: credit[0]?.credit_name, creditUrl: credit[0]?.credit_url });
    }

    return json({ error: `Unbekannte Route: ${route}` }, 404);
  } catch (err) {
    if (err instanceof ShopError) {
      return json({ error: err.message, code: err.code }, err.code === "not_connected" ? 409 : 502);
    }
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
    await createPlan(env, sql, r.profile_id, start, end);
    console.log(`Routine "${r.name}" ausgeführt: Plan ${start} bis ${end}`);
  }

  // Fehlende Rezeptbilder nachziehen
  await fillMissingImages(env, sql, 5);
}
