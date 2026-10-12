import { Meal, PlanDessert, Dessert } from '../types';

/** Quellenangabe für die Nachtisch-Fotos */
export const DESSERT_CREDIT = { name: 'TheMealDB', url: 'https://www.themealdb.com/' };

/** Kleinere Vorschau von TheMealDB (bei Fehlern auf das Originalbild zurückfallen) */
export const dessertPreview = (url: string) => `${url}/small`;

/** Nachtisch zum Speichern am Gericht */
export function toPlanDessert(d: Dessert): PlanDessert {
  return {
    name: d.name,
    ingredients: d.ingredients,
    instructions: d.instructions,
    durationMin: d.durationMin,
    imageUrl: d.imageUrl,
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
    imageCredit: d.imageUrl ? DESSERT_CREDIT : null,
    durationMin: d.durationMin,
  };
}
