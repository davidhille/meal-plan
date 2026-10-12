// Rezeptbilder: zuerst Cloudflare Workers AI (FLUX.1 schnell); ist das Tageskontingent aufgebraucht
// oder klappt die KI nicht, ein passendes Foto von Pexels (kostenlose API). Speicherung in Neon.
import type { neon } from "@neondatabase/serverless";
import { MEAL_DATABASE, dishKeywords } from "./meals";

type Sql = ReturnType<typeof neon>;

export interface AiEnv {
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  /** Schlüssel für die Pexels-API (Ersatzfotos, wenn die KI nicht kann) */
  PEXELS_API_KEY?: string;
}

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Öffentliche Bild-URL (mit Version, damit neue Bilder nicht aus dem Cache kommen) */
export function imageUrl(mealName: string, version: string | number) {
  return `/api/images/${encodeURIComponent(mealName)}?v=${version}`;
}

/** SQL-Ausdruck (Alias mi = meal_images): URL nur, wenn ein Bild gespeichert ist */
export const IMAGE_URL_SQL = `CASE WHEN mi.image_data IS NOT NULL THEN mi.image_url END`;
/** Dazu Herkunft und Fotograf (bei Pexels-Fotos als Quellenangabe angezeigt) */
export const IMAGE_CREDIT_SQL = `CASE WHEN mi.image_data IS NOT NULL THEN mi.source END AS image_source,
  mi.credit_name AS image_credit_name, mi.credit_url AS image_credit_url`;

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
    .slice(0, 8)
    .join(", ");
}

// Kleines, günstiges Sprachmodell: übersetzt das deutsche Gericht in eine englische Bildbeschreibung.
// FLUX kennt „Käsespätzle“ oder „Rouladen“ kaum – „egg noodles with melted cheese and crispy onions“ schon.
const DESCRIBE_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

async function describeDish(env: AiEnv, mealName: string, type?: string, ingredients?: string[]): Promise<string | null> {
  try {
    const raw = (await env.AI!.run(DESCRIBE_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "You write one short English sentence (max 45 words) describing exactly what a finished, plated home-cooked dish looks like: " +
            "the visible components, their colors and textures, and how they are arranged on the plate. " +
            "Only describe what is in the recipe. No brand names, no people, no text. Answer with the sentence only.",
        },
        {
          role: "user",
          content:
            `Dish (German name): ${mealName}\n` +
            (type === "vegetarisch" ? "Vegetarian: no meat, no fish.\n" : "") +
            (ingredients?.length ? `Ingredients (German): ${mainIngredients(ingredients)}` : ""),
        },
      ],
      max_tokens: 120,
      temperature: 0.3,
    })) as { response?: string };
    const text = (raw?.response ?? "").replace(/^["']|["']$/g, "").trim();
    return text.length > 15 ? text : null;
  } catch (err) {
    console.warn("Bildbeschreibung fehlgeschlagen:", err);
    return null;
  }
}

function prompt(mealName: string, description: string | null, type?: string, ingredients?: string[]) {
  const veg = type === "vegetarisch" ? "Vegetarian, no meat, no fish. " : "";
  const subject = description
    ? description
    : `"${mealName}"${ingredients?.length ? ` made with ${mainIngredients(ingredients)}` : ""}`;
  return (
    `Realistic food photograph of a homemade family dinner: ${subject} ${veg}` +
    `Served on a simple ceramic plate on a wooden kitchen table, soft natural daylight, 45-degree angle, ` +
    `close-up, shallow depth of field, appetizing, true-to-life colors, no text, no people, no hands`
  );
}

/** Typ und Zutaten zum Gericht: aus dem Plan, sonst aus dem Rezept-Pool oder den Favoriten */
async function dishInfo(sql: Sql, mealName: string): Promise<{ type?: string; ingredients?: string[] }> {
  const rows = await sql`
    SELECT meal_type AS type, ingredients FROM plan_meals WHERE meal_name = ${mealName}
    UNION ALL SELECT type, ingredients FROM recipes WHERE name = ${mealName}
    UNION ALL SELECT meal_type, ingredients FROM favorites WHERE meal_name = ${mealName}
    LIMIT 1`;
  const r = rows[0] as { type?: string; ingredients?: string[] } | undefined;
  if (r) return r;
  const builtIn = MEAL_DATABASE.find((m) => m.name === mealName);
  return builtIn ? { type: builtIn.type, ingredients: builtIn.ingredients } : {};
}

export type ImageResult =
  | { url: string; source: "ai" | "pexels" }
  | { error: string; quota?: boolean };

/** Tageskontingent von Workers AI aufgebraucht? (Fehler 4006 „daily free allocation“) */
function isQuotaError(err: unknown) {
  return /4006|daily free allocation|neurons/i.test(String((err as Error)?.message ?? err));
}

// Ist das Kontingent leer, die KI bis zum Zurücksetzen (Mitternacht UTC) nicht weiter anfragen
let aiBlockedUntil = 0;
function blockAiUntilReset() {
  const d = new Date();
  aiBlockedUntil = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
const aiAvailable = (env: AiEnv) => !!env.AI && Date.now() >= aiBlockedUntil;

/** Bild per KI: Base64-JPEG oder Fehler */
async function aiImage(env: AiEnv, sql: Sql, mealName: string): Promise<{ base64: string } | { error: string; quota?: boolean }> {
  try {
    const info = await dishInfo(sql, mealName);
    const description = await describeDish(env, mealName, info.type, info.ingredients);
    const result = (await env.AI!.run(MODEL, {
      prompt: prompt(mealName, description, info.type, info.ingredients),
      steps: 8,
    })) as { image?: string };
    return result?.image ? { base64: result.image } : { error: "Die Bild-KI hat kein Bild geliefert." };
  } catch (err) {
    console.error(`KI-Bild für "${mealName}" fehlgeschlagen:`, err);
    if (isQuotaError(err)) {
      blockAiUntilReset();
      return { error: "Das tägliche Gratis-Kontingent der Bild-KI ist aufgebraucht. Morgen früh geht es wieder.", quota: true };
    }
    return { error: "Das Bild konnte nicht erstellt werden." };
  }
}

interface PexelsPhoto {
  alt?: string;
  photographer: string;
  photographer_url: string;
  url: string;
  src: { large: string; medium: string };
}

/** Suchbegriffe vom genauen Namen zum Hauptgericht: „Käsespätzle mit Röstzwiebeln“ → …, „Käsespätzle“ */
function pexelsQueries(mealName: string): string[] {
  const main = mealName.split(/\s(?:mit|und|&|in|an|auf)\s/i)[0];
  const keywords = [...dishKeywords(main)].join(" ");
  return [...new Set([mealName, main, keywords].map((q) => q.trim()).filter((q) => q.length > 2))];
}

/** Passendes Foto bei Pexels suchen und laden */
async function pexelsImage(env: AiEnv, mealName: string) {
  if (!env.PEXELS_API_KEY) return null;
  for (const q of pexelsQueries(mealName)) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&locale=de-DE&per_page=5&orientation=landscape`,
        { headers: { Authorization: env.PEXELS_API_KEY } }
      );
      if (!res.ok) {
        console.warn(`Pexels-Suche "${q}": HTTP ${res.status}`);
        if (res.status === 401 || res.status === 403 || res.status === 429) return null;
        continue;
      }
      const data = (await res.json()) as { photos?: PexelsPhoto[] };
      const photo = data.photos?.[0];
      if (!photo) continue;
      const img = await fetch(photo.src.large);
      if (!img.ok) continue;
      return {
        base64: toBase64(await img.arrayBuffer()),
        contentType: img.headers.get("content-type") || "image/jpeg",
        creditName: photo.photographer,
        creditUrl: photo.url,
      };
    } catch (err) {
      console.warn(`Pexels-Suche "${q}" fehlgeschlagen:`, err);
    }
  }
  return null;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function storeImage(
  sql: Sql,
  mealName: string,
  img: { base64: string; contentType?: string; source: "ai" | "pexels"; creditName?: string; creditUrl?: string }
): Promise<string> {
  const rows = await sql`
    INSERT INTO meal_images (meal_name, image_url, image_data, content_type, source, credit_name, credit_url, updated_at)
    VALUES (${mealName}, '', decode(${img.base64}, 'base64'), ${img.contentType ?? "image/jpeg"}, ${img.source},
      ${img.creditName ?? null}, ${img.creditUrl ?? null}, now())
    ON CONFLICT (meal_name) DO UPDATE SET
      image_data = EXCLUDED.image_data, content_type = EXCLUDED.content_type, source = EXCLUDED.source,
      credit_name = EXCLUDED.credit_name, credit_url = EXCLUDED.credit_url, updated_at = now()
    RETURNING extract(epoch FROM updated_at)::bigint AS v`;
  const url = imageUrl(mealName, rows[0].v);
  await sql`UPDATE meal_images SET image_url = ${url} WHERE meal_name = ${mealName}`;
  return url;
}

/**
 * Bild erzeugen und speichern: erst KI, sonst Pexels-Foto.
 * aiOnly = nur KI (zum späteren Ersetzen von Pexels-Fotos).
 */
export async function generateImage(env: AiEnv, sql: Sql, mealName: string, aiOnly = false): Promise<ImageResult> {
  let aiError: { error: string; quota?: boolean } = { error: "Die Bild-KI ist nicht eingerichtet." };
  if (aiAvailable(env)) {
    const ai = await aiImage(env, sql, mealName);
    if ("base64" in ai) return { url: await storeImage(sql, mealName, { base64: ai.base64, source: "ai" }), source: "ai" };
    aiError = ai;
  } else if (env.AI) {
    aiError = { error: "Das tägliche Gratis-Kontingent der Bild-KI ist aufgebraucht. Morgen früh geht es wieder.", quota: true };
  }
  if (aiOnly) return aiError;

  const photo = await pexelsImage(env, mealName);
  if (photo) return { url: await storeImage(sql, mealName, { ...photo, source: "pexels" }), source: "pexels" };
  return env.PEXELS_API_KEY ? { ...aiError, error: `${aiError.error} Auch bei Pexels gab es kein passendes Foto.` } : aiError;
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
    const res = await generateImage(env, sql, r.meal_name);
    if ("error" in res) return; // auch kein Foto → beim nächsten Lauf weiter
  }
  // Ist die KI wieder verfügbar, Pexels-Ersatzfotos aus aktiven Plänen nach und nach durch KI-Bilder ersetzen
  const left = limit - rows.length;
  if (left <= 0 || planId || !aiAvailable(env)) return;
  const fallbacks = await sql`SELECT DISTINCT mi.meal_name FROM meal_images mi
    JOIN plan_meals pm ON pm.meal_name = mi.meal_name AND NOT pm.rejected
    JOIN meal_plans mp ON mp.id = pm.plan_id AND mp.status = 'active'
    WHERE mi.source = 'pexels' LIMIT ${left}`;
  for (const r of fallbacks) {
    const res = await generateImage(env, sql, r.meal_name, true);
    if ("error" in res) break;
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
