import { Meal, PlanDessert, Dessert, DessertCategory } from '../types';

/** Quellenangabe für die Nachtisch-Fotos */
export const DESSERT_CREDIT = { name: 'TheMealDB', url: 'https://www.themealdb.com/' };

const isMealDb = (url: string | null | undefined) => !!url && url.startsWith('https://www.themealdb.com/');

/** Kleinere Vorschau von TheMealDB (bei Fehlern auf das Originalbild zurückfallen); eigene Bilder bleiben, wie sie sind */
export const dessertPreview = (url: string) => (isMealDb(url) ? `${url}/small` : url);

/** Bild eines Nachtischs: TheMealDB-Foto oder das (evtl. noch nicht erzeugte) eigene Bild */
export const dessertImage = (d: Pick<Dessert, 'name' | 'imageUrl'>) => d.imageUrl ?? `/api/images/${encodeURIComponent(d.name)}`;

/** Quellenangabe nur bei Fotos von TheMealDB */
export const dessertCredit = (url: string | null | undefined) => (isMealDb(url) ? DESSERT_CREDIT : null);

/** Nachtisch zum Speichern am Gericht */
export function toPlanDessert(d: Dessert): PlanDessert {
  return {
    name: d.name,
    ingredients: d.ingredients,
    instructions: d.instructions,
    durationMin: d.durationMin,
    imageUrl: dessertImage(d),
    yield: d.yield,
  };
}

/** Am Gericht gespeicherter Nachtisch für die Rezeptansicht */
export function planDessertToMeal(d: PlanDessert): Meal {
  return {
    day: 'Nachtisch',
    dayShort: '',
    meal: d.name,
    description: '',
    type: 'vegetarisch',
    ingredients: d.ingredients,
    instructions: d.instructions,
    imageUrl: d.imageUrl ?? undefined,
    imageCredit: dessertCredit(d.imageUrl),
    durationMin: d.durationMin,
  };
}

export const DESSERT_CATEGORIES: { id: DessertCategory; label: string }[] = [
  { id: 'kuchen', label: 'Kuchen & Torten' },
  { id: 'gebaeck', label: 'Gebäck' },
  { id: 'creme', label: 'Cremes & Pudding' },
  { id: 'pfanne', label: 'Pfannkuchen & Co.' },
  { id: 'obst', label: 'Mit Obst' },
  { id: 'eis', label: 'Eis & Kaltes' },
];

/** Kategorie aus Name und Schlagwörtern schätzen (lässt sich vor dem Speichern ändern) */
export function guessDessertCategory(text: string): DessertCategory {
  const t = text.toLowerCase();
  if (/\beis\b|parfait|sorbet|semifreddo|eiskaffee/.test(t)) return 'eis';
  if (/pfannkuchen|crêpe|crepe|waffel|kaiserschmarrn|pancake|palatschinken|arme ritter/.test(t)) return 'pfanne';
  // Cremes zuerst: „Zimtschnecken-Tiramisu“ ist eine Creme, kein Gebäck
  if (/tiramisu|mousse|panna cotta|pudding|creme|trifle|dessert im glas/.test(t)) return 'creme';
  if (/kuchen|torte|tarte|cheesecake|strudel|blechkuchen|gugelhupf/.test(t)) return 'kuchen';
  if (/keks|plätzchen|muffin|brownie|cookie|schnecke|krapfen|berliner|gebäck|hefezopf/.test(t)) return 'gebaeck';
  if (/quark|joghurt/.test(t)) return 'creme';
  if (/apfel|birne|beere|kirsch|pflaume|obst|frucht|mango|banane|pfirsich|kompott|rhabarber/.test(t)) return 'obst';
  return 'creme';
}
