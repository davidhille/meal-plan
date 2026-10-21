// Gerichte bearbeiten: Name, Art, Zeit, Zutaten, Zubereitung.
// Gespeichert in `recipes`; ein Gericht der Grundsammlung bekommt dort eine Zeile mit `replaces` = Originalname.
// Beim Umbenennen ziehen Bewertung, Ausblenden, Favorit, Filter-Zuordnung, Bild und kommende Plan-Tage mit.
import type { Sql } from "./db";
import { MEAL_DATABASE, type Recipe } from "./meals";
import { imageUrl } from "./images";
import { loadPool } from "./repo";

export class RecipeEditError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const TYPES: Recipe["type"][] = ["vegetarisch", "fleisch", "wochenende"];

/** Eingaben prüfen und bereinigen */
export function parseRecipeInput(raw: Record<string, unknown>): Recipe {
  const name = String(raw.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const type = TYPES.includes(raw.type as Recipe["type"]) ? (raw.type as Recipe["type"]) : null;
  const lines = (v: unknown) =>
    (Array.isArray(v) ? v : String(v ?? "").split("\n"))
      .map((l) => String(l).trim())
      .filter(Boolean);
  const ingredients = lines(raw.ingredients).map((i) => i.slice(0, 200)).slice(0, 60);
  const instructions = lines(raw.instructions).map((s) => s.slice(0, 2000)).slice(0, 40).join("\n");
  const durationMin = Number(raw.durationMin) > 0 ? Math.min(Math.round(Number(raw.durationMin)), 1440) : null;
  if (!name) throw new RecipeEditError("Bitte einen Namen angeben.");
  if (!type) throw new RecipeEditError("Bitte die Art wählen.");
  if (!ingredients.length) throw new RecipeEditError("Bitte mindestens eine Zutat angeben.");
  return { name, type, ingredients, instructions, durationMin };
}

/** Name in allem nachziehen, was am Gerichtnamen hängt */
async function renameReferences(sql: Sql, profileId: string, from: string, to: string) {
  await sql`UPDATE meal_ratings SET meal_name = ${to} WHERE profile_id = ${profileId} AND meal_name = ${from}
    AND NOT EXISTS (SELECT 1 FROM meal_ratings WHERE profile_id = ${profileId} AND meal_name = ${to})`;
  await sql`UPDATE rejected_meals SET meal_name = ${to} WHERE profile_id = ${profileId} AND meal_name = ${from}`;
  await sql`UPDATE recipe_filters SET include_names = array_replace(include_names, ${from}, ${to}),
    exclude_names = array_replace(exclude_names, ${from}, ${to}) WHERE profile_id = ${profileId}`;
  await sql`UPDATE recipe_category_overrides o SET recipe_name = ${to} WHERE profile_id = ${profileId} AND recipe_name = ${from}
    AND NOT EXISTS (SELECT 1 FROM recipe_category_overrides x WHERE x.profile_id = o.profile_id AND x.recipe_name = ${to} AND x.category_id = o.category_id)`;
  // Bild mitnehmen (die Bild-URL enthält den Namen)
  const img = await sql`SELECT extract(epoch FROM updated_at)::bigint AS v FROM meal_images WHERE meal_name = ${from}
    AND NOT EXISTS (SELECT 1 FROM meal_images WHERE meal_name = ${to})`;
  if (img[0]) {
    await sql`UPDATE meal_images SET meal_name = ${to}, image_url = ${imageUrl(to, img[0].v)} WHERE meal_name = ${from}`;
  }
}

/** Favorit und kommende Plan-Tage auf den neuen Stand bringen */
async function propagate(sql: Sql, profileId: string, from: string, r: Recipe) {
  if (from !== r.name) await renameReferences(sql, profileId, from, r.name);
  await sql`UPDATE favorites SET meal_name = ${r.name}, meal_type = ${r.type}, ingredients = ${r.ingredients},
      instructions = ${r.instructions}, duration_min = ${r.durationMin ?? null}
    WHERE profile_id = ${profileId} AND meal_name = ${from}`;
  await sql`UPDATE plan_meals SET meal_name = ${r.name}, meal_type = ${r.type}, ingredients = ${r.ingredients},
      instructions = ${r.instructions}, duration_min = ${r.durationMin ?? null}
    WHERE meal_name = ${from} AND meal_date >= current_date AND NOT rejected
      AND plan_id IN (SELECT id FROM meal_plans WHERE profile_id = ${profileId})`;
}

/** Gericht `originalName` mit den neuen Angaben speichern */
export async function saveRecipeEdit(sql: Sql, profileId: string, originalName: string, input: Recipe) {
  const { pool } = await loadPool(sql, profileId);
  if (!pool.some((r) => r.name === originalName)) throw new RecipeEditError("Gericht nicht gefunden.", 404);
  if (input.name !== originalName && pool.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) {
    throw new RecipeEditError(`Es gibt schon ein Gericht „${input.name}“.`, 409);
  }
  const existing = await sql`SELECT name FROM recipes WHERE profile_id = ${profileId} AND name = ${originalName}`;
  const builtIn = MEAL_DATABASE.some((m) => m.name === originalName);
  if (existing[0]) {
    await sql`UPDATE recipes SET name = ${input.name}, type = ${input.type}, ingredients = ${input.ingredients},
      instructions = ${input.instructions}, duration_min = ${input.durationMin ?? null}
      WHERE profile_id = ${profileId} AND name = ${originalName}`;
  } else {
    await sql`INSERT INTO recipes (profile_id, name, type, ingredients, instructions, duration_min, source, replaces)
      VALUES (${profileId}, ${input.name}, ${input.type}, ${input.ingredients}, ${input.instructions}, ${input.durationMin ?? null},
              'eigen', ${builtIn ? originalName : null})`;
  }
  await propagate(sql, profileId, originalName, input);
}

/** Bearbeitetes Gericht der Grundsammlung auf das Original zurücksetzen; gibt den Originalnamen zurück */
export async function resetRecipe(sql: Sql, profileId: string, name: string): Promise<string> {
  const rows = await sql`SELECT replaces FROM recipes WHERE profile_id = ${profileId} AND name = ${name} AND replaces IS NOT NULL`;
  const original = MEAL_DATABASE.find((m) => m.name === rows[0]?.replaces);
  if (!original) throw new RecipeEditError("Nur bearbeitete Gerichte der Grundsammlung lassen sich zurücksetzen.", 404);
  await sql`DELETE FROM recipes WHERE profile_id = ${profileId} AND name = ${name}`;
  await propagate(sql, profileId, name, original);
  return original.name;
}
