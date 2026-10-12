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

/** Vorrat: kommt nicht auf die Einkaufsliste, sondern unter „Basics & Vorrat" */
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

function parse(text: string): Parsed {
  const t = text.trim();
  const m = t.match(QTY_RE);
  if (!m) return { qty: null, unit: "", name: t };
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

function isPantry(name: string): boolean {
  const words = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  if (words.some((w) => w.startsWith("frisch"))) return false;
  return words.every((w) => PANTRY_WORDS.has(w));
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
  /** Vorrats-Zutaten, die der Plan braucht (für die Markierung bei Basics) */
  pantryNeeded: string[];
}

/** extraPantry: eigene Vorrats-Zutaten der Familie (als mergeKey) */
export function buildPlanItems(
  mealIngredients: string[][],
  portions: number,
  extraPantry: Set<string> = new Set(),
  /** Zutaten mit fester Menge (Nachtische), nicht auf die Portionen umgerechnet */
  unscaledIngredients: string[][] = []
): BuildResult {
  const agg = new Map<string, { name: string; unit: string; qty: number | null; count: number }>();
  const pantry = new Set<string>();

  const lists = [
    ...mealIngredients.map((ingredients) => ({ ingredients, factor: portions / RECIPE_BASE_PORTIONS })),
    ...unscaledIngredients.map((ingredients) => ({ ingredients, factor: 1 })),
  ];
  for (const { ingredients, factor } of lists) {
    for (const raw of ingredients) {
      for (const part of splitCombined(raw)) {
        const p = parse(part.replace(/^optional:\s*/i, ""));
        if (!p.name) continue;
        if (isPantry(p.name) || extraPantry.has(mergeKey(p.name))) {
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
