// Ernährungs-Schwerpunkte (mehrere gleichzeitig): schließen nichts aus, geben passenden Gerichten Pluspunkte.
// Heuristik auf Zutatentext – wie die Gesundheitsfilter keine Ernährungsberatung.
import type { Recipe } from "./meals";
import { seasonalWords } from "../src/lib/season";

export { seasonalWords };

export const FOCUS_IDS = [
  "calorie_light",
  "high_protein",
  "low_carb",
  "veggie_rich",
  "whole_grain",
  "kid_friendly",
  "seasonal",
  "budget",
] as const;
export type Focus = (typeof FOCUS_IDS)[number];

/** Für den KI-Prompt */
export const FOCUS_PROMPT: Record<Focus, string> = {
  calorie_light: "kalorienbewusst (leicht statt schwer/fettig)",
  high_protein: "proteinreich",
  low_carb: "wenig Kohlenhydrate (kaum Nudeln, Reis, Kartoffeln, Brot)",
  veggie_rich: "viel Gemüse",
  whole_grain: "Vollkorn und Ballaststoffe (Hülsenfrüchte, Vollkorn, Quinoa)",
  kid_friendly: "kinderfreundlich (nicht scharf, eher bekannte Zutaten)",
  seasonal: "saisonale Zutaten aus Deutschland",
  budget: "günstige Zutaten",
};

const has = (text: string, re: RegExp) => re.test(text);
const count = (text: string, words: string[]) => words.filter((w) => text.includes(w)).length;

const RICH_RE = /sahne|butter|käse|speck|pancetta|frittier|mayonnaise|crème|mascarpone|schmand/;
const PROTEIN_RE = /hähnchen|pute|rind|lachs|thunfisch|fisch|kabeljau|tofu|tempeh|linsen|kichererbsen|bohnen|quark|skyr|\beier?\b|hüttenkäse|garnele|hack/;
const CARB_RE = /nudel|spaghetti|pasta|penne|fusilli|tagliatelle|reis|kartoffel|brot|baguette|brötchen|tortilla|wrap|couscous|bulgur|gnocchi|knödel|klöße|pizza|spätzle|lasagne|polenta|teig|fladen/;
const VEGGIES = [
  "gemüse", "brokkoli", "paprika", "zucchini", "karotte", "möhre", "spinat", "tomate", "aubergine", "kürbis", "kohl",
  "erbsen", "bohnen", "lauch", "porree", "pilz", "champignon", "linsen", "mangold", "fenchel", "sellerie", "spargel",
  "rote bete", "salat", "gurke", "pastinake", "süßkartoffel", "mais", "rucola", "kichererbsen",
];
const WHOLE_RE = /vollkorn|hafer|quinoa|linsen|kichererbsen|bohnen|bulgur|naturreis|buchweizen|dinkel|grünkern|hirse|leinsamen/;
const SPICY_RE = /chili|jalapeñ|jalapen|cayenne|harissa|sambal|sriracha|scharf|habanero|chipotle|wasabi|currypaste|peperoni/;
const CHEAP = ["linsen", "bohnen", "kichererbsen", "kartoffel", "hack", "nudel", "spaghetti", "reis", "eier", "kohl", "möhre", "karotte", "zwiebel", "haferflocken", "quark", "erbsen"];
const PRICEY_RE = /lachs|garnele|scampi|filet|steak|lamm|pinienkern|parmesan|trüffel|entrecôte|jakobsmuschel|ente\b|entenbrust|kalb|wildlachs|serrano|parmaschinken/;


/** Pluspunkte (oder Abzug) für die gewählten Schwerpunkte; month = 1–12 (für „saisonal“) */
export function focusScore(meal: Recipe, focus: string[], month?: number): number {
  if (!focus.length) return 0;
  const text = [meal.name, ...meal.ingredients].join(" | ").toLowerCase();
  let score = 0;
  for (const f of focus) {
    switch (f) {
      case "calorie_light":
        if (meal.type === "vegetarisch") score += 6;
        if (has(text, RICH_RE)) score -= 8;
        break;
      case "high_protein":
        if (has(text, PROTEIN_RE)) score += 10;
        break;
      case "low_carb":
        score += has(text, CARB_RE) ? -12 : 8;
        break;
      case "veggie_rich": {
        const n = count(text, VEGGIES);
        score += n >= 4 ? 12 : n >= 2 ? 5 : -4;
        break;
      }
      case "whole_grain":
        if (has(text, WHOLE_RE)) score += 10;
        break;
      case "kid_friendly":
        if (has(text, SPICY_RE)) score -= 15;
        else if (meal.ingredients.length <= 10 && (meal.durationMin ?? 30) <= 40) score += 5;
        break;
      case "seasonal": {
        if (!month) break;
        const n = count(text, seasonalWords(month));
        score += n >= 2 ? 12 : n === 1 ? 6 : 0;
        break;
      }
      case "budget":
        if (count(text, CHEAP) >= 2) score += 8;
        if (has(text, PRICEY_RE)) score -= 10;
        break;
    }
  }
  return score;
}

// ---------- Fleisch-Grenze pro Woche ----------

/** Fleisch (ohne Fisch) – für „Fleisch höchstens X-mal pro Woche“ */
const MEAT_ONLY_RE =
  /hackfleisch|\bhack\b|hähnchen|huhn|hühnchen|pute|kalb|speck|schinken|wurst|würstchen|leberkäse|guanciale|pancetta|kassler|rindfleisch|schweinefleisch|lammfleisch|rippchen|schwein|\brind|\blamm|schnitzel|(?<!ge)braten|bacon|chorizo|salami|gulasch|frikadelle|bulette|cevapcici|gyros|ente\b|entenbrust/i;

export function isMeatDish(meal: Recipe): boolean {
  return MEAT_ONLY_RE.test(meal.name) || meal.ingredients.some((i) => MEAT_ONLY_RE.test(i));
}

/** ISO-Kalenderwoche eines Datums (YYYY-MM-DD) als Schlüssel, z. B. „2026-W42“ */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}
