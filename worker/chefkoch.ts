// Chefkoch-Suche: Ergebnisse kommen aus der strukturierten Liste (schema.org „ItemList“), die Chefkoch
// für Suchmaschinen in die Ergebnisseite schreibt – stabiler als den Seitenaufbau auszulesen.
// Vorbilder: get-chefkoch (Suche über ItemList) und python-chefkoch (Filter-Kennungen in der Such-Adresse).
// Die Rezepte selbst liest parseRecipeDetails (JSON-LD, wie beim Import per Link).
import { ImportError, parseRecipeDetails, type RecipeDetails } from "./recipeImport";

const BASE = "https://www.chefkoch.de";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "de-DE,de;q=0.9",
};
/** Wie lange Chefkoch-Seiten zwischengespeichert werden (Sekunden) */
const CACHE_SECONDS = 6 * 3600;
/** So viele Treffer werden mit Details (Bild, Bewertung, Zeit) geladen */
const RESULT_LIMIT = 12;

export interface ChefkochFilters {
  /** Nur Hauptspeisen */
  main?: boolean;
  /** Nur Desserts (statt Hauptspeisen) */
  dessert?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  /** Höchstens … Minuten Arbeitszeit (15, 30, 60, 120) */
  maxMinutes?: number | null;
  /** Mindestens 4 Sterne */
  topRated?: boolean;
  sort?: "relevance" | "rating" | "new";
}

export interface ChefkochHit {
  url: string;
  name: string;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  durationMin: number | null;
  type: "vegetarisch" | "fleisch" | "wochenende" | null;
}

// Kennungen aus Chefkochs Such-Adressen (siehe python-chefkoch)
const TAG_MAIN = "21";
const TAG_DESSERT = "90";
const TAG_VEGETARIAN = "32";
const TAG_VEGAN = "57";
const PREP_TIMES = [15, 30, 60, 120];
const SORT: Record<NonNullable<ChefkochFilters["sort"]>, string> = { relevance: "2", rating: "3", new: "6" };

/** Such-Adresse: /rs/s{Seite}t{Kennungen}p{Zeit}r{Bewertung}o{Sortierung}/{Suchbegriff}/Rezepte.html */
export function chefkochSearchUrl(query: string, f: ChefkochFilters = {}, page = 0): string {
  const tags = [f.dessert ? TAG_DESSERT : f.main ? TAG_MAIN : null, f.vegan ? TAG_VEGAN : f.vegetarian ? TAG_VEGETARIAN : null].filter(Boolean);
  const prep = f.maxMinutes ? PREP_TIMES.find((p) => p >= f.maxMinutes!) ?? "" : "";
  const rating = f.topRated ? "4" : "1";
  const sort = SORT[f.sort ?? "relevance"];
  const q = encodeURIComponent(query.trim().replace(/\s+/g, " ")).replace(/%20/g, "-");
  return `${BASE}/rs/s${page}t${tags.join(",")}p${prep}r${rating}o${sort}/${q}/Rezepte.html`;
}

/** Neueste Hauptspeisen ab 4,5 Sternen (wie https://www.chefkoch.de/rs/s0t21r4.5o6/Hauptspeise-Rezepte.html) */
export function newestTopMainUrl(page = 0): string {
  return `${BASE}/rs/s${Math.max(0, Math.floor(page))}t${TAG_MAIN}r4.5o${SORT.new}/Hauptspeise-Rezepte.html`;
}

/** Links einer Ergebnisseite (für die tägliche Automatik) */
export async function listRecipeUrls(searchUrl: string): Promise<string[]> {
  return parseSearchResults(await fetchPage(searchUrl));
}

/** Nur echte Chefkoch-Rezeptseiten zulassen (der Worker ruft sonst keine fremden Adressen ab) */
export function isChefkochRecipeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && /(^|\.)chefkoch\.de$/.test(u.hostname) && /^\/rezepte\/\d+\//.test(u.pathname);
  } catch {
    return false;
  }
}

/** Rezept-Links aus einer Ergebnisseite: zuerst aus der ItemList, sonst aus den Links der Seite */
export function parseSearchResults(html: string): string[] {
  const urls: string[] = [];
  const add = (u: unknown) => {
    if (typeof u !== "string") return;
    const clean = u.split(/[?#]/)[0];
    if (isChefkochRecipeUrl(clean) && !urls.includes(clean)) urls.push(clean);
  };
  const re = /<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const lists = (Array.isArray(data) ? data : [data]).flatMap((d) =>
      d && typeof d === "object" ? [d as Record<string, unknown>, ...((d as Record<string, unknown>)["@graph"] as unknown[] ?? [])] : []
    );
    for (const l of lists as Record<string, unknown>[]) {
      if (!l || !Array.isArray(l.itemListElement)) continue;
      for (const item of l.itemListElement as Record<string, unknown>[]) add(item?.url ?? (item?.item as Record<string, unknown>)?.url);
    }
  }
  if (urls.length === 0) {
    for (const m of html.matchAll(/href="(https:\/\/www\.chefkoch\.de\/rezepte\/\d+\/[^"]+\.html)/g)) add(m[1]);
  }
  return urls;
}

/** Name aus dem Link, falls ein Rezept nicht geladen werden konnte: „…/1234/Kuerbis-Risotto.html“ → „Kuerbis Risotto“ */
function nameFromUrl(url: string): string {
  const slug = url.split("/").pop()?.replace(/\.html$/, "") ?? "";
  return decodeURIComponent(slug).replace(/-/g, " ");
}

/** Chefkoch-Seite abrufen, über den Cloudflare-Cache (Suchen und Rezepte ändern sich selten) */
async function fetchPage(url: string): Promise<string> {
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;
  const key = new Request(url);
  const hit = await cache?.match(key);
  if (hit) return hit.text();

  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  } catch {
    throw new ImportError("Chefkoch ist gerade nicht erreichbar.");
  }
  if (res.status === 403 || res.status === 429) throw new ImportError(`Chefkoch hat den Abruf blockiert (${res.status}).`);
  if (res.status === 404) throw new ImportError("Dieses Rezept gibt es bei Chefkoch nicht mehr.");
  if (!res.ok) throw new ImportError(`Chefkoch antwortet mit Fehler ${res.status}.`);
  const html = (await res.text()).slice(0, 3_000_000);
  await cache?.put(key, new Response(html, { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}`, "Content-Type": "text/html" } }));
  return html;
}

/** Ein Chefkoch-Rezept mit allen Angaben (für Vorschau und Übernehmen) */
export async function loadChefkochRecipe(url: string): Promise<RecipeDetails> {
  if (!isChefkochRecipeUrl(url)) throw new ImportError("Das ist kein Chefkoch-Rezept.");
  const details = parseRecipeDetails(await fetchPage(url), url);
  if (!details) throw new ImportError("Das Rezept konnte nicht gelesen werden (evtl. nur mit Chefkoch-Plus-Konto).");
  return details;
}

/** Suchen und die ersten Treffer mit Bild, Bewertung und Zeit anreichern */
/** Wo die nächste Ladung weitergeht: Ergebnisseite bei Chefkoch und Position darauf */
export interface SearchCursor {
  page: number;
  index: number;
}

export async function searchChefkoch(
  query: string,
  filters: ChefkochFilters,
  cursor: SearchCursor = { page: 0, index: 0 }
): Promise<{ hits: ChefkochHit[]; next: SearchCursor | null }> {
  if (query.trim().length < 2) throw new ImportError("Bitte mindestens zwei Buchstaben eingeben.");
  const page = Math.max(0, Math.min(Math.floor(cursor.page), 50));
  const index = Math.max(0, Math.floor(cursor.index));
  const urls = parseSearchResults(await fetchPage(chefkochSearchUrl(query, filters, page)));
  const top = urls.slice(index, index + RESULT_LIMIT);
  // Rest dieser Ergebnisseite zuerst, danach die nächste Seite; keine Treffer mehr → Ende
  const next: SearchCursor | null =
    index + RESULT_LIMIT < urls.length ? { page, index: index + RESULT_LIMIT } : urls.length > 0 ? { page: page + 1, index: 0 } : null;
  const hits: ChefkochHit[] = [];
  // In kleinen Gruppen laden, damit Chefkoch nicht mit Anfragen überhäuft wird
  for (let i = 0; i < top.length; i += 4) {
    const group = await Promise.all(
      top.slice(i, i + 4).map(async (url): Promise<ChefkochHit | null> => {
        try {
          const d = parseRecipeDetails(await fetchPage(url), url);
          if (!d) return null; // Plus-Rezept oder ohne Zutaten
          return {
            url,
            name: d.recipe.name,
            imageUrl: d.imageUrl,
            rating: d.rating,
            ratingCount: d.ratingCount,
            durationMin: d.recipe.durationMin ?? null,
            type: d.recipe.type,
          };
        } catch {
          return { url, name: nameFromUrl(url), imageUrl: null, rating: null, ratingCount: null, durationMin: null, type: null };
        }
      })
    );
    hits.push(...(group.filter(Boolean) as ChefkochHit[]));
  }
  return { hits, next };
}
