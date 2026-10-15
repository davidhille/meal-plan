// Feste Filter für die Rezept-Übersicht: Speiseart (aus dem Namen) und Hauptzutat (Name/Zutaten).
// Reine Heuristik auf dem Text – Gerichte können in mehreren Gruppen landen.

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

const PASTA = /spaghetti|pasta|nudel|penne|tagliatelle|fusilli|rigatoni|linguine|farfalle|lasagne|ravioli|tortellini|makkaroni|maccheroni|orecchiette|pappardelle|tortelloni/;

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
  { id: 'mehlspeise', label: 'Mehlspeisen', name: /spätzle|knödel|klöße|kloß|pfannkuchen|maultasche|schupfnudel|dampfnudel|kaiserschmarrn|crêpe|pancake|gnocchi/ },
];

export const MAIN_INGREDIENTS: RecipeCategory[] = [
  { id: 'nudeln', label: 'Nudeln', name: PASTA, ingredient: PASTA },
  { id: 'reis', label: 'Reis', name: /\breis\b|risotto|paella|bratreis|biryani|jambalaya/, ingredient: /\breis\b|risotto|basmati|jasminreis|langkornreis|milchreis/ },
  { id: 'kartoffeln', label: 'Kartoffeln', name: /kartoffel|rösti|pommes|püree|bratkartoffel/, ingredient: /kartoffel/ },
  {
    id: 'fleisch',
    label: 'Fleisch',
    name: /hähnchen|huhn|hühner|pute|rind|schwein|hack|lamm|kalb|speck|schinken|wurst|steak|schnitzel|gulasch|frikadelle|braten|chicken|beef/,
    ingredient: /hähnchen|huhn|hühner|pute|rindfleisch|\brind|schwein|hackfleisch|gehacktes|lamm|kalb|speck|schinken|wurst|würstchen|chorizo|salami|bacon|steak|gulasch/,
  },
  {
    id: 'fisch',
    label: 'Fisch',
    name: /fisch|lachs|kabeljau|thunfisch|forelle|dorade|sardine|makrele|hering|scholle|zander|seelachs|backfisch/,
    ingredient: /fisch|lachs|kabeljau|thunfisch|forelle|dorade|sardine|makrele|hering|scholle|zander|seelachs/,
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

export function matchesCategory(c: RecipeCategory, r: RecipeText): boolean {
  if (c.name.test(r.name.toLowerCase())) return true;
  return !!c.ingredient && r.ingredients.some((i) => c.ingredient!.test(i.toLowerCase()));
}
