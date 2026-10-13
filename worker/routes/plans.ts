// Pläne und Gerichte im Plan (austauschen, ablehnen, Nachtisch)
import type { Ctx } from "../http";
import { json } from "../http";
import { IMAGE_URL_SQL, IMAGE_CREDIT_SQL, fillMissingImages } from "../images";
import { PLAN_COLS, getProfile, latestPlan } from "../repo";
import { createPlan, replaceMeal, replaceWithRecipe } from "../planning";

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

export async function planRoutes({ request, env, sql, body, parts, route, id, waitUntil }: Ctx): Promise<Response | null> {
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

  return null;
}
