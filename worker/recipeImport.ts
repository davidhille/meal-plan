// Rezept per Link importieren: Fast alle Rezeptseiten (Chefkoch, Lecker, EatSmarter, Foodblogs …)
// liefern ihre Daten zusätzlich maschinenlesbar als schema.org „Recipe“ (JSON-LD).
// Wir lesen nur diese Daten, rechnen auf 4 Portionen um und schätzen den Typ.
import { type Recipe, looksMeaty } from "./meals";
import { RECIPE_BASE_PORTIONS, scaleIngredient } from "../src/lib/portions";

export interface ImportedRecipe extends Recipe {
  sourceUrl: string;
  /** Portionen laut Quelle (vor dem Umrechnen) */
  sourcePortions: number | null;
}


/** So schreibt Chefkoch Titel in die Adresse: Umlaute ausgeschrieben, alles andere zu Bindestrichen */
const slugify = (s: string) =>
  s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-");

/**
 * Chefkoch hängt oft den Nutzernamen an den Titel: „Knoblauch-Hähnchen … von DasperfekteDinner“, „… von Routinier“.
 * Entfernt wird „von X“ am Ende, wenn
 * - die Chefkoch-Adresse den Titel ohne „von X“ enthält (sicherstes Zeichen: `…/rezepte/123/Steak-mit-Rahmsauce.html`),
 * - X der Autor ist oder
 * - X wie ein Nutzername aussieht (Unterstrich, Ziffer, Großbuchstabe mitten im Wort, nur Kleinbuchstaben).
 * „Gulasch von Oma“ bleibt (steht so auch in der Adresse).
 */
export function stripAuthorSuffix(rawName: string, author = "", sourceUrl = ""): string {
  const m = rawName.match(/^(.*\S)\s+von\s+(\S+)$/);
  if (!m) return rawName;
  const [, title, who] = m;
  const slug = sourceUrl.match(/chefkoch\.de\/rezepte\/\d+\/([^/?#]+?)(?:\.html)?(?:[?#]|$)/i)?.[1]?.toLowerCase() ?? "";
  if (slug) return `-${slug}-`.includes(`-von-${slugify(who).replace(/^-+|-+$/g, "")}-`) ? rawName : title.trim();
  const isAuthor = !!author && who.toLowerCase() === author.toLowerCase();
  const looksLikeUser = /[_\d]/.test(who) || /^[a-zäöüß]/.test(who) || /[a-zäöüß][A-ZÄÖÜ]/.test(who);
  return isAuthor || looksLikeUser ? title.trim() : rawName;
}

export class ImportError extends Error {}

const MAX_HTML_BYTES = 3_000_000;

export async function importRecipeFromUrl(rawUrl: string): Promise<ImportedRecipe> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ImportError("Das ist kein gültiger Link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("Bitte einen Link mit https:// einfügen.");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9",
      },
      redirect: "follow",
    });
  } catch {
    throw new ImportError("Die Seite ist nicht erreichbar.");
  }
  if (res.status === 403 || res.status === 429) {
    throw new ImportError(`${url.hostname} hat den Abruf blockiert (${res.status}).`);
  }
  if (!res.ok) throw new ImportError(`Die Seite antwortet mit Fehler ${res.status}.`);

  const html = (await res.text()).slice(0, MAX_HTML_BYTES);
  const recipe = parseRecipeHtml(html, url.toString());
  if (!recipe) throw new ImportError("Auf der Seite wurde kein Rezept gefunden.");
  return recipe;
}

/** Rezept aus dem HTML einer Seite lesen (null, wenn keine Rezeptdaten enthalten sind) */
export function parseRecipeHtml(html: string, sourceUrl: string): ImportedRecipe | null {
  const node = findRecipeNode(html);
  if (!node) return null;

  // Chefkoch hängt den Autor an den Namen („Paprika-Hähnchen von Sister“) – für die Sammlung weglassen
  const author = clean(text((toArray(node.author)[0] as Json | undefined)?.name ?? toArray(node.author)[0]));
  const rawName = clean(text(node.name));
  const name = stripAuthorSuffix(rawName, author, sourceUrl);
  const rawIngredients = toArray(node.recipeIngredient ?? node.ingredients).map((i) => clean(text(i))).filter(Boolean);
  if (!name || rawIngredients.length === 0) return null;

  const sourcePortions = parseYield(node.recipeYield);
  const factor = sourcePortions ? RECIPE_BASE_PORTIONS / sourcePortions : 1;
  const ingredients = rawIngredients.map((i) => fixPlural(scaleIngredient(normalizeIngredient(i), factor)));

  const steps = parseInstructions(node.recipeInstructions);
  const durationMin =
    isoMinutes(node.totalTime) ?? sumOrNull(isoMinutes(node.prepTime), isoMinutes(node.cookTime));

  const base: Recipe = { name, type: "vegetarisch", ingredients, instructions: steps.join("\n"), durationMin };
  return { ...base, type: guessType(base), sourceUrl, sourcePortions };
}

export interface RecipeDetails {
  recipe: ImportedRecipe;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** Kategorie/Schlagwörter laut Quelle (z. B. „Hauptspeise“, „Kuchen“) */
  tags: string[];
  /** Zutaten in Originalmenge (Nachtische werden nicht umgerechnet) */
  originalIngredients: string[];
  /** Menge laut Quelle, z. B. „1 Kuchen“ oder „6 Portionen“ */
  yieldText: string | null;
}

/** Rezept plus Bild, Bewertung und Schlagwörter (für die Chefkoch-Suche) */
export function parseRecipeDetails(html: string, sourceUrl: string): RecipeDetails | null {
  const recipe = parseRecipeHtml(html, sourceUrl);
  const node = recipe && findRecipeNode(html);
  if (!recipe || !node) return null;
  // Bild: schema.org „image“ (Text, Liste oder ImageObject), sonst das Vorschaubild der Seite (og:image)
  const img = toArray(node.image)[0];
  const fromLd =
    typeof img === "string" ? img : img && typeof img === "object" ? text((img as Json).url ?? (img as Json).contentUrl) : "";
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  const imageUrl = [fromLd, og].map((u) => (u ?? "").replace(/^\/\//, "https://").replace(/^http:\/\//, "https://")).find((u) => /^https:\/\//.test(u)) ?? null;
  const agg = (node.aggregateRating ?? {}) as Json;
  const num = (v: unknown) => {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const tags = [...toArray(node.recipeCategory), ...String(text(node.keywords) || "").split(",")]
    .map((t) => clean(text(t)))
    .filter(Boolean);
  const originalIngredients = toArray(node.recipeIngredient ?? node.ingredients)
    .map((i) => clean(text(i)))
    .filter(Boolean)
    .map((i) => fixPlural(normalizeIngredient(i)));
  const y = clean(text(toArray(node.recipeYield).find((v) => /\D/.test(String(v))) ?? toArray(node.recipeYield)[0]));
  const yieldText = !y ? null : /^\d+([.,]\d+)?$/.test(y) ? `${y} Portionen` : y;
  return {
    recipe,
    imageUrl,
    originalIngredients,
    yieldText,
    rating: num(agg.ratingValue),
    ratingCount: num(agg.ratingCount ?? agg.reviewCount),
    tags: [...new Set(tags)].slice(0, 12),
  };
}

/** Lange Gerichte gehören aufs Wochenende, sonst nach Zutaten Fleisch/Fisch oder vegetarisch */
export function guessType(r: Recipe): Recipe["type"] {
  if ((r.durationMin ?? 0) > 75) return "wochenende";
  return looksMeaty(r) ? "fleisch" : "vegetarisch";
}

// ---------- JSON-LD ----------

type Json = Record<string, unknown>;

function findRecipeNode(html: string): Json | null {
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      // Manche Seiten haben Steuerzeichen in Strings
      try {
        // eslint-disable-next-line no-control-regex
        data = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, " "));
      } catch {
        continue;
      }
    }
    const found = searchRecipe(data);
    if (found) return found;
  }
  return null;
}

function searchRecipe(data: unknown, depth = 0): Json | null {
  if (!data || typeof data !== "object" || depth > 6) return null;
  if (Array.isArray(data)) {
    for (const d of data) {
      const f = searchRecipe(d, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const obj = data as Json;
  const type = obj["@type"];
  if ((Array.isArray(type) ? type : [type]).some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) return obj;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    const f = searchRecipe(obj[key], depth + 1);
    if (f) return f;
  }
  return null;
}

function parseInstructions(raw: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") {
      out.push(...v.split(/\r?\n+/));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (typeof v === "object") {
      const o = v as Json;
      if (o.itemListElement) walk(o.itemListElement); // HowToSection
      else walk(o.text ?? o.name);
    }
  };
  walk(raw);
  return out.map((s) => clean(s).replace(/^\d+[.)]\s*/, "")).filter((s) => s.length > 1);
}

/** "4 Portionen", ["4", "4 Stück"], 4 → 4 */
function parseYield(raw: unknown): number | null {
  for (const v of toArray(raw)) {
    const m = String(v).match(/\d+(?:[.,]\d+)?/);
    if (m) {
      const n = Number(m[0].replace(",", "."));
      if (n > 0 && n <= 50) return n;
    }
  }
  return null;
}

/** ISO-8601-Dauer wie "PT1H30M" oder "P0DT0H45M" in Minuten */
function isoMinutes(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/i);
  if (!m) return null;
  const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return min > 0 ? min : null;
}

function sumOrNull(a: number | null, b: number | null) {
  return a == null && b == null ? null : (a ?? 0) + (b ?? 0);
}

// ---------- Text ----------

function toArray(v: unknown): unknown[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "text" in v) return String((v as Json).text ?? "");
  return "";
}

const ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—",
};

/** HTML-Tags und -Entities entfernen, Leerraum zusammenfassen */
function clean(s: string): string {
  return s
    .normalize("NFC")
    // Weiche Trennzeichen und unsichtbare Zeichen stören die Erkennung („Hähn\u00adchen“)
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (e, n) => ENTITIES[n] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

const FRACTION_VALUE: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

/** Mengen umrechenbar machen: "1 1/2 Dosen" / "1½ Dosen" → "1,5 Dosen", "1 / 2 TL" → "1/2 TL" */
function normalizeIngredient(i: string): string {
  return i
    .replace(/\s+,/g, ",")
    .replace(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/, (_, w, a, b) => String(Number(w) + Number(a) / Number(b)).replace(".", ","))
    .replace(/^(\d+)\s*([½¼¾])/, (_, w, f) => String(Number(w) + FRACTION_VALUE[f]).replace(".", ","))
    .replace(/^(\d+)\s*\/\s*(\d+)/, "$1/$2");
}

/** Chefkoch-Schreibweise auflösen: "2 Zwiebel(n)" → "2 Zwiebeln", "1 Dose/n" → "1 Dose" */
function fixPlural(i: string): string {
  const m = i.match(/^(\d+(?:,\d+)?|[½¼¾])/);
  const many = m ? !/^[½¼¾]$/.test(m[1]) && Number(m[1].replace(",", ".")) > 1 : false;
  return i.replace(/(\p{L})(?:\((n|en|s|e|er)\)|\/(n|en|s|e|er))/gu, (_, c, a, b) => c + (many ? a ?? b : ""));
}
