// API der Meal-Plan-App (ersetzt Supabase + Edge Functions). Wird von worker/index.ts für /api/* aufgerufen.
// Secrets (Cloudflare → Worker → Settings → Variables and Secrets):
//   DATABASE_URL  – Neon Connection String (Secret)
//   APP_PASSWORD  – Familien-Passwort für die App (Secret, optional; leer = kein Schutz)

import { neon } from "@neondatabase/serverless";
import { pickMeal, MEAL_DATABASE, scoreMeal, preferredTypeFor, type ScoringContext } from "./meals";

export interface Env {
  DATABASE_URL: string;
  APP_PASSWORD?: string;
}

type Sql = ReturnType<typeof neon>;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// Spaltenlisten mit Datum als Text (YYYY-MM-DD), damit das Frontend Strings bekommt
const PLAN_COLS = `id, profile_id, start_date::text AS start_date, end_date::text AS end_date, status, created_at`;
const PLAN_MEAL_COLS = `id, plan_id, meal_date::text AS meal_date, meal_name, meal_type, ingredients, instructions, rejected, image_url, created_at`;
const ROUTINE_COLS = `id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days, active, last_run_at, created_at`;

let schemaReady: Promise<unknown> | null = null;
/** Kleine Schema-Ergänzungen automatisch nachziehen (idempotent) */
function ensureSchema(sql: Sql) {
  schemaReady ??= sql`ALTER TABLE routines ADD COLUMN IF NOT EXISTS last_run_at timestamptz`.catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

/** Plan für [startDate, endDate] erzeugen und speichern */
async function createPlan(sql: Sql, profileId: string, startDate: string, endDate: string) {
  const ctx = await loadContext(sql, profileId);
  const used = new Set<string>();
  const meals: { date: string; name: string; type: string; ingredients: string[]; instructions: string }[] = [];
  const end = new Date(endDate + "T00:00:00Z");
  for (let d = new Date(startDate + "T00:00:00Z"); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const m = pickMeal(date, ctx, used);
    if (m) meals.push({ date, ...m });
  }

  const planRows = await sql.query(
    `INSERT INTO meal_plans (profile_id, start_date, end_date, status) VALUES ($1, $2, $3, 'active') RETURNING ${PLAN_COLS}`,
    [profileId, startDate, endDate]
  );
  const plan = planRows[0];
  if (meals.length) {
    await sql.query(
      `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions)
       SELECT $1, d::date, n, t, string_to_array(i, E'\\x1f'), ins
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[]) AS x(d, n, t, i, ins)`,
      [
        plan.id,
        meals.map((m) => m.date),
        meals.map((m) => m.name),
        meals.map((m) => m.type),
        meals.map((m) => m.ingredients.join("\x1f")),
        meals.map((m) => m.instructions),
      ]
    );
  }
  return plan;
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

export async function handleApi(request: Request, env: Env): Promise<Response> {
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
      return json(await createPlan(sql, p.id, startDate, endDate));
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
      return json(await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE plan_id = $1 ORDER BY meal_date`, [id]));
    }

    // Gericht ablehnen + automatisch ersetzen
    if (parts[0] === "plan-meals" && id && parts[2] === "reject" && request.method === "POST") {
      const p = await getProfile(sql);
      const rows = await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE id = $1`, [id]);
      const old = rows[0];
      if (!old) return json({ error: "Gericht nicht gefunden" }, 404);

      await sql`UPDATE plan_meals SET rejected = true WHERE id = ${id}`;
      await sql`INSERT INTO rejected_meals (profile_id, meal_name) VALUES (${p.id}, ${old.meal_name})`;

      const ctx = await loadContext(sql, p.id);
      const existing = await sql`SELECT meal_name FROM plan_meals WHERE plan_id = ${old.plan_id}`;
      ctx.existingPlanMeals = existing.map((r) => r.meal_name);

      const preferred = preferredTypeFor(old.meal_date);
      const scored = MEAL_DATABASE.map((meal) => ({ meal, score: scoreMeal(meal, ctx) }))
        .filter((s) => s.score >= 0)
        .sort((a, b) => b.score - a.score);
      const best = (scored.find((s) => s.meal.type === preferred) ?? scored[0])?.meal;
      if (!best) return json({ error: "Kein passender Ersatz gefunden" }, 404);

      const inserted = await sql.query(
        `INSERT INTO plan_meals (plan_id, meal_date, meal_name, meal_type, ingredients, instructions, rejected)
         VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING ${PLAN_MEAL_COLS}`,
        [old.plan_id, old.meal_date, best.name, best.type, best.ingredients, best.instructions]
      );
      return json({ replacement: inserted[0] });
    }

    // ---------- Bild-Cache ----------
    if (route === "GET /meal-images") {
      const name = new URL(request.url).searchParams.get("name") ?? "";
      const rows = await sql`SELECT image_url FROM meal_images WHERE meal_name = ${name}`;
      return json({ imageUrl: rows[0]?.image_url ?? null });
    }
    if (route === "PUT /meal-images") {
      await sql`INSERT INTO meal_images (meal_name, image_url) VALUES (${body.meal_name}, ${body.image_url})
        ON CONFLICT (meal_name) DO UPDATE SET image_url = EXCLUDED.image_url`;
      if (body.plan_meal_id) {
        await sql`UPDATE plan_meals SET image_url = ${body.image_url} WHERE id = ${body.plan_meal_id}`;
      }
      return json({ ok: true });
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

function addDays(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

    const start = addDays(now.date, 1);
    const end = addDays(start, Math.max(1, r.duration_days) - 1);
    await createPlan(sql, r.profile_id, start, end);
    console.log(`Routine "${r.name}" ausgeführt: Plan ${start} bis ${end}`);
  }
}
