// „Was hab ich da?“: Gerichte aus der Sammlung, die möglichst viele der vorhandenen Zutaten verwenden
import { normalizeText } from './recipeFilters';

/** „Zucchini, Feta; Reis“ → ['zucchini', 'feta', 'reis'] (ohne Doppelte) */
export function parseHave(input: string): string[] {
  const parts = input
    .split(/[,;\n]+|\s+und\s+/i)
    .map((s) => normalizeText(s.trim()))
    .filter((s) => s.length >= 2);
  return [...new Set(parts)];
}

/** Einfacher Wortstamm, damit „Tomaten“ auch „Tomate“ und „Kartoffeln“ auch „Kartoffel“ findet */
export function stem(word: string): string {
  const w = normalizeText(word.trim());
  return w.length > 4 ? w.replace(/(en|n|e|s)$/, '') : w;
}

export interface HaveMatch<R> {
  recipe: R;
  /** Eingaben, die im Rezept vorkommen */
  matched: string[];
}

/** Treffer: je mehr vorhandene Zutaten vorkommen, desto weiter oben; bei Gleichstand das Rezept mit weniger Zutaten */
export function matchHave<R extends { name: string; ingredients: string[] }>(recipes: R[], have: string[]): HaveMatch<R>[] {
  if (!have.length) return [];
  const stems = have.map((h) => ({ label: h, stem: stem(h) }));
  return recipes
    .map((recipe) => {
      const text = recipe.ingredients.map(normalizeText).join(' | ');
      const matched = stems.filter((s) => text.includes(s.stem)).map((s) => s.label);
      return { recipe, matched };
    })
    .filter((m) => m.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.recipe.ingredients.length - b.recipe.ingredients.length);
}
