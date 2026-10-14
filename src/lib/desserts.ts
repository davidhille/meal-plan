import { Meal, PlanDessert, Dessert } from '../types';

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
