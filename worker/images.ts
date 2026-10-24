// Rezeptbilder: zuerst Cloudflare Workers AI (FLUX.1 schnell); ist das Tageskontingent aufgebraucht
// oder klappt die KI nicht, ein passendes Foto aus einer freien Bilddatenbank
// (Pexels/Pixabay mit Schlüssel, Openverse ohne Schlüssel). Speicherung in Neon.
import type { Sql } from "./db";
import { MEAL_DATABASE } from "./meals";
import { FAMILY_DESSERTS } from "../src/data/dessertsFamily";


export interface AiEnv {
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  /** Schlüssel für Ersatzfotos, wenn die KI nicht kann (beide optional; Openverse geht ohne) */
  PEXELS_API_KEY?: string;
  PIXABAY_API_KEY?: string;
}

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Öffentliche Bild-URL (mit Version, damit neue Bilder nicht aus dem Cache kommen); mit Familie = deren eigene Fassung */
export function imageUrl(mealName: string, version: string | number, profileId?: string | null) {
  return `/api/images/${encodeURIComponent(mealName)}?${profileId ? `f=${profileId}&` : ""}v=${version}`;
}

/** Bild-URL, die eine Familie für ein Gericht sieht (oder null) */
export async function effectiveImageUrl(sql: Sql, mealName: string, profileId: string): Promise<string | null> {
  const rows = await sql`SELECT image_url, image_data IS NOT NULL AS has FROM meal_images
    WHERE meal_name = ${mealName} AND (profile_id IS NULL OR profile_id = ${profileId})
    ORDER BY profile_id IS NULL LIMIT 1`;
  return rows[0]?.has ? (rows[0].image_url as string) : null;
}

/** SQL-Ausdruck (Alias mi = meal_images): URL nur, wenn ein Bild gespeichert ist */
export const IMAGE_URL_SQL = `CASE WHEN mi.image_data IS NOT NULL THEN mi.image_url END`;
/** Dazu Herkunft und Fotograf (bei Fotos aus Bilddatenbanken als Quellenangabe angezeigt) */
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
  const veg = type === "vegetarisch" || type === "nachtisch" ? "Vegetarian, no meat, no fish. " : "";
  const what = type === "nachtisch" ? "a homemade dessert" : "a homemade family dinner";
  const subject = description
    ? description
    : `"${mealName}"${ingredients?.length ? ` made with ${mainIngredients(ingredients)}` : ""}`;
  return (
    `Realistic food photograph of ${what}: ${subject} ${veg}` +
    `Served on a simple ceramic plate or in a glass bowl on a wooden kitchen table, soft natural daylight, 45-degree angle, ` +
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
  if (builtIn) return { type: builtIn.type, ingredients: builtIn.ingredients };
  // Eigene Nachtische (Frontend-Sammlung ohne Foto)
  const dessert = FAMILY_DESSERTS.find((d) => d.name === mealName);
  return dessert ? { type: "nachtisch", ingredients: dessert.ingredients } : {};
}

export type PhotoSource = "pexels" | "pixabay" | "openverse";
export const PHOTO_SOURCES: PhotoSource[] = ["pexels", "pixabay", "openverse"];

export type ImageSource = "ai" | "mealdb" | "chefkoch" | PhotoSource;

export type ImageResult =
  | { url: string; source: ImageSource }
  | { error: string; quota?: boolean };

/** Tageskontingent von Workers AI aufgebraucht? (Fehler 4006 „daily free allocation“) */
export function isQuotaError(err: unknown) {
  if ((err as { familyBudget?: boolean } | null)?.familyBudget) return true;
  return /4006|daily free allocation|neurons/i.test(String((err as Error)?.message ?? err));
}

/** Nur das Budget einer Familie ist erreicht (nicht das Kontingent aller) */
export const isFamilyBudget = (err: unknown) => !!(err as { familyBudget?: boolean } | null)?.familyBudget;

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
    if (isFamilyBudget(err)) return { error: "Euer KI-Budget für heute ist aufgebraucht.", quota: true };
    if (isQuotaError(err)) {
      blockAiUntilReset();
      return { error: "Das tägliche Gratis-Kontingent der Bild-KI ist aufgebraucht. Morgen früh geht es wieder.", quota: true };
    }
    return { error: "Das Bild konnte nicht erstellt werden." };
  }
}

/** Hauptgericht ohne Beilagen: „Käsespätzle mit Röstzwiebeln“ → „Käsespätzle“ */
const mainDish = (mealName: string) => mealName.split(/\s(?:mit|und|&|in|an|auf|vom|nach)\s/i)[0].trim();

/** Suchbegriffe: genauer Name, dann Hauptgericht (keine Einzelwörter – die liefern nur Zutatenfotos) */
function photoQueries(mealName: string): string[] {
  return [...new Set([mealName.trim(), mainDish(mealName)].filter((q) => q.length > 2))];
}

const stem = (w: string) => w.toLowerCase().replace(/(en|er|es|e|n|s)$/, "");

/**
 * Das eigentliche Gericht ist das letzte Wort des Hauptgerichts: „Kartoffel-Gemüse-Frittata“ → frittata,
 * „Ofen-Hähnchenschenkel“ → hähnchenschenkel, „Herzhafte Schinkennudeln von …“ → schinkennudel.
 */
export function dishHead(mealName: string): string {
  const words = mainDish(mealName.split(/\s(?:von|à la|nach art)\s/i)[0])
    .split(/[^a-zäöüß]+/i)
    .filter((w) => w.length > 2);
  return stem(words[words.length - 1] ?? "");
}

/** Passt ein Foto (Schlagworte/Titel) zum Gericht? Zusammengesetzte Wörter zählen: „nudeln“ passt zu „Schinkennudeln“. */
export function photoMatches(mealName: string, photoText: string): boolean {
  const head = dishHead(mealName);
  if (head.length < 4) return false;
  return photoText
    .toLowerCase()
    .split(/[^a-zäöüß]+/)
    .filter((w) => w.length >= 4)
    .map(stem)
    .some((t) => t === head || (t.length >= 4 && head.endsWith(t)) || t.endsWith(head));
}

/** Schlagworte lesbar machen (Pixabay-Links enthalten sie URL-kodiert: „k%C3%BCrbissuppe“) */
function readable(text: string): string {
  try {
    return decodeURIComponent(text).toLowerCase();
  } catch {
    return text.toLowerCase();
  }
}

/**
 * Auffällige Zutaten/Gerichte (deutsch und englisch). Zeigt ein Foto eines davon, das Rezept enthält es aber nicht,
 * passt das Foto nicht: Pommes beim Kartoffelsalat, Brokkoli oder Tofu in der Hähnchenpfanne, Kürbis in der Cheeseburger-Suppe.
 */
const CONFLICTS: string[][] = [
  ["pommes", "fries", "frites"],
  ["brokkoli", "broccoli"],
  ["tofu"],
  ["kürbis", "pumpkin", "squash"],
  ["lachs", "salmon"],
  ["garnele", "shrimp", "prawn", "scampi"],
  ["pizza"],
  ["sushi"],
  ["burger"],
  ["spaghetti", "nudel", "pasta", "noodle", "penne", "linguine", "fusilli", "tagliatelle", "makkaroni", "maccheroni", "rigatoni", "farfalle", "lasagne", "spätzle"],
  ["reis", "rice", "risotto"],
  ["hähnchen", "chicken", "huhn", "hühn", "geflügel", "pute", "truthahn", "turkey"],
  ["rind", "beef", "steak"],
  ["schwein", "pork", "speck", "bacon", "schinken"],
  ["fisch", "fish", "thunfisch", "tuna", "kabeljau", "seelachs"],
  ["frühstück", "breakfast", "müsli", "granola", "porridge"],
  ["kuchen", "cake", "torte", "dessert", "cupcake", "muffin", "cookie", "keks"],
  ["avocado", "guacamole"],
  ["erdbeer", "strawberr", "himbeer", "raspberr", "heidelbeer", "blueberr", "brombeer", "blackberr", "granatapfel", "pomegranate"],
];

/** Text, gegen den Fotos geprüft werden: Name und Zutaten (Nachtische dürfen „Dessert“, „Kuchen“ … zeigen) */
export function recipeText(mealName: string, ingredients: string[] = [], type?: string): string {
  return `${mealName} ${ingredients.join(" ")}${type === "nachtisch" ? " dessert kuchen" : ""}`;
}

/** Erste Gruppe aus CONFLICTS, die das Foto zeigt, das Rezept aber nicht hat (sonst null) */
export function photoConflict(recipeText: string, photoText: string): string | null {
  const recipe = recipeText.toLowerCase();
  const photo = readable(photoText);
  for (const group of CONFLICTS) {
    const shown = group.find((t) => photo.includes(t));
    if (shown && !group.some((t) => recipe.includes(t))) return shown.trim();
  }
  return null;
}

/** Allgemeine Gerichtsformen – das Foto muss dann auch den eigentlichen Inhalt zeigen („Falafel“, nicht nur „Teller“) */
const GENERIC_HEADS = new Set(
  ["teller", "pfanne", "suppe", "salat", "bowl", "auflauf", "eintopf", "gratin", "curry", "platte", "spieß", "wrap", "gemüse", "pfännchen", "topf", "toast", "brot", "mahlzeit", "gericht"].map(stem)
);
const FILLER_WORDS = new Set(
  ["cremige", "cremiger", "cremiges", "herzhafte", "herzhafter", "schnelle", "schneller", "einfache", "einfacher", "bunte", "bunter", "leichte", "leichter", "würzige", "würziger", "klassische", "klassischer", "omas", "frische", "frischer", "knusprige", "knuspriger", "gebratene", "gebratener", "überbackene", "überbackener"].map(stem)
);

/** Wörter des Hauptgerichts (ohne Beilagen und Füllwörter): „Cremige Hähnchen-Gemüse-Pfanne mit Reis“ → hähnch, gemüs, pfann */
function mainWords(mealName: string): string[] {
  return mainDish(mealName)
    .split(/[^a-zäöüß]+/i)
    .filter((w) => w.length >= 4)
    .map(stem)
    .filter((w) => !FILLER_WORDS.has(w));
}

/**
 * Wie gut passt ein Foto zum Rezept? -1 = passt nicht, sonst Anzahl Treffer (mehr = besser).
 * Bedingungen: das Gericht selbst ist zu sehen (photoMatches), bei allgemeinen Formen („Suppe“, „Teller“, „Pfanne“)
 * auch das Besondere daran, und nichts Auffälliges, was gar nicht im Rezept ist.
 */
export function photoFit(mealName: string, ingredients: string[], photoText: string, type?: string): number {
  const text = readable(photoText);
  if (!photoMatches(mealName, text)) return -1;
  if (photoConflict(recipeText(mealName, ingredients, type), text)) return -1;
  const tokens = text.split(/[^a-zäöüß]+/).filter((w) => w.length >= 4).map(stem);
  const has = (w: string) => tokens.some((t) => t === w || t.endsWith(w) || (t.length >= 4 && w.endsWith(t)) || t.startsWith(w));
  const words = mainWords(mealName);
  const head = dishHead(mealName);
  const specific = words.filter((w) => w !== head && !GENERIC_HEADS.has(w));
  if (GENERIC_HEADS.has(head) && specific.length && !specific.some(has)) return -1;
  // Pluspunkte: Wörter aus dem ganzen Namen (auch Beilagen) und Hauptzutaten
  const nameWords = mealName.split(/[^a-zäöüß]+/i).filter((w) => w.length >= 4).map(stem);
  const ingWords = mainIngredients(ingredients).split(/[^a-zäöüß]+/i).filter((w) => w.length >= 4).map(stem);
  return [...new Set([...nameWords, ...ingWords])].filter(has).length;
}

interface PhotoHit {
  imageUrl: string;
  /** Schlagworte und Titel, um die Passung zu prüfen */
  text: string;
  /** Anzeige, z. B. „Anna / Pixabay“ */
  creditName: string;
  creditUrl: string;
}

const UA = { "User-Agent": "Familien-Speiseplaner/1.0 (private Familien-App)" };

/** Kandidaten je Anbieter und Suchbegriff (Fehler beenden die Suche bei diesem Anbieter) */
const PROVIDERS: { id: PhotoSource; enabled: (env: AiEnv) => boolean; search: (env: AiEnv, q: string) => Promise<PhotoHit[]> }[] = [
  {
    id: "pexels",
    enabled: (env) => !!env.PEXELS_API_KEY,
    search: async (env, q) => {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&locale=de-DE&per_page=15&orientation=landscape`,
        { headers: { Authorization: env.PEXELS_API_KEY! } }
      );
      if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
      const photos = ((await res.json()) as { photos?: { alt?: string; photographer: string; url: string; src: { large: string } }[] }).photos ?? [];
      return photos.map((p) => ({ imageUrl: p.src.large, text: `${p.alt ?? ""} ${p.url}`, creditName: `${p.photographer} / Pexels`, creditUrl: p.url }));
    },
  },
  {
    id: "pixabay",
    enabled: (env) => !!env.PIXABAY_API_KEY,
    search: async (env, q) => {
      const res = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(env.PIXABAY_API_KEY!)}&q=${encodeURIComponent(q)}` +
          `&lang=de&image_type=photo&category=food&orientation=horizontal&safesearch=true&per_page=20`
      );
      if (!res.ok) throw new Error(`Pixabay HTTP ${res.status}`);
      const hits = ((await res.json()) as { hits?: { webformatURL: string; largeImageURL?: string; tags: string; user: string; pageURL: string }[] }).hits ?? [];
      return hits.map((h) => ({ imageUrl: h.largeImageURL || h.webformatURL, text: `${h.tags} ${h.pageURL}`, creditName: `${h.user} / Pixabay`, creditUrl: h.pageURL }));
    },
  },
  {
    // Freie Creative-Commons-Bildsuche (WordPress), ohne Schlüssel
    id: "openverse",
    enabled: () => true,
    search: async (_env, q) => {
      const res = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=20&mature=false&aspect_ratio=wide`,
        { headers: UA }
      );
      if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
      const results = ((await res.json()) as { results?: { url: string; title?: string; tags?: { name: string }[]; creator?: string; foreign_landing_url: string; license: string }[] }).results ?? [];
      return results.map((r) => ({
        imageUrl: r.url,
        text: `${r.title ?? ""} ${(r.tags ?? []).map((t) => t.name).join(" ")}`,
        creditName: `${r.creator || "Unbekannt"} / Openverse (CC ${r.license.toUpperCase()})`,
        creditUrl: r.foreign_landing_url,
      }));
    },
  },
];

/**
 * Originalfoto aus der Rezeptsammlung (TheMealDB) laden. Nicht, wenn das Gericht es schon hat –
 * dann soll „Neues Bild“ wirklich ein anderes liefern.
 */
async function libraryPhoto(sql: Sql, mealName: string, rejected: Set<string>, currentSource: string | null) {
  if (rejected.has("mealdb")) return null;
  // Bearbeitete Gerichte der Sammlung behalten ihr Originalfoto
  const edited = await sql`SELECT replaces FROM recipes WHERE name = ${mealName} AND replaces IS NOT NULL`;
  const original = (edited[0]?.replaces as string | undefined) ?? mealName;
  const url = MEAL_DATABASE.find((m) => m.name === original)?.imageUrl;
  if (!url) return null;
  if (currentSource === "mealdb") return null;
  try {
    const img = await fetch(url, { headers: UA });
    const type = img.headers.get("content-type") || "";
    if (!img.ok || !type.startsWith("image/")) return null;
    return {
      source: "mealdb" as const,
      base64: toBase64(await img.arrayBuffer()),
      contentType: type,
      creditName: "TheMealDB",
      creditUrl: "https://www.themealdb.com/",
    };
  } catch (err) {
    console.warn(`Originalfoto für ${mealName} nicht geladen:`, err);
    return null;
  }
}

/**
 * Passendes Foto suchen und laden: Anbieter der Reihe nach, je Anbieter das am besten passende (photoFit).
 * `exclude` = Links von Fotos, die nicht (wieder) kommen sollen (aktuelles Foto, entfernte Fotos).
 */
async function stockPhoto(env: AiEnv, mealName: string, info: { type?: string; ingredients?: string[] }, exclude: Set<string>) {
  for (const provider of PROVIDERS.filter((p) => p.enabled(env))) {
    try {
      const scored: { hit: PhotoHit; score: number }[] = [];
      for (const q of photoQueries(mealName)) {
        for (const hit of await provider.search(env, q)) {
          if (exclude.has(hit.creditUrl) || scored.some((s) => s.hit.creditUrl === hit.creditUrl)) continue;
          const score = photoFit(mealName, info.ingredients ?? [], hit.text, info.type);
          if (score >= 0) scored.push({ hit, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      for (const { hit } of scored.slice(0, 3)) {
        const img = await fetch(hit.imageUrl, { headers: UA });
        const type = img.headers.get("content-type") || "";
        if (!img.ok || !type.startsWith("image/")) continue;
        return { source: provider.id, base64: toBase64(await img.arrayBuffer()), contentType: type, creditName: hit.creditName, creditUrl: hit.creditUrl };
      }
    } catch (err) {
      console.warn(`Fotosuche bei ${provider.id} fehlgeschlagen:`, err);
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

/** Bild speichern: gemeinsam (ohne profileId) oder als eigene Fassung einer Familie */
async function storeImage(
  sql: Sql,
  mealName: string,
  img: { base64: string; contentType?: string; source: ImageSource; creditName?: string; creditUrl?: string },
  profileId: string | null = null
): Promise<string> {
  const rows = profileId
    ? await sql`
      INSERT INTO meal_images (profile_id, meal_name, image_url, image_data, content_type, source, credit_name, credit_url, updated_at)
      VALUES (${profileId}, ${mealName}, '', decode(${img.base64}, 'base64'), ${img.contentType ?? "image/jpeg"}, ${img.source},
        ${img.creditName ?? null}, ${img.creditUrl ?? null}, now())
      ON CONFLICT (profile_id, meal_name) WHERE profile_id IS NOT NULL DO UPDATE SET
        image_data = EXCLUDED.image_data, content_type = EXCLUDED.content_type, source = EXCLUDED.source,
        credit_name = EXCLUDED.credit_name, credit_url = EXCLUDED.credit_url, updated_at = now()
      RETURNING extract(epoch FROM updated_at)::bigint AS v`
    : await sql`
      INSERT INTO meal_images (meal_name, image_url, image_data, content_type, source, credit_name, credit_url, updated_at)
      VALUES (${mealName}, '', decode(${img.base64}, 'base64'), ${img.contentType ?? "image/jpeg"}, ${img.source},
        ${img.creditName ?? null}, ${img.creditUrl ?? null}, now())
      ON CONFLICT (meal_name) WHERE profile_id IS NULL DO UPDATE SET
        image_data = EXCLUDED.image_data, content_type = EXCLUDED.content_type, source = EXCLUDED.source,
        credit_name = EXCLUDED.credit_name, credit_url = EXCLUDED.credit_url, updated_at = now()
      RETURNING extract(epoch FROM updated_at)::bigint AS v`;
  const url = imageUrl(mealName, rows[0].v, profileId);
  if (profileId) await sql`UPDATE meal_images SET image_url = ${url} WHERE profile_id = ${profileId} AND meal_name = ${mealName}`;
  else await sql`UPDATE meal_images SET image_url = ${url} WHERE profile_id IS NULL AND meal_name = ${mealName}`;
  return url;
}

type ImageRow = { profile_id?: string | null; source?: string | null; credit_url?: string | null; rejected_photos?: string[] | string; has_image?: boolean };

/**
 * Gespeicherter Stand für eine Familie (bzw. nur gemeinsam): sichtbare Zeile (eigene Fassung vor gemeinsamer),
 * entfernte Fotos (gemeinsam + Familie) und was beim nächsten Foto ausgeschlossen ist (zusätzlich das aktuelle)
 */
async function imageState(sql: Sql, mealName: string, profileId: string | null = null) {
  const rows = (await sql`SELECT profile_id, source, credit_url, rejected_photos, image_data IS NOT NULL AS has_image
    FROM meal_images WHERE meal_name = ${mealName} AND (profile_id IS NULL OR profile_id = ${profileId})
    ORDER BY profile_id IS NULL`) as ImageRow[];
  const visible = rows[0];
  const rejected = new Set(rows.flatMap((r) => parseTextArray(r.rejected_photos)));
  const exclude = new Set(rejected);
  if (visible?.has_image && visible.credit_url) exclude.add(visible.credit_url);
  return { rejected, exclude, visible, hasOwn: !!profileId && rows.some((r) => r.profile_id) };
}

/** text[] kommt von Neon als Array, lokal teils als „{a,b}“ */
function parseTextArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.replace(/^\{|\}$/g, "").split(",").map((v) => v.replace(/^"|"$/g, "")).filter(Boolean);
}

/**
 * Bild erzeugen und speichern: Originalfoto aus der Rezeptsammlung, sonst KI,
 * sonst ein Foto aus einer freien Bilddatenbank (nie das aktuelle oder ein entferntes).
 * aiOnly = nur KI (zum späteren Ersetzen der Ersatzfotos und entfernter Bilder).
 */
export async function generateImage(
  env: AiEnv,
  sql: Sql,
  mealName: string,
  aiOnly = false,
  /** Familie, für die das Bild nur gelten soll (eigene Fassung); ohne = gemeinsames Bild */
  profileId: string | null = null
): Promise<ImageResult> {
  const { rejected, exclude, visible } = await imageState(sql, mealName, profileId);
  if (!aiOnly) {
    const original = await libraryPhoto(sql, mealName, rejected, visible?.has_image ? (visible.source ?? null) : null);
    if (original) return { url: await storeImage(sql, mealName, original, profileId), source: "mealdb" };
  }
  let aiError: { error: string; quota?: boolean } = { error: "Die Bild-KI ist nicht eingerichtet." };
  if (aiAvailable(env)) {
    const ai = await aiImage(env, sql, mealName);
    if ("base64" in ai) return { url: await storeImage(sql, mealName, { base64: ai.base64, source: "ai" }, profileId), source: "ai" };
    aiError = ai;
  } else if (env.AI) {
    aiError = { error: "Das tägliche Gratis-Kontingent der Bild-KI ist aufgebraucht. Morgen früh geht es wieder.", quota: true };
  }
  if (aiOnly) return aiError;

  const info = await dishInfo(sql, mealName);
  const photo = await stockPhoto(env, mealName, info, exclude);
  if (photo) return { url: await storeImage(sql, mealName, photo, profileId), source: photo.source };
  return { ...aiError, error: `${aiError.error} Ein passendes Ersatzfoto gab es auch nicht.` };
}

/**
 * Bild entfernen, weil es nicht passt: Gericht hat dann kein Bild (source = 'removed'). Das Foto kommt nicht wieder;
 * der Cron ersetzt es nur durch ein KI-Bild, sobald die KI wieder kann.
 */
export async function removeImage(sql: Sql, mealName: string, profileId: string): Promise<void> {
  // Nur für diese Familie: eigene Fassung „entfernt“, das gemeinsame Bild bleibt für alle anderen
  const r = (await imageState(sql, mealName, profileId)).visible;
  // Ohne gespeichertes Bild zeigt die Übersicht das Originalfoto der Sammlung – das ist dann gemeint
  const key =
    r?.source === "removed" || r?.source === "ai" ? null
    : !r?.has_image || r.source === "mealdb" ? "mealdb"
    : r.credit_url ?? null;
  const add = key ? [key] : [];
  await sql`INSERT INTO meal_images (profile_id, meal_name, image_url, image_data, source, credit_name, credit_url, rejected_photos, updated_at)
    VALUES (${profileId}, ${mealName}, '', NULL, 'removed', NULL, NULL, ${add}, now())
    ON CONFLICT (profile_id, meal_name) WHERE profile_id IS NOT NULL DO UPDATE SET image_url = '', image_data = NULL, content_type = NULL, source = 'removed',
      credit_name = NULL, credit_url = NULL, updated_at = now(),
      rejected_photos = (SELECT array_agg(DISTINCT x) FROM unnest(COALESCE(meal_images.rejected_photos, '{}') || EXCLUDED.rejected_photos) AS x)`;
}

/** Fehlende Bilder für Gerichte in Plänen erzeugen (höchstens `limit` pro Aufruf) */
export async function fillMissingImages(env: AiEnv, sql: Sql, limit = 5, planId?: string) {
  const rows = planId
    ? await sql`SELECT DISTINCT pm.meal_name FROM plan_meals pm
        LEFT JOIN meal_images mi ON mi.meal_name = pm.meal_name AND mi.profile_id IS NULL
        WHERE pm.plan_id = ${planId} AND NOT pm.rejected AND NOT pm.brotzeit AND mi.image_data IS NULL
          AND mi.source IS DISTINCT FROM 'removed' LIMIT ${limit}`
    : await sql`SELECT DISTINCT pm.meal_name FROM plan_meals pm
        JOIN meal_plans mp ON mp.id = pm.plan_id AND mp.status = 'active'
        LEFT JOIN meal_images mi ON mi.meal_name = pm.meal_name AND mi.profile_id IS NULL
        WHERE NOT pm.rejected AND NOT pm.brotzeit AND mi.image_data IS NULL AND mi.source IS DISTINCT FROM 'removed' LIMIT ${limit}`;
  for (const r of rows) {
    const res = await generateImage(env, sql, r.meal_name);
    if ("error" in res) return; // auch kein Foto → beim nächsten Lauf weiter
  }
  let left = limit - rows.length;
  if (left <= 0 || planId) return;
  // Eigene Nachtische ohne Foto: pro Lauf höchstens zwei Bilder (schont das Tageskontingent)
  const dessertNames = FAMILY_DESSERTS.map((d) => d.name);
  const done = await sql`SELECT meal_name FROM meal_images WHERE profile_id IS NULL AND meal_name = ANY(${dessertNames})
    AND (image_data IS NOT NULL OR source = 'removed')`;
  const doneSet = new Set(done.map((r) => r.meal_name as string));
  for (const name of dessertNames.filter((n) => !doneSet.has(n)).slice(0, Math.min(2, left))) {
    const res = await generateImage(env, sql, name);
    left--;
    if ("error" in res) return;
  }
  // Ist die KI wieder verfügbar, Ersatzfotos und entfernte Bilder aus aktiven Plänen nach und nach durch KI-Bilder ersetzen
  if (left <= 0 || !aiAvailable(env)) return;
  const fallbacks = await sql`SELECT DISTINCT mi.meal_name FROM meal_images mi
    JOIN plan_meals pm ON pm.meal_name = mi.meal_name AND NOT pm.rejected AND NOT pm.brotzeit
    JOIN meal_plans mp ON mp.id = pm.plan_id AND mp.status = 'active'
    WHERE mi.profile_id IS NULL AND (mi.source = ANY(${PHOTO_SOURCES}) OR mi.source = 'removed') LIMIT ${left}`;
  for (const r of fallbacks) {
    const res = await generateImage(env, sql, r.meal_name, true);
    if ("error" in res) break;
  }
}

/** Bild ausliefern (ohne Passwort, damit <img> es laden kann) */
export async function serveImage(sql: Sql, mealName: string, profileId: string | null = null): Promise<Response> {
  const rows = profileId
    ? await sql`SELECT encode(image_data, 'base64') AS data, content_type FROM meal_images
        WHERE meal_name = ${mealName} AND profile_id = ${profileId} AND image_data IS NOT NULL`
    : await sql`SELECT encode(image_data, 'base64') AS data, content_type FROM meal_images
        WHERE meal_name = ${mealName} AND profile_id IS NULL AND image_data IS NOT NULL`;
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

/** Foto der Rezept-Quelle (z. B. Chefkoch) übernehmen – mit Nennung und Link zum Original */
/**
 * Fallback für Chefkoch-Fotos, falls die App-Kennung abgewiesen wird. Zuerst immer die ehrliche App-Kennung (`UA`): Eine
 * vorgetäuschte Browser-Kennung aus dem Rechenzentrum weist das Chefkoch-CDN mit 403 ab (so geschehen am 24.10.2026).
 */
const BROWSER_PHOTO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/jpeg,image/*;q=0.8",
};

/** Foto einer Quelle laden und als Bild des Gerichts speichern; wirft mit lesbarem Grund, wenn es nicht klappt */
export async function storeSourcePhotoChecked(
  sql: Sql,
  mealName: string,
  photoUrl: string,
  creditName: string,
  creditUrl: string,
  profileId: string | null = null
): Promise<string> {
  const host = new URL(photoUrl).host;
  let img = await fetch(photoUrl, { headers: UA });
  const statuses = [`App-Kennung ${img.status}`];
  if (!img.ok && img.status === 403) {
    img = await fetch(photoUrl, { headers: BROWSER_PHOTO_HEADERS });
    statuses.push(`Browser-Kennung ${img.status}`);
  }
  const type = img.headers.get("content-type") || "";
  if (!img.ok) throw new Error(`Foto von ${host} nicht abrufbar (HTTP ${statuses.join(", ")})`);
  if (!type.startsWith("image/")) throw new Error(`Foto von ${host} ist kein Bild (${type || "ohne Typ"})`);
  const buf = await img.arrayBuffer();
  if (buf.byteLength > 4_000_000) throw new Error("Foto ist größer als 4 MB");
  return storeImage(sql, mealName, { base64: toBase64(buf), contentType: type, source: "chefkoch", creditName, creditUrl }, profileId);
}

export async function storeSourcePhoto(
  sql: Sql,
  mealName: string,
  photoUrl: string,
  creditName: string,
  creditUrl: string,
  profileId: string | null = null
): Promise<string | null> {
  try {
    return await storeSourcePhotoChecked(sql, mealName, photoUrl, creditName, creditUrl, profileId);
  } catch (err) {
    console.warn(`Foto für ${mealName} nicht übernommen:`, err);
    return null;
  }
}
