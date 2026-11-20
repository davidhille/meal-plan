import { Meal, PlanSide, Side, SideCarb, SideKind } from '../types';

export const SIDE_KIND_LABEL: Record<SideKind, string> = { beilage: 'Beilage', salat: 'Salat' };

export const SIDE_CARB_LABEL: Record<SideCarb, string> = {
  kartoffel: 'Kartoffeln',
  reis: 'Reis',
  nudeln: 'Nudeln',
  knoedel: 'Knödel',
  brot: 'Brot',
  getreide: 'Getreide',
};

/** Beilage/Salat zum Speichern am Gericht */
export function toPlanSide(s: Side): PlanSide {
  return { name: s.name, kind: s.kind, ingredients: s.ingredients, instructions: s.instructions, durationMin: s.durationMin };
}

/** Am Gericht gespeicherte Beilage für die Rezeptansicht (Mengen für 4 Portionen, der Portionsrechner rechnet um) */
export function planSideToMeal(s: PlanSide): Meal {
  return {
    day: SIDE_KIND_LABEL[s.kind],
    dayShort: '',
    meal: s.name,
    description: '',
    type: 'vegetarisch',
    ingredients: s.ingredients,
    instructions: s.instructions,
    durationMin: s.durationMin ?? undefined,
  };
}

/** Neue Auswahl: je Art höchstens eine; dieselbe noch einmal antippen nimmt sie wieder heraus */
export function toggleSide(current: PlanSide[], side: PlanSide): PlanSide[] {
  const without = current.filter((c) => c.kind !== side.kind);
  const wasSelected = current.some((c) => c.kind === side.kind && c.name === side.name);
  return wasSelected ? without : [...without, side];
}
