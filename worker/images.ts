// Rezeptbilder: Erzeugung mit Cloudflare Workers AI (FLUX.1 schnell), Speicherung in Neon.
import type { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

export interface AiEnv {
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
}

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Öffentliche Bild-URL (mit Version, damit neue Bilder nicht aus dem Cache kommen) */
export function imageUrl(mealName: string, version: string | number) {
  return `/api/images/${encodeURIComponent(mealName)}?v=${version}`;
}

/** SQL-Ausdruck (Alias mi = meal_images): URL nur, wenn ein Bild gespeichert ist */
export const IMAGE_URL_SQL = `CASE WHEN mi.image_data IS NOT NULL THEN mi.image_url END`;

/** Hauptzutaten ohne Mengenangaben, damit das Bild zum Rezept passt */
function mainIngredients(ingredients: string[]): string {
  return ingredients
    .map((i) =>
      i
        .replace(/^[\d.,/½¼¾]+\s*(kg|g|ml|l|el|tl|dosen?|gläser|glas|bund|pck\.?|stück|prisen?|zehen?|scheiben)?\.?\s*/i, "")
        .replace(/\(.*?\)/g, "")
        .trim()
    )
    .filter((i) => i && !/^(salz|pfeffer|öl|olivenöl|wasser)\b/i.test(i))
    .slice(0, 6)
    .join(", ");
}

function prompt(mealName: string, type?: string, ingredients?: string[]) {
  const veg = type === "vegetarisch" ? "a vegetarian dish with no meat, no chicken and no fish, " : "";
  const main = ingredients?.length ? `main ingredients: ${mainIngredients(ingredients)}, ` : "";
  return (
    `Professional food photography of "${mealName}", ${veg}a German home-cooked family dish, ${main}` +
    `served on a white ceramic plate on a rustic wooden table, natural warm daylight, ` +
    `top-down angle, appetizing, realistic, high detail, no text, no people`
  );
}

/** Bild erzeugen und speichern. Gibt die URL zurück oder null bei Fehler (z. B. Tageskontingent aufgebraucht). */
export async function generateImage(env: AiEnv, sql: Sql, mealName: string): Promise<string | null> {
  if (!env.AI) {
    console.error("Workers AI nicht verfügbar (Binding AI fehlt)");
    return null;
  }
  try {
    // Typ und Zutaten nachschlagen, damit z. B. vegetarische Gerichte kein Fleisch im Bild bekommen
    const info = await sql`SELECT meal_type, ingredients FROM plan_meals WHERE meal_name = ${mealName}
      ORDER BY created_at DESC LIMIT 1`;
    const result = (await env.AI.run(MODEL, {
      prompt: prompt(mealName, info[0]?.meal_type, info[0]?.ingredients),
      steps: 6,
    })) as { image?: string };
    if (!result?.image) return null;
    const rows = await sql`
      INSERT INTO meal_images (meal_name, image_url, image_data, content_type, updated_at)
      VALUES (${mealName}, '', decode(${result.image}, 'base64'), 'image/jpeg', now())
      ON CONFLICT (meal_name) DO UPDATE SET
        image_data = EXCLUDED.image_data, content_type = EXCLUDED.content_type, updated_at = now()
      RETURNING extract(epoch FROM updated_at)::bigint AS v`;
    const url = imageUrl(mealName, rows[0].v);
    await sql`UPDATE meal_images SET image_url = ${url} WHERE meal_name = ${mealName}`;
    return url;
  } catch (err) {
    console.error(`Bild für "${mealName}" fehlgeschlagen:`, err);
    return null;
  }
}

/** Fehlende Bilder für Gerichte in Plänen erzeugen (höchstens `limit` pro Aufruf) */
export async function fillMissingImages(env: AiEnv, sql: Sql, limit = 5, planId?: string) {
  const rows = planId
    ? await sql`SELECT DISTINCT pm.meal_name FROM plan_meals pm
        LEFT JOIN meal_images mi ON mi.meal_name = pm.meal_name
        WHERE pm.plan_id = ${planId} AND NOT pm.rejected AND mi.image_data IS NULL LIMIT ${limit}`
    : await sql`SELECT DISTINCT pm.meal_name FROM plan_meals pm
        JOIN meal_plans mp ON mp.id = pm.plan_id AND mp.status = 'active'
        LEFT JOIN meal_images mi ON mi.meal_name = pm.meal_name
        WHERE NOT pm.rejected AND mi.image_data IS NULL LIMIT ${limit}`;
  for (const r of rows) {
    const ok = await generateImage(env, sql, r.meal_name);
    if (!ok) break; // z. B. Kontingent erschöpft → beim nächsten Lauf weiter
  }
}

/** Bild ausliefern (ohne Passwort, damit <img> es laden kann) */
export async function serveImage(sql: Sql, mealName: string): Promise<Response> {
  const rows = await sql`SELECT encode(image_data, 'base64') AS data, content_type FROM meal_images
    WHERE meal_name = ${mealName} AND image_data IS NOT NULL`;
  if (!rows[0]) return new Response("Nicht gefunden", { status: 404 });
  const bin = atob(rows[0].data as string);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "Content-Type": rows[0].content_type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
