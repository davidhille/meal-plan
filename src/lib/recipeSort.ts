import { CatalogRecipe } from '../types';
import { seasonHighlights } from './season';

export type RecipeSort = 'empfohlen' | 'bewertung' | 'schnell' | 'az';

export const SORT_LABELS: Record<RecipeSort, string> = {
  empfohlen: 'Empfohlen',
  bewertung: 'Beste Bewertung',
  schnell: 'Schnellste zuerst',
  az: 'A–Z',
};

interface SortContext {
  ratings: Record<string, number>;
  favorites: Set<string>;
  /** Monat 1–12 für die Saison */
  month: number;
}

const byName = (a: CatalogRecipe, b: CatalogRecipe) => a.name.localeCompare(b.name, 'de');

/**
 * „Empfohlen“: Favoriten vor gut bewerteten vor saisonalen Gerichten; schlecht bewertete nach hinten.
 * Punkte: Favorit +3, Bewertung (Sterne − 3), Saison-Zutat +1,5.
 */
export function recommendScore(r: CatalogRecipe, ctx: SortContext): number {
  let score = 0;
  if (ctx.favorites.has(r.name)) score += 3;
  const stars = ctx.ratings[r.name];
  if (stars) score += stars - 3;
  if (seasonHighlights(r.name, r.ingredients, ctx.month).length) score += 1.5;
  return score;
}

export function sortRecipes(recipes: CatalogRecipe[], mode: RecipeSort, ctx: SortContext): CatalogRecipe[] {
  const list = [...recipes];
  switch (mode) {
    case 'az':
      return list.sort(byName);
    case 'bewertung':
      // Unbewertete hinten
      return list.sort((a, b) => (ctx.ratings[b.name] ?? 0) - (ctx.ratings[a.name] ?? 0) || byName(a, b));
    case 'schnell':
      // Ohne Zeitangabe hinten
      return list.sort((a, b) => (a.durationMin ?? Infinity) - (b.durationMin ?? Infinity) || byName(a, b));
    default: {
      const score = new Map(list.map((r) => [r.name, recommendScore(r, ctx)]));
      return list.sort((a, b) => score.get(b.name)! - score.get(a.name)! || byName(a, b));
    }
  }
}
