import { MAIN_INGREDIENTS, matchesCategory } from './recipeCategories';

/** „Kommt nie in den Plan“ – gleiche Kennungen wie worker/dislikes.ts */
export const FAMILY_DISLIKES: { id: string; label: string; never: string; categoryId: string }[] = [
  { id: 'fisch', label: 'Fisch', never: 'Keinen Fisch mehr vorschlagen', categoryId: 'fisch' },
  { id: 'meeresfruechte', label: 'Meeresfrüchte', never: 'Keine Meeresfrüchte mehr vorschlagen', categoryId: 'krustentiere' },
  { id: 'lamm', label: 'Lamm', never: 'Kein Lamm mehr vorschlagen', categoryId: 'lamm' },
  { id: 'schwein', label: 'Schwein', never: 'Kein Schwein mehr vorschlagen', categoryId: 'schwein' },
  { id: 'rind', label: 'Rind', never: 'Kein Rind mehr vorschlagen', categoryId: 'rind' },
  { id: 'gefluegel', label: 'Geflügel', never: 'Kein Geflügel mehr vorschlagen', categoryId: 'gefluegel' },
];

export const familyDislikeLabel = (id: string) => FAMILY_DISLIKES.find((d) => d.id === id)?.label ?? id;

/** Welche dieser Hauptzutaten stecken im Gericht? (für „… mehr vorschlagen“ beim Ausblenden) */
export function dislikeGroupsOf(name: string, ingredients: string[], already: string[] = []) {
  return FAMILY_DISLIKES.filter((d) => {
    if (already.includes(d.id)) return false;
    const cat = MAIN_INGREDIENTS.find((c) => c.id === d.categoryId);
    return !!cat && matchesCategory(cat, { name, ingredients });
  });
}
