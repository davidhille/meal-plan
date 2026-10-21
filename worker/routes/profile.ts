// Profil, Familie, Bewertungen, Routinen
import type { Ctx } from "../http";
import { json } from "../http";
import { ROUTINE_COLS, getProfile } from "../repo";
import { FOCUS_IDS } from "../nutrition";
import { parseDayRules } from "../dayRules";

/** Erlaubte Einschränkungen (harte Ausschlüsse, siehe violatesHealthConditions) */
const CONDITION_IDS = ["diabetes", "gluten_free", "lactose_intolerant", "nut_allergy", "vegetarian", "vegan", "no_alcohol"];

const onlyKnown = (raw: unknown, allowed: readonly string[]) =>
  [...new Set((Array.isArray(raw) ? raw : []).map(String))].filter((x) => allowed.includes(x));


export async function profileRoutes({ request, sql, body, parts, route, id, user }: Ctx): Promise<Response | null> {
  // ---------- Profil ----------
  if (route === "GET /profile") return json(await getProfile(sql, user));

  if (route === "PUT /profile") {
    const p = await getProfile(sql, user);
    const focus = onlyKnown(body.health_focus, FOCUS_IDS);
    const conditions = onlyKnown(body.health_conditions, CONDITION_IDS);
    const meatMax = body.meat_max_per_week == null || body.meat_max_per_week === "" ? NaN : Number(body.meat_max_per_week);
    const meatLimit = Number.isInteger(meatMax) && meatMax >= 0 && meatMax <= 7 ? meatMax : null;
    const rows = await sql`UPDATE profiles
      SET health_focus = ${focus}, health_conditions = ${conditions}, meat_max_per_week = ${meatLimit}, updated_at = now()
      WHERE id = ${p.id} RETURNING *`;
    return json(rows[0]);
  }

  // Regeln pro Wochentag: { "3": { "maxMinutes": 20 }, "0": { "off": true } }
  if (route === "PUT /profile/day-rules") {
    const p = await getProfile(sql, user);
    const rules = parseDayRules(body.day_rules);
    // Brotzeit pro Woche (0–7); fehlt der Wert, bleibt der bisherige
    const perWeek = body.brotzeit_per_week === undefined ? null : Math.max(0, Math.min(7, Math.round(Number(body.brotzeit_per_week)) || 0));
    const rows = await sql`UPDATE profiles SET day_rules = ${JSON.stringify(rules)}::jsonb,
        brotzeit_per_week = COALESCE(${perWeek}::int, brotzeit_per_week), updated_at = now()
      WHERE id = ${p.id} RETURNING *`;
    return json(rows[0]);
  }

  // Nachtisch aus der Sammlung aus- bzw. wieder einblenden: { name, hidden }
  if (route === "PUT /profile/hidden-desserts") {
    const p = await getProfile(sql, user);
    const name = String(body.name ?? "").trim().slice(0, 200);
    if (!name) return json({ error: "Name fehlt" }, 400);
    // deleted: endgültig – raus aus „Ausgeblendet“, bleibt aber unsichtbar; eigene Nachtische verschwinden ganz
    if (body.deleted) await sql`DELETE FROM custom_desserts WHERE profile_id = ${p.id} AND name = ${name}`;
    const rows = body.deleted
      ? await sql`UPDATE profiles SET hidden_desserts = array_remove(hidden_desserts, ${name}),
            deleted_desserts = array_append(array_remove(deleted_desserts, ${name}), ${name})
          WHERE id = ${p.id} RETURNING hidden_desserts, deleted_desserts`
      : body.hidden
        ? await sql`UPDATE profiles SET hidden_desserts = array_append(array_remove(hidden_desserts, ${name}), ${name})
            WHERE id = ${p.id} RETURNING hidden_desserts, deleted_desserts`
        : await sql`UPDATE profiles SET hidden_desserts = array_remove(hidden_desserts, ${name})
            WHERE id = ${p.id} RETURNING hidden_desserts, deleted_desserts`;
    return json({ hiddenDesserts: rows[0]?.hidden_desserts ?? [], deletedDesserts: rows[0]?.deleted_desserts ?? [] });
  }

  // ---------- Familie ----------
  if (route === "GET /family") {
    const p = await getProfile(sql, user);
    return json(await sql`SELECT * FROM family_members WHERE profile_id = ${p.id} ORDER BY created_at`);
  }
  if (route === "POST /family") {
    const p = await getProfile(sql, user);
    const rows = await sql`INSERT INTO family_members (profile_id, name, type, age, favorite_foods, disliked_foods)
      VALUES (${p.id}, ${body.name}, ${body.type}, ${body.age ?? null}, ${body.favorite_foods ?? []}, ${body.disliked_foods ?? []})
      RETURNING *`;
    return json(rows[0]);
  }
  if (parts[0] === "family" && id && request.method === "PUT") {
    const p = await getProfile(sql, user);
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
    const p = await getProfile(sql, user);
    const rows = await sql`SELECT meal_name, rating FROM meal_ratings WHERE profile_id = ${p.id}`;
    return json(Object.fromEntries(rows.map((r) => [r.meal_name, r.rating])));
  }
  // Kommentare zu Bewertungen: { Gericht: { notes, updatedAt } } (nur Gerichte mit Kommentar)
  if (route === "GET /ratings/notes") {
    const p = await getProfile(sql, user);
    const rows = await sql`SELECT meal_name, notes, COALESCE(updated_at, created_at)::text AS updated_at FROM meal_ratings
      WHERE profile_id = ${p.id} AND notes IS NOT NULL AND notes <> ''`;
    return json(Object.fromEntries(rows.map((r) => [r.meal_name, { notes: r.notes, updatedAt: r.updated_at }])));
  }
  if (route === "PUT /ratings") {
    const p = await getProfile(sql, user);
    const notes = String(body.notes ?? "").trim().slice(0, 500) || null;
    const rows = await sql`INSERT INTO meal_ratings (profile_id, meal_name, rating, notes, updated_at)
      VALUES (${p.id}, ${body.meal_name}, ${body.rating}, ${notes}, now())
      ON CONFLICT (profile_id, meal_name) DO UPDATE SET rating = EXCLUDED.rating, notes = EXCLUDED.notes, updated_at = now()
      RETURNING *`;
    return json(rows[0]);
  }

  // ---------- Routinen ----------
  if (route === "GET /routines") {
    const p = await getProfile(sql, user);
    return json(await sql.query(`SELECT ${ROUTINE_COLS} FROM routines WHERE profile_id = $1 ORDER BY created_at`, [p.id]));
  }
  if (route === "POST /routines") {
    const p = await getProfile(sql, user);
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

  return null;
}
