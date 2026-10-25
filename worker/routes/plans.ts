// Pläne und Gerichte im Plan (austauschen, ablehnen, Nachtisch)
import type { Sql } from "../db";
import type { Ctx } from "../http";
import { json } from "../http";
import { IMAGE_URL_SQL, IMAGE_CREDIT_SQL, fillMissingImages } from "../images";
import { PLAN_COLS, getProfile, latestPlan, planOwned } from "../repo";
import { loadDislikeHint } from "../dislikePattern";
import { createPlan, replaceMeal, replaceWithRecipe, setBrotzeit } from "../planning";

/** Nachtisch aus dem Request prüfen und auf die erlaubten Felder beschränken */
function parseDessert(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const name = String(d.name ?? "").trim().slice(0, 200);
  const ingredients = (Array.isArray(d.ingredients) ? d.ingredients : [])
    .map((i) => String(i).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 40);
  const imageUrl = typeof d.imageUrl === "string" && /^(https:\/\/www\.themealdb\.com\/|\/api\/images\/)/.test(d.imageUrl) ? d.imageUrl : null;
  const yieldText = String(d.yield ?? "").trim().slice(0, 100);
  const instructions = String(d.instructions ?? "").trim().slice(0, 5000);
  const durationMin = Number(d.durationMin) > 0 ? Math.round(Number(d.durationMin)) : null;
  if (!name || !ingredients.length) return null;
  return { name, ingredients, instructions, durationMin, imageUrl, yield: yieldText };
}

export async function planRoutes({ request, env, sql, body, parts, route, id, waitUntil, user }: Ctx): Promise<Response | null> {
  // ---------- Pläne ----------
  if (route === "POST /plans") {
    const { startDate, endDate } = body;
    if (!startDate || !endDate) return json({ error: "startDate und endDate fehlen" }, 400);
    const p = await getProfile(sql, user);
    const plan = await createPlan(env, sql, p.id, startDate, endDate);
    waitUntil(fillMissingImages(env, sql, 7, plan.id));
    return json(plan);
  }

  if (parts[0] === "plans" && id && id !== "latest" && !parts[2] && request.method === "DELETE") {
    const p = await getProfile(sql, user);
    await sql`DELETE FROM meal_plans WHERE id = ${id} AND profile_id = ${p.id}`;
    return json({ ok: true, latest: await latestPlan(sql, p.id) });
  }

  // Neuester aktiver Plan (für das Laden nach einem Reload)
  if (route === "GET /plans/latest") {
    const p = await getProfile(sql, user);
    return json(await latestPlan(sql, p.id));
  }

  if (parts[0] === "plans" && id && parts[2] === "meals" && request.method === "GET") {
    const p = await getProfile(sql, user);
    if (!(await planOwned(sql, p.id, id))) return json({ error: "Plan nicht gefunden" }, 404);
    return json(
      await sql.query(
        `SELECT pm.id, pm.plan_id, pm.meal_date::text AS meal_date, pm.meal_name, pm.meal_type, pm.ingredients,
                pm.instructions, pm.rejected, ${IMAGE_URL_SQL} AS image_url, ${IMAGE_CREDIT_SQL}, pm.duration_min, pm.dessert, pm.brotzeit, pm.guests, pm.created_at
         FROM plan_meals pm
         LEFT JOIN LATERAL (SELECT * FROM meal_images x WHERE x.meal_name = pm.meal_name
           AND (x.profile_id IS NULL OR x.profile_id = $2) ORDER BY x.profile_id IS NULL LIMIT 1) mi ON true
         WHERE pm.plan_id = $1 ORDER BY pm.meal_date`,
        [id, p.id]
      )
    );
  }

  // Gericht ablehnen (kommt nicht wieder) bzw. neu generieren (nur austauschen)
  if (parts[0] === "plan-meals" && id && (parts[2] === "reject" || parts[2] === "regenerate") && request.method === "POST") {
    const p = await getProfile(sql, user);
    const replacement = await replaceMeal(env, sql, p.id, id, parts[2] === "reject", waitUntil);
    if (!replacement) return json({ error: "Kein passender Ersatz gefunden" }, 404);
    // Beim Ausblenden: Muster erkannt? Dann bietet die App an, die Hauptzutat ganz wegzulassen
    const dislikeHint = parts[2] === "reject" ? await loadDislikeHint(sql, p.id, id) : null;
    return json({ replacement, dislikeHint });
  }

  // Ablehnen rückgängig: Gericht wieder an seinen Tag, Ersatz weg, nicht mehr ausgeblendet
  if (parts[0] === "plan-meals" && id && parts[2] === "unreject" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const rows = await sql`SELECT pm.id, pm.plan_id, pm.meal_date::text AS meal_date, pm.meal_name FROM plan_meals pm
      JOIN meal_plans mp ON mp.id = pm.plan_id WHERE pm.id = ${id} AND mp.profile_id = ${p.id} AND pm.rejected`;
    const orig = rows[0];
    if (!orig) return json({ error: "Gericht nicht gefunden" }, 404);
    const replacementId = typeof body.replacementId === "string" ? body.replacementId : null;
    if (replacementId) {
      // Nur den Ersatz am selben Tag desselben Plans löschen
      await sql`DELETE FROM plan_meals WHERE id = ${replacementId} AND plan_id = ${orig.plan_id}
        AND meal_date = ${orig.meal_date}::date AND NOT rejected`;
    }
    const busy = await sql`SELECT 1 FROM plan_meals WHERE plan_id = ${orig.plan_id} AND meal_date = ${orig.meal_date}::date AND NOT rejected`;
    if (busy.length) return json({ error: "An diesem Tag steht inzwischen ein anderes Gericht" }, 409);
    await sql`UPDATE plan_meals SET rejected = false WHERE id = ${id}`;
    await sql`DELETE FROM rejected_meals WHERE profile_id = ${p.id} AND meal_name = ${orig.meal_name}`;
    const restored = await sql.query(
      `SELECT pm.id, pm.plan_id, pm.meal_date::text AS meal_date, pm.meal_name, pm.meal_type, pm.ingredients,
              pm.instructions, pm.rejected, ${IMAGE_URL_SQL} AS image_url, ${IMAGE_CREDIT_SQL}, pm.duration_min, pm.dessert, pm.brotzeit, pm.guests, pm.created_at
       FROM plan_meals pm
       LEFT JOIN LATERAL (SELECT * FROM meal_images x WHERE x.meal_name = pm.meal_name
         AND (x.profile_id IS NULL OR x.profile_id = $2) ORDER BY x.profile_id IS NULL LIMIT 1) mi ON true
       WHERE pm.id = $1`,
      [id, p.id]
    );
    return json({ restored: restored[0] });
  }

  // Brotzeit statt Kochen (zurück geht es mit „regenerate“ = doch kochen)
  if (parts[0] === "plan-meals" && id && parts[2] === "brotzeit" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const replacement = await setBrotzeit(sql, p.id, id);
    if (!replacement) return json({ error: "Gericht nicht gefunden" }, 404);
    return json({ replacement });
  }

  // Gericht im Plan durch ein bestimmtes Rezept ersetzen
  if (parts[0] === "plan-meals" && id && parts[2] === "replace" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const replacement = await replaceWithRecipe(env, sql, p.id, id, String(body.name ?? ""), waitUntil);
    if (!replacement) return json({ error: "Gericht oder Rezept nicht gefunden" }, 404);
    return json({ replacement });
  }

  // Gericht auf einen anderen Tag verschieben. Steht dort schon eins, tauschen beide den Tag.
  // Liegt der Tag außerhalb des Plans, wird der Plan bis dahin verlängert (höchstens 8 Wochen nach Planende).
  if (parts[0] === "plan-meals" && id && parts[2] === "move" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return json({ error: "Ungültiges Datum" }, 400);
    const rows = await sql`SELECT pm.id, pm.plan_id, pm.meal_date::text AS meal_date, mp.start_date::text AS start_date,
        mp.end_date::text AS end_date
      FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
      WHERE pm.id = ${id} AND mp.profile_id = ${p.id} AND NOT pm.rejected`;
    const pm = rows[0];
    if (!pm) return json({ error: "Gericht nicht gefunden" }, 404);
    if (date === pm.meal_date) return json({ ok: true, swapped: false });
    const limit = new Date(`${pm.end_date}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + 56);
    if (date > limit.toISOString().slice(0, 10)) return json({ error: "So weit lässt sich nicht verschieben" }, 400);

    const other = await sql`SELECT id FROM plan_meals WHERE plan_id = ${pm.plan_id} AND meal_date = ${date}::date AND NOT rejected`;
    if (other[0]) await sql`UPDATE plan_meals SET meal_date = ${pm.meal_date}::date WHERE id = ${other[0].id}`;
    await sql`UPDATE plan_meals SET meal_date = ${date}::date WHERE id = ${id}`;
    // Der Zieltag ist jetzt belegt; der alte Tag ist frei (wird bei „Hinzufügen“ wieder gefüllt)
    await sql`UPDATE meal_plans SET cleared_dates = array_remove(cleared_dates, ${date}::date) WHERE id = ${pm.plan_id}`;
    // Abgelehnte Einträge am Zieltag stören nicht (bleiben unsichtbar)
    const plans = await sql.query(
      `UPDATE meal_plans SET start_date = LEAST(start_date, $2::date), end_date = GREATEST(end_date, $2::date)
       WHERE id = $1 RETURNING ${PLAN_COLS}`,
      [pm.plan_id, date]
    );
    return json({ ok: true, swapped: !!other[0], plan: plans[0] });
  }

  // Gericht aus dem Plan nehmen (spontan nicht kochen) – der Tag bleibt leer, das Gericht wird nicht abgelehnt
  if (parts[0] === "plan-meals" && id && !parts[2] && request.method === "DELETE") {
    const p = await getProfile(sql, user);
    const removed = await sql`DELETE FROM plan_meals pm USING meal_plans mp
      WHERE pm.id = ${id} AND mp.id = pm.plan_id AND mp.profile_id = ${p.id}
      RETURNING pm.plan_id, pm.meal_date::text AS meal_date`;
    if (!removed[0]) return json({ error: "Gericht nicht gefunden" }, 404);
    // ?keepEmpty=1 („Nicht kochen“): „Hinzufügen“ befüllt den Tag nicht wieder. Sonst ist der Tag nur frei.
    if (new URL(request.url).searchParams.get("keepEmpty") === "1") await markCleared(sql, removed[0].plan_id, removed[0].meal_date);
    return json({ ok: true });
  }

  // Gäste an diesem Tag (zusätzliche Portionen, 0–20 in halben Schritten)
  if (parts[0] === "plan-meals" && id && parts[2] === "guests" && request.method === "PUT") {
    const p = await getProfile(sql, user);
    const guests = Math.max(0, Math.min(20, Math.round(Number(body.guests) * 2) / 2 || 0));
    const rows = await sql`UPDATE plan_meals pm SET guests = ${guests} FROM meal_plans mp
      WHERE pm.id = ${id} AND mp.id = pm.plan_id AND mp.profile_id = ${p.id} RETURNING pm.guests`;
    if (!rows[0]) return json({ error: "Gericht nicht gefunden" }, 404);
    return json({ guests: Number(rows[0].guests) });
  }

  // Nachtisch an ein Gericht hängen (oder mit dessert: null entfernen)
  if (parts[0] === "plan-meals" && id && parts[2] === "dessert" && request.method === "PUT") {
    const p = await getProfile(sql, user);
    const owner = await sql`SELECT pm.id FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
      WHERE pm.id = ${id} AND mp.profile_id = ${p.id}`;
    if (!owner[0]) return json({ error: "Gericht nicht gefunden" }, 404);
    const dessert = parseDessert(body.dessert);
    if (body.dessert && !dessert) return json({ error: "Ungültiger Nachtisch" }, 400);
    await sql`UPDATE plan_meals SET dessert = ${dessert ? JSON.stringify(dessert) : null}::jsonb WHERE id = ${id}`;
    return json({ dessert });
  }

  // Kompletten Plan neu generieren (gleicher Zeitraum, alter Plan wird ersetzt)
  // Plan verlängern: bis zu einem neuen Zeitraum erweitern, geplante und bewusst leere Tage bleiben, nur freie Tage werden befüllt
  if (parts[0] === "plans" && id && parts[2] === "extend" && request.method === "POST") {
    const { startDate, endDate } = body;
    if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) return json({ error: "Ungültiger Zeitraum" }, 400);
    const p = await getProfile(sql, user);
    const rows = await sql`SELECT id FROM meal_plans WHERE id = ${id} AND profile_id = ${p.id}`;
    if (!rows[0]) return json({ error: "Plan nicht gefunden" }, 404);
    // „Heute“ nach Berliner Zeit: ab da werden leere Tage gefüllt, Vergangenes bleibt leer
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
    const plan = await createPlan(env, sql, p.id, startDate, endDate, id, { today, includeCleared: body.includeCleared === true });
    waitUntil(fillMissingImages(env, sql, 7, plan.id));
    return json(plan);
  }

  // Einen leeren Tag (auch bewusst geleert) wieder mit einem Gericht füllen
  if (parts[0] === "plans" && id && parts[2] === "fill-day" && request.method === "POST") {
    const date = body.date;
    if (!isIsoDate(date)) return json({ error: "Ungültiges Datum" }, 400);
    const p = await getProfile(sql, user);
    const rows = await sql`SELECT id FROM meal_plans WHERE id = ${id} AND profile_id = ${p.id}`;
    if (!rows[0]) return json({ error: "Plan nicht gefunden" }, 404);
    await sql`UPDATE meal_plans SET cleared_dates = array_remove(cleared_dates, ${date}::date) WHERE id = ${id}`;
    const plan = await createPlan(env, sql, p.id, date, date, id, { cookOnly: true });
    waitUntil(fillMissingImages(env, sql, 2, plan.id));
    return json(plan);
  }

  if (parts[0] === "plans" && id && parts[2] === "regenerate" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const rows = await sql.query(`SELECT ${PLAN_COLS} FROM meal_plans WHERE id = $1 AND profile_id = $2`, [id, p.id]);
    if (!rows[0]) return json({ error: "Plan nicht gefunden" }, 404);
    // Turnus-Zähler nicht durch den alten Plan blockieren lassen
    await sql`UPDATE favorites SET last_planned = NULL WHERE profile_id = ${p.id}
      AND last_planned BETWEEN ${rows[0].start_date}::date AND ${rows[0].end_date}::date`;
    const shared = await sql`SELECT share_hash FROM meal_plans WHERE id = ${id}`;
    await sql`DELETE FROM meal_plans WHERE id = ${id}`;
    const plan = await createPlan(env, sql, p.id, rows[0].start_date, rows[0].end_date);
    // Geteilter Link gilt auch für den neu generierten Plan
    if (shared[0]?.share_hash) {
      await sql`UPDATE meal_plans SET share_hash = ${shared[0].share_hash} WHERE id = ${plan.id}`;
      plan.shared = true;
    }
    waitUntil(fillMissingImages(env, sql, 7, plan.id));
    return json(plan);
  }

  return null;
}

const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Tag eines Plans als bewusst leer merken (nur wenn dort wirklich nichts mehr steht) */
async function markCleared(sql: Sql, planId: string, date: string) {
  await sql`UPDATE meal_plans SET cleared_dates = array_append(array_remove(cleared_dates, ${date}::date), ${date}::date)
    WHERE id = ${planId}
      AND NOT EXISTS (SELECT 1 FROM plan_meals WHERE plan_id = ${planId} AND meal_date = ${date}::date AND NOT rejected)`;
}
