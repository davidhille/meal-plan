// Wochenplan teilen: Nur-Lese-Link ohne Anmeldung (z. B. für Großeltern oder die Familien-Gruppe)
import type { Ctx } from "../http";
import { json } from "../http";
import { randomToken, sha256 } from "../auth";
import { getProfile } from "../repo";
import { IMAGE_URL_SQL } from "../images";

/** Link anlegen (ersetzt einen früheren) bzw. zurückziehen – nur für die eigene Familie */
export async function shareRoutes({ request, sql, parts, id, user }: Ctx): Promise<Response | null> {
  if (parts[0] !== "plans" || !id || parts[2] !== "share") return null;
  const p = await getProfile(sql, user);
  if (request.method === "POST") {
    const token = randomToken();
    const rows = await sql`UPDATE meal_plans SET share_hash = ${await sha256(token)} WHERE id = ${id} AND profile_id = ${p.id} RETURNING id`;
    if (!rows[0]) return json({ error: "Plan nicht gefunden" }, 404);
    return json({ url: `${new URL(request.url).origin}/?plan=${token}` });
  }
  if (request.method === "DELETE") {
    await sql`UPDATE meal_plans SET share_hash = NULL WHERE id = ${id} AND profile_id = ${p.id}`;
    return json({ ok: true });
  }
  return null;
}

/** Öffentlich: geteilten Plan lesen (ohne Bewertungen, Einkaufsliste oder Familiendaten außer dem Namen) */
export async function publicShareRoutes({ sql, parts, route }: Ctx): Promise<Response | null> {
  if (!route.startsWith("GET /share/") || !parts[1]) return null;
  const token = parts[1];
  if (token.length > 100) return json({ error: "Link ungültig" }, 404);
  const plans = await sql`SELECT mp.id, mp.profile_id, mp.start_date::text AS start_date, mp.end_date::text AS end_date, p.name AS family
    FROM meal_plans mp JOIN profiles p ON p.id = mp.profile_id
    WHERE mp.share_hash = ${await sha256(token)} AND NOT p.disabled`;
  const plan = plans[0];
  if (!plan) return json({ error: "Dieser Link ist nicht mehr gültig." }, 404);
  const meals = await sql.query(
    `SELECT pm.meal_date::text AS date, pm.meal_name AS name, pm.meal_type AS type, pm.duration_min AS "durationMin",
       pm.ingredients, pm.instructions, pm.brotzeit, pm.dessert->>'name' AS dessert, ${IMAGE_URL_SQL} AS "imageUrl"
     FROM plan_meals pm
     LEFT JOIN LATERAL (SELECT * FROM meal_images x WHERE x.meal_name = pm.meal_name
       AND (x.profile_id IS NULL OR x.profile_id = $2) ORDER BY x.profile_id IS NULL LIMIT 1) mi ON true
     WHERE pm.plan_id = $1 AND NOT pm.rejected ORDER BY pm.meal_date`,
    [plan.id, plan.profile_id]
  );
  return json({ family: plan.family ?? null, startDate: plan.start_date, endDate: plan.end_date, meals });
}
