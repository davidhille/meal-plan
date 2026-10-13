// Rezept-Übersicht, Import, eigene Rezepte, Favoriten, Rezept-Filter, Bilder
import type { Ctx } from "../http";
import { json } from "../http";
import { generateImage } from "../images";
import { importRecipeFromUrl, ImportError } from "../recipeImport";
import { PLAN_MEAL_COLS, getProfile, loadFavorites } from "../repo";
import { recipeCatalog } from "../planning";
import type { Sql } from "../db";

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

export async function recipeRoutes({ request, env, sql, body, parts, route, id }: Ctx): Promise<Response | null> {
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

  return null;
}
