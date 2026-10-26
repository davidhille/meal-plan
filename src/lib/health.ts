import type { UnsuitableBy } from '../types';

/** Anzeigenamen der Gesundheitseinstellungen (Profil → health_conditions) */
export const CONDITION_LABELS: Record<string, string> = {
  diabetes: 'Diabetes',
  gluten_free: 'Glutenfrei',
  lactose_intolerant: 'Laktosefrei',
  nut_allergy: 'Nussallergie',
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  no_alcohol: 'Ohne Alkohol',
};

/** Ernährungs-Schwerpunkte: mehrere gleichzeitig möglich, schließen nichts aus (Pluspunkte bei der Planung) */
export const FOCUS_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'calorie_light', label: 'Kalorienbewusst', hint: 'leichter, weniger Sahne & Käse' },
  { id: 'high_protein', label: 'Proteinreich', hint: 'Fleisch, Fisch, Hülsenfrüchte, Tofu, Quark' },
  { id: 'low_carb', label: 'Low Carb', hint: 'wenig Nudeln, Reis, Kartoffeln, Brot' },
  { id: 'veggie_rich', label: 'Viel Gemüse', hint: 'mehrere Gemüsesorten im Gericht' },
  { id: 'whole_grain', label: 'Vollkorn & Ballaststoffe', hint: 'Hülsenfrüchte, Vollkorn, Quinoa' },
  { id: 'kid_friendly', label: 'Kinderfreundlich', hint: 'nicht scharf, eher einfache Gerichte' },
  { id: 'seasonal', label: 'Saisonal', hint: 'was gerade in Deutschland Saison hat' },
  { id: 'budget', label: 'Günstig', hint: 'eher günstige Zutaten' },
];

export const FOCUS_LABELS: Record<string, string> = Object.fromEntries(FOCUS_OPTIONS.map((f) => [f.id, f.label]));

/** Beispiel, wie sich ein unpassendes Gericht anpassen lässt – passend zur Einstellung */
const SWAP_EXAMPLES: Record<string, string> = {
  gluten_free: 'glutenfreie Nudeln statt normaler',
  lactose_intolerant: 'laktosefreie Sahne statt normaler',
  vegan: 'Haferdrink statt Milch',
  vegetarian: 'Tofu statt Hähnchen',
  nut_allergy: 'Sonnenblumenkerne statt Pinienkernen',
  no_alcohol: 'Brühe statt Weißwein',
};

/** Beispiel für die erste aktive Einstellung, die eins hat (sonst keins) */
export function swapExample(conditions: string[]): string | null {
  for (const c of conditions) if (SWAP_EXAMPLES[c]) return SWAP_EXAMPLES[c];
  return null;
}

/** Gründe eines unpassenden Gerichts; ältere Antworten ohne Angabe gelten als Gesundheitseinstellung */
export function reasonsOf(recipe: { unsuitableBy?: UnsuitableBy[] }): UnsuitableBy[] {
  return recipe.unsuitableBy && recipe.unsuitableBy.length > 0 ? recipe.unsuitableBy : ['health'];
}

/** Alle Gründe mehrerer Gerichte zusammen (ohne Dubletten) */
export function allReasons(recipes: { unsuitableBy?: UnsuitableBy[] }[]): UnsuitableBy[] {
  return [...new Set(recipes.flatMap(reasonsOf))];
}

/** „zu euren Einstellungen“, „zu euren Abneigungen“ oder beides – damit der Hinweis den echten Grund nennt */
export function unsuitableSubject(by: UnsuitableBy[]): string {
  const health = by.includes('health');
  const dislike = by.includes('dislike');
  if (health && dislike) return 'zu euren Einstellungen oder Abneigungen';
  return dislike ? 'zu euren Abneigungen' : 'zu euren Einstellungen';
}

/** Zusatz in Klammern mit den betroffenen Einstellungen bzw. Abneigungen (leer, wenn keine bekannt sind) */
export function unsuitableDetail(by: UnsuitableBy[], healthLabels: string[], dislikeLabels: string[]): string {
  const parts = [...(by.includes('health') ? healthLabels : []), ...(by.includes('dislike') ? dislikeLabels : [])];
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
