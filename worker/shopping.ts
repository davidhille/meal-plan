// Einkaufsliste aus den Gerichten eines Plans berechnen:
// Zutaten zerlegen, auf Familienportionen umrechnen, gleiche Zutaten zusammenfassen,
// Vorrats-Zutaten (Salz, Gewürze, Öl …) aussortieren.

export const RECIPE_BASE_PORTIONS = 4;

export function familyPortions(members: { type: string; age: number | null }[]): number {
  if (members.length === 0) return RECIPE_BASE_PORTIONS;
  const sum = members.reduce((acc, m) => {
    if (m.type === "adult") return acc + 1;
    const age = m.age ?? 8;
    return acc + (age <= 6 ? 0.5 : age <= 12 ? 0.75 : 1);
  }, 0);
  return Math.max(1, Math.round(sum * 2) / 2);
}

/** Vorrat: kommt nicht auf die Einkaufsliste, sondern steht unter „Vorrat“ */
const PANTRY_WORDS = new Set([
  "salz", "pfeffer", "zucker", "öl", "olivenöl", "sonnenblumenöl", "rapsöl", "sesamöl", "mehl", "essig",
  "senf", "ketchup", "mayonnaise", "sojasoße", "sojasauce", "worcestershire", "worcestershiresoße",
  "oregano", "thymian", "rosmarin", "paprikapulver", "cayenne", "cayennepfeffer", "kreuzkümmel", "kurkuma",
  "muskat", "muskatnuss", "chiliflocken", "lorbeer", "lorbeerblatt", "lorbeerblätter", "knoblauchpulver",
  "zimt", "currypulver", "gemüsebrühe", "brühe", "tomatenmark", "dill", "schnittlauch",
  "garam", "masala", "chilipulver", "chili-pulver", "ingwerpulver", "koriandersamen", "gemahlener", "kardamom",
  "nelken", "piment", "majoran", "basilikum", "kräuter", "provence", "italienische", "gewürzmischung", "vanillezucker",
  "backpulver", "natron", "speisestärke", "balsamico", "zitronensaft", "honig", "ahornsirup",
  // Füllwörter in Gewürz-Angaben
  "schwarzer", "schwarz", "gemahlen", "gemahlener", "getrocknet", "getrockneter", "getrocknete", "getrocknetes", "edelsüß",
  "rosenscharf", "prise", "etwas", "nach", "geschmack", "frisch", "gemahlenes",
]);
/**
 * Standard-Vorrat, wie er unter „Vorrat“ angezeigt wird (jeder Eintrag ist ein Wort aus PANTRY_WORDS).
 * Die Familie kann Einträge herausnehmen (pantry_items.excluded) – dann kommen sie bei Bedarf wieder auf die Liste.
 */
export const DEFAULT_PANTRY = [
  "Salz", "Pfeffer", "Zucker", "Mehl", "Öl", "Olivenöl", "Sonnenblumenöl", "Rapsöl", "Essig", "Balsamico", "Senf", "Ketchup",
  "Mayonnaise", "Sojasoße", "Worcestershiresoße", "Gemüsebrühe", "Tomatenmark", "Honig", "Zitronensaft", "Speisestärke",
  "Backpulver", "Natron", "Vanillezucker", "Paprikapulver", "Oregano", "Basilikum", "Thymian", "Rosmarin", "Majoran",
  "Lorbeerblätter", "Cayennepfeffer", "Chiliflocken", "Chilipulver", "Kreuzkümmel", "Kurkuma", "Currypulver", "Zimt",
  "Muskatnuss", "Kardamom", "Nelken", "Piment",
];

// „frisch" steht oben nur, damit es bei z. B. „frisch gemahlener Pfeffer" nicht stört –
// frische Kräuter/Zutaten bleiben trotzdem auf der Liste (siehe isPantry).

const MEAT_RE = /(hack|hähnchen|huhn|hühn|pute|kalb|kassler|leberkäse|rinder|rind\b|schwein|\blamm|speck|schnitzel|braten|rippe|rippchen|wurst|würst|kotelett|gulasch|bacon|chorizo|salami)/i;
const NOT_MEAT_RE = /brühe|fond|bouillon/i;

const QTY_RE = /^(\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾])\s*(.*)$/;
const UNIT_RE = /^(kg|g|ml|l|el|tl|dosen?|gläser|glas|bund|packungen?|pck\.?|stücke?|stück|prisen?|zehen?|scheiben|becher|tassen?)\b\.?\s*/i;
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

export interface PlanItem {
  key: string;
  baseName: string;
  display: string;
  defaultLabel: string;
}

interface Parsed {
  qty: number | null;
  unit: string; // normalisiert: g, ml, el, tl, dose, … oder ""
  name: string;
}

function parseQty(raw: string): number {
  if (raw in FRACTIONS) return FRACTIONS[raw];
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    return b ? a / b : NaN;
  }
  return Number(raw.replace(",", "."));
}

function normUnit(u: string): string {
  const x = u.toLowerCase().replace(/\.$/, "");
  if (x === "dosen") return "dose";
  if (x === "gläser") return "glas";
  if (x.startsWith("packung") || x === "pck") return "packung";
  if (x.startsWith("stück")) return "stück";
  if (x.startsWith("prise")) return "prise";
  if (x.startsWith("zehe")) return "zehe";
  if (x.startsWith("tasse")) return "tasse";
  return x;
}

/** Menge in Klammern hinter dem Namen: „Knoblauch (2 Zehen)“, „Reis (ca. 250 g)“, „Paprika (1 rote oder gelbe)“ */
const PAREN_QTY_RE = /\(\s*(?:ca\.?\s*)?(\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾])\s*([^)]*)\)/;

/** Gleiche Zutat, andere Schreibweise: „2 Knoblauchzehen“ = „2 Zehen Knoblauch“, „Paprikaschoten“ = „Paprika“ */
function normalizeName(p: Parsed): Parsed {
  if (/^knoblauchzehen?\b/i.test(p.name)) {
    return { qty: p.qty, unit: p.unit || (p.qty !== null ? "zehe" : ""), name: p.name.replace(/^knoblauchzehen?/i, "Knoblauch").trim() };
  }
  if (/^paprikaschoten?\b/i.test(p.name)) return { ...p, name: p.name.replace(/^paprikaschoten?/i, "Paprika").trim() };
  return p;
}

function parse(text: string): Parsed {
  return normalizeName(parseRaw(text));
}

function parseRaw(text: string): Parsed {
  const t = text.trim();
  const m = t.match(QTY_RE);
  if (!m) {
    const pm = t.match(PAREN_QTY_RE);
    const qty = pm ? parseQty(pm[1]) : NaN;
    if (!pm || !Number.isFinite(qty)) return { qty: null, unit: "", name: t };
    const u = pm[2].trim().match(UNIT_RE);
    let unit = u ? normUnit(u[1]) : "";
    let q = qty;
    if (unit === "kg") { q *= 1000; unit = "g"; }
    if (unit === "l") { q *= 1000; unit = "ml"; }
    return { qty: q, unit, name: t.replace(pm[0], " ").replace(/\s+/g, " ").trim() };
  }
  let qty = parseQty(m[1]);
  let rest = m[2];
  let unit = "";
  const u = rest.match(UNIT_RE);
  if (u) {
    unit = normUnit(u[1]);
    rest = rest.slice(u[0].length);
  }
  if (unit === "kg") { qty *= 1000; unit = "g"; }
  if (unit === "l") { qty *= 1000; unit = "ml"; }
  return { qty: Number.isFinite(qty) ? qty : null, unit, name: rest.trim() };
}

const nameWords = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[\s,/]+/)
    .filter(Boolean);

/** Standard-Vorrat? excluded = Wörter, die die Familie aus dem Vorrat genommen hat */
export function isPantry(name: string, excluded: Set<string> = new Set()): boolean {
  const words = nameWords(name);
  if (words.length === 0) return false;
  if (words.some((w) => w.startsWith("frisch") || excluded.has(w))) return false;
  return words.every((w) => PANTRY_WORDS.has(w));
}

export interface PantryEntry {
  name: string;
  /** Der Plan braucht es (gelb markiert) */
  needed: boolean;
  /** default = Standard-Vorrat, custom = eigener Eintrag, plan = vom Plan gebraucht, aber kein Eintrag in der Liste */
  kind: "default" | "custom" | "plan";
}

/**
 * Vorrat für die Anzeige: Standard-Einträge (ohne herausgenommene) und eigene, dazu Vorrats-Zutaten aus dem Plan,
 * die zu keinem Eintrag passen. Gebrauchte zuerst.
 */
export function pantryOverview(pantryNeeded: string[], custom: string[], excluded: Set<string>): PantryEntry[] {
  const neededWords = pantryNeeded.map((n) => ({ name: n, words: nameWords(n), key: mergeKey(n) }));
  const covered = new Set<string>();
  const entries: PantryEntry[] = [];
  for (const d of DEFAULT_PANTRY) {
    const w = d.toLowerCase();
    if (excluded.has(w)) continue;
    const hits = neededWords.filter((n) => n.words.includes(w));
    hits.forEach((h) => covered.add(h.name));
    entries.push({ name: d, needed: hits.length > 0, kind: "default" });
  }
  const defaultKeys = new Set(DEFAULT_PANTRY.map(mergeKey));
  for (const c of custom) {
    const key = mergeKey(c);
    // Schon Standard-Vorrat (z. B. früher selbst angelegtes „Zucker“) – nicht doppelt zeigen
    if (defaultKeys.has(key) && !excluded.has(c.toLowerCase())) continue;
    const hits = neededWords.filter((n) => n.key === key);
    hits.forEach((h) => covered.add(h.name));
    entries.push({ name: c, needed: hits.length > 0, kind: "custom" });
  }
  for (const n of pantryNeeded) if (!covered.has(n)) entries.push({ name: n, needed: true, kind: "plan" });
  return entries.sort((a, b) => Number(b.needed) - Number(a.needed) || a.name.localeCompare(b.name, "de"));
}

/** „Salz, Pfeffer, Petersilie" → drei Einträge (nur ohne Mengenangabe) */
function splitCombined(text: string): string[] {
  if (QTY_RE.test(text.trim())) return [text];
  return text.split(/,|\bund\b/).map((s) => s.trim()).filter(Boolean);
}

/** Schlüssel für das Zusammenfassen: ohne Klammern, Singular/Plural grob vereinheitlicht */
export function mergeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 4 ? w.replace(/(en|n|e|s)$/, "") : w))
    .join(" ");
}

/** Einheiten, die man nur ganz kauft → aufrunden */
const WHOLE_UNITS = new Set(["", "dose", "glas", "packung", "stück", "bund", "becher", "zehe", "scheiben"]);

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAmount(qty: number, unit: string): string {
  const half = (v: number) => {
    const r = Math.max(0.5, Math.round(v * 2) / 2);
    return r === 0.5 ? "½" : String(r).replace(".", ",");
  };
  const whole = (v: number) => Math.max(1, Math.ceil(v - 0.05));
  if (unit === "g" || unit === "ml") {
    if (qty >= 1000) {
      const big = Math.round(qty / 100) / 10;
      return `${String(big).replace(".", ",")} ${unit === "g" ? "kg" : "l"}`;
    }
    const r = qty >= 100 ? Math.round(qty / 25) * 25 : Math.max(5, Math.round(qty / 5) * 5);
    return `${r} ${unit}`;
  }
  if (WHOLE_UNITS.has(unit)) {
    const n = whole(qty);
    const labels: Record<string, [string, string]> = {
      dose: ["Dose", "Dosen"], glas: ["Glas", "Gläser"], packung: ["Pck.", "Pck."], stück: ["Stück", "Stück"],
      bund: ["Bund", "Bund"], becher: ["Becher", "Becher"], zehe: ["Zehe", "Zehen"], scheiben: ["Scheibe", "Scheiben"],
    };
    return unit ? `${n} ${labels[unit][n === 1 ? 0 : 1]}` : String(n);
  }
  const unitLabel: Record<string, string> = { el: "EL", tl: "TL", prise: "Prise", tasse: "Tasse(n)" };
  return `${half(qty)} ${unitLabel[unit] ?? unit}`;
}

export interface BuildResult {
  items: PlanItem[];
  /** Vorrats-Zutaten, die der Plan braucht (gelb markiert unter „Vorrat“) */
  pantryNeeded: string[];
}

/** extraPantry: eigene Vorrats-Zutaten der Familie (als mergeKey) */
export function buildPlanItems(
  mealIngredients: string[][],
  portions: number,
  extraPantry: Set<string> = new Set(),
  /** Zutaten mit fester Menge (Nachtische), nicht auf die Portionen umgerechnet */
  unscaledIngredients: string[][] = [],
  /** Aus dem Standard-Vorrat genommene Wörter (kommen wieder auf die Liste) */
  excludedPantry: Set<string> = new Set(),
  /** Zusätzliche Portionen je Gericht (Gäste), gleiche Reihenfolge wie mealIngredients */
  guests: number[] = []
): BuildResult {
  const agg = new Map<string, { name: string; unit: string; qty: number | null; count: number }>();
  const pantry = new Set<string>();

  const lists = [
    ...mealIngredients.map((ingredients, i) => ({ ingredients, factor: (portions + (guests[i] ?? 0)) / RECIPE_BASE_PORTIONS })),
    ...unscaledIngredients.map((ingredients) => ({ ingredients, factor: 1 })),
  ];
  for (const { ingredients, factor } of lists) {
    for (const raw of ingredients) {
      for (const part of splitCombined(raw)) {
        const p = parse(part.replace(/^optional:\s*/i, ""));
        if (!p.name) continue;
        if (isPantry(p.name, excludedPantry) || extraPantry.has(mergeKey(p.name))) {
          pantry.add(cap(p.name.replace(/\(.*?\)/g, "").trim()));
          continue;
        }
        const key = `${mergeKey(p.name)}|${p.qty === null ? "-" : p.unit}`;
        const prev = agg.get(key);
        if (prev) {
          if (prev.qty !== null && p.qty !== null) prev.qty += p.qty * factor;
          prev.count++;
          if (p.name.length > prev.name.length) prev.name = p.name; // Plural bevorzugen
        } else {
          agg.set(key, { name: p.name, unit: p.unit, qty: p.qty === null ? null : p.qty * factor, count: 1 });
        }
      }
    }
  }

  const items: PlanItem[] = [];
  for (const [key, a] of agg) {
    const name = cap(a.name);
    const display = a.qty === null ? (a.count > 1 ? `${name} (${a.count}×)` : name) : `${formatAmount(a.qty, a.unit)} ${name}`;
    const defaultLabel = MEAT_RE.test(a.name) && !NOT_MEAT_RE.test(a.name) ? "metzger" : "knuspr";
    items.push({ key, baseName: name, display, defaultLabel });
  }
  items.sort((x, y) => x.baseName.localeCompare(y.baseName, "de"));
  return { items, pantryNeeded: [...pantry].sort((x, y) => x.localeCompare(y, "de")) };
}
