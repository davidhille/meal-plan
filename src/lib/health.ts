/** Anzeigenamen der Gesundheitseinstellungen (Profil → health_conditions) */
export const CONDITION_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  gluten_free: 'Glutenfrei',
  lactose_intolerant: 'Laktosefrei',
  nut_allergy: 'Nussallergie',
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  kosher: 'Koscher',
  halal: 'Halal',
};

/** Beispiel, wie sich ein unpassendes Gericht anpassen lässt – passend zur Einstellung */
const SWAP_EXAMPLES: Record<string, string> = {
  gluten_free: 'glutenfreie Nudeln statt normaler',
  lactose_intolerant: 'laktosefreie Sahne statt normaler',
  vegan: 'Haferdrink statt Milch',
  vegetarian: 'Tofu statt Hähnchen',
  nut_allergy: 'Sonnenblumenkerne statt Pinienkernen',
  kosher: 'Rind statt Schwein',
  halal: 'Rind statt Schwein',
};

/** Beispiel für die erste aktive Einstellung, die eins hat (sonst keins) */
export function swapExample(conditions: string[]): string | null {
  for (const c of conditions) if (SWAP_EXAMPLES[c]) return SWAP_EXAMPLES[c];
  return null;
}
