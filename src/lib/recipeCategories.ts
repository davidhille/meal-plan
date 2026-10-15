// Feste Filter für die Rezept-Übersicht: Speiseart (aus dem Namen) und Hauptzutat (Name/Zutaten).
// Reine Heuristik auf dem Text – Gerichte können in mehreren Gruppen landen. Fehler lassen sich pro Gericht
// korrigieren (CategoryOverrides, gespeichert in recipe_category_overrides).

interface RecipeText {
  name: string;
  ingredients: string[];
}

export interface RecipeCategory {
  id: string;
  label: string;
  /** Trifft auf den Gerichtnamen zu */
  name: RegExp;
  /** Trifft auf eine Zutat zu (ohne: nur der Name zählt) */
  ingredient?: RegExp;
}

/** Zutaten, die nur würzen (Hühnerbrühe, Fischsauce, Kartoffelstärke …) – zählen nicht als Hauptzutat */
const SEASONING = /brühe|fond\b|bouillon|fischsauce|fischsoße|austernsauce|stärke|gewürz/;

const PASTA =
  /spaghetti|pasta|nudel|penne|tagliatelle|fusilli|rigatoni|linguine|farfalle|lasagne|ravioli|tortellini|makkaroni|maccheroni|orecchiette|pappardelle|tortelloni/;
/** Hackfleisch ohne Angabe (oder gemischt) zählt zu Rind und Schwein; „Rinderhack“ usw. nur zu einem */
const MIXED_MINCE = /(?<![a-zäöüß])hack(?!e\b)|gehacktes/;

export const DISH_KINDS: RecipeCategory[] = [
  { id: 'auflauf', label: 'Auflauf', name: /auflauf|gratin|lasagne|überbacken|moussaka|ofenpasta|ofen-/ },
  { id: 'eintopf', label: 'Eintopf', name: /eintopf|gulasch|chili|ragout|ragù|stew|schmortopf|topf\b|cassoulet/ },
  { id: 'suppe', label: 'Suppe', name: /suppe|brühe|bouillon|ramen|\bpho\b|minestrone|consommé|bisque/ },
  { id: 'pasta', label: 'Pasta', name: PASTA },
  { id: 'pizza', label: 'Pizza', name: /pizza|flammkuchen|calzone|focaccia/ },
  { id: 'salat', label: 'Salat', name: /salat|bowl/ },
  { id: 'curry', label: 'Curry', name: /curry|\bdal\b|dhal|masala|korma|tikka/ },
  { id: 'pfanne', label: 'Pfanne & Wok', name: /pfanne|\bwok\b|bratreis|bratnudeln|gebratene nudeln|stir/ },
  { id: 'burger', label: 'Burger & Wraps', name: /burger|wrap|taco|burrito|quesadilla|döner|gyros|sandwich|fajita/ },
  { id: 'braten', label: 'Braten & Schnitzel', name: /(?<!ge)braten|schnitzel|roulade|steak|kotelett|frikadelle|bulette|cordon bleu/ },
  { id: 'eier', label: 'Eierspeise', name: /omelett|rührei|frittata|spiegelei|shakshuka|quiche|tortilla española/ },
  {
    id: 'mehlspeise',
    label: 'Mehlspeisen',
    name: /spätzle|knödel|klöße|kloß|pfannkuchen|maultasche|schupfnudel|dampfnudel|kaiserschmarrn|crêpe|pancake|gnocchi/,
  },
];

export const MAIN_INGREDIENTS: RecipeCategory[] = [
  { id: 'nudeln', label: 'Nudeln', name: PASTA, ingredient: PASTA },
  {
    id: 'reis',
    label: 'Reis',
    name: /\breis\b|risotto|paella|bratreis|biryani|jambalaya/,
    ingredient: /\breis\b|risotto|basmati|jasminreis|langkornreis|milchreis/,
  },
  { id: 'kartoffeln', label: 'Kartoffeln', name: /kartoffel|rösti|pommes|püree|bratkartoffel/, ingredient: /kartoffel/ },
  {
    id: 'gefluegel',
    label: 'Geflügel',
    name: /hähnchen|huhn|hühner|pute|chicken|geflügel|\bente\b|entenbrust|coq au vin|nugget/,
    ingredient: /hähnchen|huhn|hühner|pute|chicken|geflügel|\bente\b|entenbrust|entenkeule/,
  },
  {
    id: 'rind',
    label: 'Rind',
    name: /\brind|beef|bœuf|boeuf|(?<!fisch|lachs|thunfisch|blumenkohl|sellerie|kohl|schweine|puten|hähnchen)steak|roulade|tafelspitz|chili con carne/,
    ingredient: new RegExp(`\\brind|rinder|beef|roastbeef|tafelspitz|rumpsteak|hüftsteak|entrecote|${MIXED_MINCE.source}`),
  },
  {
    id: 'schwein',
    label: 'Schwein',
    name: /schwein|pork|kassler|kasseler|speck|schinken|wurst|würstchen|würste|leberkäse|spare ?ribs|carbonara|haxe|mett/,
    ingredient: new RegExp(
      `schwein|pork|kassler|kasseler|speck|schinken|bacon|pancetta|guanciale|chorizo|salami|wurst|würstchen|würste|wiener|mett\\b|${MIXED_MINCE.source}`
    ),
  },
  // „Flammkuchen“ enthält auch „lamm“
  { id: 'lamm', label: 'Lamm', name: /(?<![a-zäöüß])lamm|\blamb/, ingredient: /(?<![a-zäöüß])lamm/ },
  {
    id: 'fisch',
    label: 'Fisch',
    name: /fisch|lachs|kabeljau|thunfisch|forelle|dorade|sardine|makrele|hering|scholle|zander|seelachs|barsch|heilbutt|seeteufel|pangasius|tilapia|dorsch|steinbutt|karpfen|saibling|sardelle|backfisch/,
    ingredient: /fisch|lachs|kabeljau|thunfisch|forelle|dorade|sardine|makrele|hering|scholle|zander|seelachs|barsch|heilbutt|seeteufel|pangasius|tilapia|dorsch|steinbutt|karpfen|saibling|sardelle/,
  },
  {
    id: 'krustentiere',
    label: 'Krustentiere & Muscheln',
    name: /garnele|shrimp|scampi|muschel|krabbe|hummer|tintenfisch|calamari|gambas|meeresfrüchte/,
    ingredient: /garnele|shrimp|scampi|muschel|krabbe|hummer|tintenfisch|calamari|gambas|meeresfrüchte/,
  },
  {
    id: 'gemuese',
    label: 'Gemüse',
    name: /gemüse|zucchini|aubergine|paprika|brokkoli|blumenkohl|spinat|kürbis|möhre|karotte|kohl|spargel|pilz|champignon|tomate|lauch|fenchel|rote bete|süßkartoffel|ratatouille|erbsen/,
  },
  {
    id: 'huelsenfruechte',
    label: 'Hülsenfrüchte',
    name: /linse|bohne|kichererbse|\bdal\b|dhal|falafel|hummus/,
    ingredient: /linse|bohne|kichererbse/,
  },
  { id: 'kaese', label: 'Käse', name: /käse|feta|mozzarella|halloumi|camembert|gorgonzola|raclette|fondue|parmesan|cheese|burrata/ },
];

export const ALL_CATEGORIES = [...DISH_KINDS, ...MAIN_INGREDIENTS];

/** Was die App von sich aus erkennt (ohne Korrekturen) */
export function matchesCategory(c: RecipeCategory, r: RecipeText): boolean {
  if (c.name.test(r.name.toLowerCase())) return true;
  if (!c.ingredient) return false;
  return r.ingredients.some((i) => {
    const t = i.toLowerCase();
    return !SEASONING.test(t) && c.ingredient!.test(t);
  });
}

/** Korrekturen von Hand: Gerichtname → Kategorie → dabei (true) bzw. nicht dabei (false) */
export type CategoryOverrides = Record<string, Record<string, boolean>>;

export interface CategoryOverride {
  name: string;
  categoryId: string;
  included: boolean;
}

export const toOverrideMap = (list: CategoryOverride[]): CategoryOverrides => {
  const map: CategoryOverrides = {};
  for (const o of list) (map[o.name] ??= {})[o.categoryId] = o.included;
  return map;
};

/** Gehört ein Gericht zur Kategorie? Korrektur von Hand geht vor der Erkennung. */
export function inCategory(c: RecipeCategory, r: RecipeText, overrides?: CategoryOverrides): boolean {
  const own = overrides?.[r.name]?.[c.id];
  return own ?? matchesCategory(c, r);
}

/** Antippen in der Rezept-Ansicht: was gespeichert wird (auto = Korrektur entfernen) */
export function toggleCategory(c: RecipeCategory, r: RecipeText, overrides?: CategoryOverrides): 'include' | 'exclude' | 'auto' {
  const auto = matchesCategory(c, r);
  if (inCategory(c, r, overrides)) return auto ? 'exclude' : 'auto';
  return auto ? 'auto' : 'include';
}
