// Rezept-Übersicht, Import, eigene Rezepte, Favoriten, Rezept-Filter, Bilder
import type { Ctx } from "../http";
import { json } from "../http";
import { generateImage, removeImage, storeSourcePhoto } from "../images";
import { importRecipeFromUrl, ImportError } from "../recipeImport";
import { loadChefkochRecipe, searchChefkoch, type ChefkochFilters } from "../chefkoch";
import { violatesHealthConditions } from "../meals";
import { PLAN_MEAL_COLS, getProfile, loadContext, loadFavorites, loadPool } from "../repo";
import { cleanWish, generateWishRecipe } from "../aiRecipes";
import { recipeCatalog } from "../planning";
import { RecipeEditError, parseRecipeInput, resetRecipe, saveRecipeEdit } from "../recipeEdits";
import type { Sql } from "../db";

const DESSERT_CATEGORIES = ["kuchen", "gebaeck", "creme", "pfanne", "obst", "eis"];

/** Eingaben für einen eigenen Nachtisch prüfen (null = Name oder Zutaten fehlen) */
function parseDessertInput(raw: Record<string, unknown>) {
  const name = String(raw.name ?? "").trim().slice(0, 120);
  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .map((i) => String(i).trim())
    .filter(Boolean)
    .slice(0, 60);
  if (!name || ingredients.length === 0) return null;
  return {
    name,
    ingredients,
    category: DESSERT_CATEGORIES.includes(raw.category as string) ? (raw.category as string) : "creme",
    yield: String(raw.yield ?? "").trim().slice(0, 60) || "4 Portionen",
    durationMin: Number(raw.durationMin) > 0 ? Math.min(Math.round(Number(raw.durationMin)), 10_000) : null,
    instructions: String(raw.instructions ?? "").trim().slice(0, 20_000),
    sourceUrl: typeof raw.sourceUrl === "string" && /^https:\/\//.test(raw.sourceUrl) ? raw.sourceUrl : null,
  };
}

async function listCustomDesserts(sql: Sql, profileId: string) {
  return sql`SELECT name, category, yield, COALESCE(duration_min, 0) AS "durationMin", ingredients, instructions,
      source_url AS "sourceUrl", true AS custom
    FROM custom_desserts WHERE profile_id = ${profileId} ORDER BY name`;
}

async function saveCustomDessert(sql: Sql, profileId: string, d: NonNullable<ReturnType<typeof parseDessertInput>>) {
  await sql`INSERT INTO custom_desserts (profile_id, name, category, yield, duration_min, ingredients, instructions, source_url)
    VALUES (${profileId}, ${d.name}, ${d.category}, ${d.yield}, ${d.durationMin}, ${d.ingredients}, ${d.instructions}, ${d.sourceUrl})
    ON CONFLICT (profile_id, name) DO UPDATE SET category = EXCLUDED.category, yield = EXCLUDED.yield,
      duration_min = EXCLUDED.duration_min, ingredients = EXCLUDED.ingredients, instructions = EXCLUDED.instructions,
      source_url = EXCLUDED.source_url`;
  // Falls der Name vorher gelöscht/ausgeblendet war: wieder sichtbar
  await sql`UPDATE profiles SET hidden_desserts = array_remove(hidden_desserts, ${d.name}),
      deleted_desserts = array_remove(deleted_desserts, ${d.name}) WHERE id = ${profileId}`;
}

/**
 * Gericht endgültig löschen: eigene/KI-/importierte Rezepte verschwinden aus der Datenbank, Gerichte der
 * Grundsammlung bleiben dauerhaft ausgeschlossen. In beiden Fällen nicht mehr unter „Ausgeblendet“.
 * Das Bild (meal_images) bleibt – es gehört zum Namen, z. B. wenn das Gericht zum Nachtisch wird.
 */
async function deleteMainDish(sql: Sql, profileId: string, name: string) {
  const removed = await sql`DELETE FROM recipes WHERE profile_id = ${profileId} AND name = ${name} RETURNING replaces`;
  // Bearbeitetes Gericht der Sammlung: auch das Original nicht wieder auftauchen lassen
  const names = [name, ...removed.map((r) => r.replaces as string | null).filter((n): n is string => !!n)];
  for (const n of names) {
    await sql`UPDATE rejected_meals SET reason = 'geloescht' WHERE profile_id = ${profileId} AND meal_name = ${n}`;
    await sql`INSERT INTO rejected_meals (profile_id, meal_name, reason)
      SELECT ${profileId}, ${n}, 'geloescht'
      WHERE NOT EXISTS (SELECT 1 FROM rejected_meals WHERE profile_id = ${profileId} AND meal_name = ${n})`;
  }
  await sql`DELETE FROM favorites WHERE profile_id = ${profileId} AND meal_name = ${name}`;
  await sql`DELETE FROM recipe_category_overrides WHERE profile_id = ${profileId} AND recipe_name = ${name}`;
}

function listCategoryOverrides(sql: Sql, profileId: string) {
  return sql`SELECT recipe_name AS name, category_id AS "categoryId", included FROM recipe_category_overrides
    WHERE profile_id = ${profileId}`;
}

async function listRecipeFilters(sql: Sql, profileId: string) {
  return sql`SELECT id, name, scope, keywords, max_minutes AS "maxMinutes",
      include_names AS "includeNames", exclude_names AS "excludeNames" FROM recipe_filters
    WHERE profile_id = ${profileId} ORDER BY created_at`;
}

/** Eigenen Filter prüfen: Name, optional Suchbegriffe und/oder maximale Zeit (ohne beides: nur von Hand zugeordnete Gerichte) */
function parseRecipeFilter(raw: Record<string, unknown>) {
  const name = String(raw.name ?? "").trim().slice(0, 40);
  const scope = ["gerichte", "nachtische", "beide"].includes(raw.scope as string) ? (raw.scope as string) : "beide";
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .map((k) => String(k).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);
  const maxMinutes = Number(raw.maxMinutes) > 0 ? Math.min(Math.round(Number(raw.maxMinutes)), 1440) : null;
  if (!name) return null;
  return { name, scope, keywords, maxMinutes };
}

export async function recipeRoutes({ request, env, sql, body, parts, route, id, waitUntil, user }: Ctx): Promise<Response | null> {
  // ---------- Rezept-Übersicht ----------
  if (route === "GET /recipes/catalog") {
    const p = await getProfile(sql, user);
    return json(await recipeCatalog(sql, p.id));
  }
  // KI-Rezept nach Wunsch: erst Vorschau (nicht gespeichert) …
  if (route === "POST /recipes/ai-preview") {
    const wish = cleanWish(body.wish);
    if (wish.length < 3) return json({ error: "Bitte kurz beschreiben, was ihr gern hättet." }, 400);
    const type = ["vegetarisch", "fleisch", "wochenende"].includes(body.type) ? body.type : null;
    const p = await getProfile(sql, user);
    const [ctx, { pool }] = await Promise.all([loadContext(sql, p.id), loadPool(sql, p.id)]);
    const result = await generateWishRecipe(env, wish, type, ctx, pool.map((r) => r.name));
    if ("error" in result) return json({ error: result.error, quota: !!result.quota }, result.quota ? 429 : 422);
    return json({ recipe: result.recipe });
  }
  // … dann speichern (als KI-Rezept in der Sammlung, auf Wunsch als Favorit; Bild entsteht im Hintergrund)
  if (route === "POST /recipes/ai-save") {
    const p = await getProfile(sql, user);
    let recipe;
    try {
      recipe = parseRecipeInput(body.recipe ?? {});
    } catch (e) {
      if (e instanceof RecipeEditError) return json({ error: e.message }, e.status);
      throw e;
    }
    const { pool } = await loadPool(sql, p.id);
    if (pool.some((r) => r.name.toLowerCase() === recipe.name.toLowerCase())) {
      return json({ error: `„${recipe.name}“ gibt es schon in der Sammlung.` }, 409);
    }
    await sql`INSERT INTO recipes (profile_id, name, type, ingredients, instructions, duration_min, source)
      VALUES (${p.id}, ${recipe.name}, ${recipe.type}, ${recipe.ingredients}, ${recipe.instructions}, ${recipe.durationMin ?? null}, 'ai')
      ON CONFLICT (profile_id, name) DO NOTHING`;
    if (body.favorite) {
      await sql`INSERT INTO favorites (profile_id, meal_name, meal_type, ingredients, instructions, duration_min)
        VALUES (${p.id}, ${recipe.name}, ${recipe.type}, ${recipe.ingredients}, ${recipe.instructions}, ${recipe.durationMin ?? null})
        ON CONFLICT (profile_id, meal_name) DO NOTHING`;
    }
    waitUntil(generateImage(env, sql, recipe.name));
    return json({ name: recipe.name, catalog: await recipeCatalog(sql, p.id) });
  }

  // Gericht bearbeiten (Name, Art, Zeit, Zutaten, Zubereitung) bzw. auf das Original zurücksetzen
  if (route === "PUT /recipes/edit" || route === "POST /recipes/reset") {
    const p = await getProfile(sql, user);
    try {
      let name: string;
      if (route === "PUT /recipes/edit") {
        const recipe = parseRecipeInput(body);
        await saveRecipeEdit(sql, p.id, String(body.originalName ?? ""), recipe);
        name = recipe.name;
      } else {
        name = await resetRecipe(sql, p.id, String(body.name ?? ""));
      }
      return json({ name, catalog: await recipeCatalog(sql, p.id) });
    } catch (e) {
      if (e instanceof RecipeEditError) return json({ error: e.message }, e.status);
      throw e;
    }
  }
  // Gericht ausblenden (wird nie mehr vorgeschlagen) bzw. wieder einblenden
  if (route === "POST /recipes/hide" || route === "POST /recipes/unhide") {
    const p = await getProfile(sql, user);
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

  if (route === "POST /recipes/delete") {
    const p = await getProfile(sql, user);
    const name = String(body.name ?? "").trim();
    if (!name) return json({ error: "Name fehlt" }, 400);
    await deleteMainDish(sql, p.id, name);
    return json(await recipeCatalog(sql, p.id));
  }

  // ---------- Eigene Nachtische ----------
  if (route === "GET /desserts/custom") {
    const p = await getProfile(sql, user);
    return json(await listCustomDesserts(sql, p.id));
  }
  if (route === "POST /desserts/custom") {
    const p = await getProfile(sql, user);
    const d = parseDessertInput(body);
    if (!d) return json({ error: "Name und Zutaten fehlen" }, 400);
    await saveCustomDessert(sql, p.id, d);
    // Foto der Quelle übernehmen (nur von Chefkoch)
    const photo = String(body.imageUrl ?? "");
    if (/^https:\/\/([a-z0-9-]+\.)*chefkoch(-cdn)?\.de\//i.test(photo)) {
      await storeSourcePhoto(sql, d.name, photo, "Chefkoch", d.sourceUrl ?? "https://www.chefkoch.de/");
    }
    return json(await listCustomDesserts(sql, p.id));
  }
  // Hauptgericht zum Nachtisch machen: als eigener Nachtisch speichern, bei den Hauptgerichten löschen (Bild bleibt)
  if (route === "POST /recipes/to-dessert") {
    const p = await getProfile(sql, user);
    const d = parseDessertInput(body);
    if (!d) return json({ error: "Name und Zutaten fehlen" }, 400);
    const from = String(body.from ?? d.name).trim();
    await saveCustomDessert(sql, p.id, d);
    await deleteMainDish(sql, p.id, from);
    return json({ catalog: await recipeCatalog(sql, p.id), desserts: await listCustomDesserts(sql, p.id) });
  }

  // ---------- Chefkoch-Suche ----------
  if (route === "POST /recipes/chefkoch/search" || route === "POST /recipes/chefkoch/preview") {
    try {
      if (route === "POST /recipes/chefkoch/search") {
        const f = (body.filters ?? {}) as Record<string, unknown>;
        const filters: ChefkochFilters = {
          main: f.main !== false && f.dessert !== true,
          dessert: f.dessert === true,
          vegetarian: f.vegetarian === true,
          vegan: f.vegan === true,
          maxMinutes: Number(f.maxMinutes) > 0 ? Number(f.maxMinutes) : null,
          topRated: f.topRated === true,
          sort: ["relevance", "rating", "new"].includes(f.sort as string) ? (f.sort as ChefkochFilters["sort"]) : "relevance",
        };
        const c = (body.cursor ?? {}) as Record<string, unknown>;
        const cursor = { page: Number(c.page) || 0, index: Number(c.index) || 0 };
        return json(await searchChefkoch(String(body.query ?? "").slice(0, 80), filters, cursor));
      }
      const details = await loadChefkochRecipe(String(body.url ?? ""));
      const p = await getProfile(sql, user);
      const rows = await sql`SELECT health_conditions FROM profiles WHERE id = ${p.id}`;
      const unsuitable = violatesHealthConditions(details.recipe, (rows[0]?.health_conditions as string[]) ?? []);
      return json({ ...details, unsuitable });
    } catch (e) {
      if (e instanceof ImportError) return json({ error: e.message }, 422);
      throw e;
    }
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
    const p = await getProfile(sql, user);
    const name = String(body.name ?? "").trim();
    const type = ["vegetarisch", "fleisch", "wochenende"].includes(body.type) ? body.type : "vegetarisch";
    const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : []).map((i: unknown) => String(i).trim()).filter(Boolean);
    const instructions = String(body.instructions ?? "").trim();
    const duration = Number(body.durationMin) > 0 ? Math.round(Number(body.durationMin)) : null;
    if (!name || ingredients.length === 0) return json({ error: "Name und Zutaten fehlen" }, 400);
    await sql`INSERT INTO recipes (profile_id, name, type, ingredients, instructions, duration_min, source, source_url)
      VALUES (${p.id}, ${name}, ${type}, ${ingredients}, ${instructions}, ${duration}, 'import', ${body.sourceUrl || null})
      ON CONFLICT (profile_id, name) DO UPDATE SET type = EXCLUDED.type, ingredients = EXCLUDED.ingredients,
        instructions = EXCLUDED.instructions, duration_min = EXCLUDED.duration_min,
        source = 'import', source_url = EXCLUDED.source_url`;
    // Als Favorit: wird bei der Planung bevorzugt (ohne Turnus)
    if (body.favorite) {
      await sql`INSERT INTO favorites (profile_id, meal_name, meal_type, ingredients, instructions, duration_min)
        VALUES (${p.id}, ${name}, ${type}, ${ingredients}, ${instructions}, ${duration})
        ON CONFLICT (profile_id, meal_name) DO UPDATE SET meal_type = EXCLUDED.meal_type,
          ingredients = EXCLUDED.ingredients, instructions = EXCLUDED.instructions, duration_min = EXCLUDED.duration_min`;
    }
    // Foto der Quelle übernehmen (nur von Chefkoch, mit Link zum Original)
    const photo = String(body.imageUrl ?? "");
    if (/^https:\/\/([a-z0-9-]+\.)*chefkoch-cdn\.de\//i.test(photo) || /^https:\/\/([a-z0-9-]+\.)*chefkoch\.de\//i.test(photo)) {
      await storeSourcePhoto(sql, name, photo, "Chefkoch", String(body.sourceUrl || "https://www.chefkoch.de/"));
    }
    return json({ ok: true, favorites: await loadFavorites(sql, p.id) });
  }
  if (route === "GET /recipes") {
    const p = await getProfile(sql, user);
    return json(await sql`SELECT id, name, type, duration_min, source, source_url, created_at::text AS created_at
      FROM recipes WHERE profile_id = ${p.id} AND source = 'import' ORDER BY created_at DESC`);
  }
  if (parts[0] === "recipes" && id && request.method === "DELETE") {
    const p = await getProfile(sql, user);
    await sql`DELETE FROM recipes WHERE id = ${id} AND profile_id = ${p.id} AND source = 'import'`;
    return json({ ok: true });
  }

  // ---------- Favoriten ----------
  if (route === "GET /favorites") {
    const p = await getProfile(sql, user);
    return json(await loadFavorites(sql, p.id));
  }
  if (route === "POST /favorites") {
    const p = await getProfile(sql, user);
    const rows = await sql.query(`SELECT ${PLAN_MEAL_COLS} FROM plan_meals WHERE id = $1`, [body.planMealId]);
    const pm = rows[0];
    if (!pm) return json({ error: "Gericht nicht gefunden" }, 404);
    await sql`INSERT INTO favorites (profile_id, meal_name, meal_type, ingredients, instructions, duration_min, last_planned)
      VALUES (${p.id}, ${pm.meal_name}, ${pm.meal_type}, ${pm.ingredients}, ${pm.instructions}, ${pm.duration_min}, ${pm.meal_date}::date)
      ON CONFLICT (profile_id, meal_name) DO NOTHING`;
    return json(await loadFavorites(sql, p.id));
  }
  if (parts[0] === "favorites" && id && request.method === "PATCH") {
    const p = await getProfile(sql, user);
    const weeks = Number(body.turnus_weeks) || null;
    await sql`UPDATE favorites SET turnus_weeks = ${weeks} WHERE id = ${id} AND profile_id = ${p.id}`;
    return json(await loadFavorites(sql, p.id));
  }
  if (parts[0] === "favorites" && id && request.method === "DELETE") {
    const p = await getProfile(sql, user);
    await sql`DELETE FROM favorites WHERE id = ${id} AND profile_id = ${p.id}`;
    return json(await loadFavorites(sql, p.id));
  }

  // ---------- Eigene Rezept-Filter ----------
  if (route === "GET /recipe-filters") {
    const p = await getProfile(sql, user);
    return json(await listRecipeFilters(sql, p.id));
  }
  if (route === "POST /recipe-filters" || (parts[0] === "recipe-filters" && id && request.method === "PUT")) {
    const p = await getProfile(sql, user);
    const f = parseRecipeFilter(body);
    if (!f) return json({ error: "Bitte einen Namen angeben" }, 400);
    if (request.method === "POST") {
      await sql`INSERT INTO recipe_filters (profile_id, name, scope, keywords, max_minutes)
        VALUES (${p.id}, ${f.name}, ${f.scope}, ${f.keywords}, ${f.maxMinutes})`;
    } else {
      await sql`UPDATE recipe_filters SET name = ${f.name}, scope = ${f.scope}, keywords = ${f.keywords}, max_minutes = ${f.maxMinutes}
        WHERE id = ${id} AND profile_id = ${p.id}`;
    }
    return json(await listRecipeFilters(sql, p.id));
  }
  // Gericht einem Filter von Hand zuordnen: include = immer dabei, exclude = nie, auto = nach Suchbegriffen/Zeit
  if (parts[0] === "recipe-filters" && id && parts[2] === "assign" && request.method === "POST") {
    const p = await getProfile(sql, user);
    const name = String(body.name ?? "").trim();
    const state = ["include", "exclude", "auto"].includes(body.state) ? (body.state as string) : null;
    if (!name || !state) return json({ error: "Angaben fehlen" }, 400);
    await sql`UPDATE recipe_filters SET
        include_names = array_remove(include_names, ${name}) || CASE WHEN ${state} = 'include' THEN ARRAY[${name}]::text[] ELSE '{}'::text[] END,
        exclude_names = array_remove(exclude_names, ${name}) || CASE WHEN ${state} = 'exclude' THEN ARRAY[${name}]::text[] ELSE '{}'::text[] END
      WHERE id = ${id} AND profile_id = ${p.id}`;
    return json(await listRecipeFilters(sql, p.id));
  }
  if (parts[0] === "recipe-filters" && id && request.method === "DELETE") {
    const p = await getProfile(sql, user);
    await sql`DELETE FROM recipe_filters WHERE id = ${id} AND profile_id = ${p.id}`;
    return json(await listRecipeFilters(sql, p.id));
  }

  // ---------- Speiseart/Hauptzutat von Hand korrigieren ----------
  if (route === "GET /category-overrides") {
    const p = await getProfile(sql, user);
    return json(await listCategoryOverrides(sql, p.id));
  }
  // include = immer dabei, exclude = nie, auto = wieder der Erkennung überlassen
  if (route === "POST /category-overrides") {
    const p = await getProfile(sql, user);
    const name = String(body.name ?? "").trim().slice(0, 200);
    const categoryId = String(body.categoryId ?? "");
    const state = body.state as string;
    if (!name || !/^[a-z]{2,30}$/.test(categoryId) || !["include", "exclude", "auto"].includes(state)) {
      return json({ error: "Angaben fehlen" }, 400);
    }
    if (state === "auto") {
      await sql`DELETE FROM recipe_category_overrides WHERE profile_id = ${p.id} AND recipe_name = ${name} AND category_id = ${categoryId}`;
    } else {
      await sql`INSERT INTO recipe_category_overrides (profile_id, recipe_name, category_id, included)
        VALUES (${p.id}, ${name}, ${categoryId}, ${state === "include"})
        ON CONFLICT (profile_id, recipe_name, category_id) DO UPDATE SET included = EXCLUDED.included`;
    }
    return json(await listCategoryOverrides(sql, p.id));
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
  // Bild entfernen, weil es nicht passt (kommt nicht wieder; später ggf. KI-Bild)
  if (route === "POST /meal-images/remove") {
    const name = String(body.mealName ?? "").trim();
    if (!name) return json({ error: "mealName fehlt" }, 400);
    await removeImage(sql, name);
    return json({ ok: true });
  }

  return null;
}
