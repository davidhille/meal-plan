// Abneigungen beim Planen: was ausgeschlossen wird und was nur Abzug bekommt
// - Familien-Nein (profiles.family_dislikes, z. B. „fisch“): schließt immer aus
// - Abneigung einzelner Familienmitglieder: schließt aus, wenn die Mehrheit sie teilt, sonst nur Abzug (scoreMeal)
// Die Hauptzutat-Muster entsprechen src/lib/recipeCategories.ts (Fleisch- und Fischgruppen).

interface DishText {
  name: string;
  ingredients: string[];
}

/** Würzzutaten, die keine Hauptzutat sind (Fischsauce, Brühe …) */
const SEASONING = /brühe|fond\b|bouillon|fischsauce|fischsoße|austernsauce|stärke|gewürz/;
const MIXED_MINCE = /(?<![a-zäöüß])hack(?!e\b)|gehacktes/;
const FISH = /fisch|lachs|kabeljau|thunfisch|forelle|dorade|sardine|makrele|hering|scholle|zander|seelachs|seehecht|barsch|heilbutt|seeteufel|pangasius|tilapia|dorsch|steinbutt|karpfen|saibling|sardelle|loup de mer/;
const SEAFOOD = /garnele|shrimp|scampi|muschel|krabbe|hummer|tintenfisch|calamari|gambas|meeresfrüchte/;

export const FAMILY_DISLIKE_GROUPS: Record<string, { label: string; name: RegExp; ingredient: RegExp }> = {
  fisch: { label: "Fisch", name: new RegExp(`${FISH.source}|backfisch`), ingredient: FISH },
  meeresfruechte: { label: "Meeresfrüchte", name: SEAFOOD, ingredient: SEAFOOD },
  lamm: { label: "Lamm", name: /(?<![a-zäöüß])lamm|\blamb/, ingredient: /(?<![a-zäöüß])lamm/ },
  schwein: {
    label: "Schwein",
    name: /schwein|pork|kassler|kasseler|speck|schinken|wurst|würstchen|würste|leberkäse|spare ?ribs|carbonara|haxe|mett|chorizo/,
    ingredient: new RegExp(
      `schwein|pork|kassler|kasseler|speck|schinken|bacon|pancetta|guanciale|chorizo|salami|wurst|würstchen|würste|wiener|mett\\b|${MIXED_MINCE.source}`
    ),
  },
  rind: {
    label: "Rind",
    name: /\brind|beef|bœuf|boeuf|roulade|tafelspitz|chili con carne/,
    ingredient: new RegExp(`\\brind|rinder|beef|roastbeef|tafelspitz|rumpsteak|hüftsteak|entrecote|${MIXED_MINCE.source}`),
  },
  gefluegel: {
    label: "Geflügel",
    name: /hähnchen|huhn|hühner|pute|chicken|geflügel|\bente\b|entenbrust|coq au vin|nugget/,
    ingredient: /hähnchen|huhn|hühner|pute|chicken|geflügel|\bente\b|entenbrust|entenkeule/,
  },
};

export const FAMILY_DISLIKE_IDS = Object.keys(FAMILY_DISLIKE_GROUPS);

/** Gehört das Gericht zu dieser Hauptzutat? (Name oder Zutat, Würzzutaten zählen nicht; Gemüse-„Bratwurst“ ist keine Wurst) */
export function matchesDislikeGroup(dish: DishText, id: string): boolean {
  const g = FAMILY_DISLIKE_GROUPS[id];
  if (!g) return false;
  const name = dish.name.toLowerCase();
  if (g.name.test(name) && !(id === "schwein" && /gemüse|vegan|vegetar/.test(name))) return true;
  return dish.ingredients.some((i) => {
    const t = i.toLowerCase();
    return !SEASONING.test(t) && !/vegan|vegetar|veggie/.test(t) && g.ingredient.test(t);
  });
}

/**
 * Wird das Gericht beim Planen ausgeschlossen?
 * `memberMatches(term)` prüft eine einzelne Abneigung (dislikeMatches aus meals.ts – vermeidet einen Import-Kreis).
 */
export function excludedByDislikes(
  dish: DishText,
  familyDislikes: string[] | undefined,
  members: { disliked_foods: string[] | null }[],
  memberMatches: (term: string) => boolean
): boolean {
  if ((familyDislikes ?? []).some((id) => matchesDislikeGroup(dish, id))) return true;
  if (!members.length) return false;
  const against = members.filter((m) => (m.disliked_foods ?? []).some((d) => memberMatches(d))).length;
  return against > members.length / 2;
}
