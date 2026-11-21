// Eigene Beilagen und Salate (Chefkoch-Link, KI, selbst geschrieben) und die KI-Vorschau
import type { Ctx } from "../http";
import { json } from "../http";
import { getProfile, loadContext } from "../repo";
import { cleanWish } from "../aiRecipes";
import { generateSide } from "../aiSides";
import type { Sql } from "../db";

/** Eingabe prüfen: Name, Art, Zutaten (null = unbrauchbar) */
export function parseSideInput(raw: Record<string, unknown>) {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  const kind = raw.kind === "salat" ? "salat" : raw.kind === "beilage" ? "beilage" : null;
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .map((i) => String(i).trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 40);
  if (!name || !kind || !ingredients.length) return null;
  const sourceUrl = typeof raw.sourceUrl === "string" && /^https:\/\//.test(raw.sourceUrl) ? raw.sourceUrl.slice(0, 500) : null;
  return {
    name,
    kind,
    ingredients,
    instructions: String(raw.instructions ?? "").trim().slice(0, 20_000),
    durationMin: Number(raw.durationMin) > 0 ? Math.min(Math.round(Number(raw.durationMin)), 10_000) : null,
    sourceUrl,
  };
}

async function listCustomSides(sql: Sql, profileId: string) {
  return sql`SELECT name, kind, ingredients, instructions, COALESCE(duration_min, 0) AS "durationMin", true AS custom
    FROM custom_sides WHERE profile_id = ${profileId} ORDER BY name`;
}

export async function sideRoutes({ request, env, sql, body, route, user }: Ctx): Promise<Response | null> {
  if (route === "GET /sides/custom") {
    const p = await getProfile(sql, user);
    return json(await listCustomSides(sql, p.id));
  }
  if (route === "POST /sides/custom") {
    const p = await getProfile(sql, user);
    const s = parseSideInput(body);
    if (!s) return json({ error: "Name, Art und Zutaten fehlen." }, 400);
    await sql`INSERT INTO custom_sides (profile_id, name, kind, ingredients, instructions, duration_min, source_url)
      VALUES (${p.id}, ${s.name}, ${s.kind}, ${s.ingredients}, ${s.instructions}, ${s.durationMin}, ${s.sourceUrl})
      ON CONFLICT (profile_id, name) DO UPDATE SET kind = EXCLUDED.kind, ingredients = EXCLUDED.ingredients,
        instructions = EXCLUDED.instructions, duration_min = EXCLUDED.duration_min, source_url = EXCLUDED.source_url`;
    return json(await listCustomSides(sql, p.id));
  }
  if (route === "DELETE /sides/custom") {
    const p = await getProfile(sql, user);
    const name = String(new URL(request.url).searchParams.get("name") ?? "").trim();
    if (!name) return json({ error: "Name fehlt." }, 400);
    await sql`DELETE FROM custom_sides WHERE profile_id = ${p.id} AND name = ${name}`;
    return json(await listCustomSides(sql, p.id));
  }
  // KI-Vorschlag: { kind, mealName, wish } – nur Vorschau, gespeichert wird über POST /sides/custom
  if (route === "POST /sides/ai-preview") {
    const kind = body.kind === "salat" ? "salat" : "beilage";
    const p = await getProfile(sql, user);
    const ctx = await loadContext(sql, p.id);
    const result = await generateSide(env, kind, String(body.mealName ?? "").slice(0, 200), cleanWish(body.wish), ctx);
    if ("error" in result) return json({ error: result.error, quota: !!result.quota }, result.quota ? 429 : 422);
    return json({ side: result.side });
  }
  return null;
}
