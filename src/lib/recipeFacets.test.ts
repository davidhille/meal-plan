import { describe, expect, test } from 'bun:test';
import { CatalogRecipe } from '../types';
import { EMPTY_SELECTION, FacetContext, matchesSelection, optionCount } from './recipeFacets';

const r = (name: string, type: CatalogRecipe['type'], ingredients: string[]) => ({ name, type, ingredients, durationMin: 30 }) as CatalogRecipe;
const recipes = [
  r('Spaghetti Bolognese', 'fleisch', ['400 g Spaghetti', '500 g Rinderhackfleisch']),
  r('Schweinegulasch', 'fleisch', ['800 g Schweinefleisch', '1 kg Kartoffeln']),
  r('Kartoffelsuppe', 'vegetarisch', ['1 kg Kartoffeln']),
  r('Lasagne', 'wochenende', ['12 Lasagneplatten', '500 g Rinderhack']),
];
const ctx: FacetContext = { customFilters: [], overrides: {} };

describe('Filter-Gruppen', () => {
  test('in einer Gruppe: oder', () => {
    const sel = { ...EMPTY_SELECTION, ingredients: ['rind', 'schwein'] };
    expect(recipes.filter((x) => matchesSelection(x, sel, ctx)).map((x) => x.name)).toEqual([
      'Spaghetti Bolognese',
      'Schweinegulasch',
      'Lasagne',
    ]);
  });
  test('zwischen Gruppen: und', () => {
    const sel = { ...EMPTY_SELECTION, types: ['fleisch'], ingredients: ['kartoffeln'] };
    expect(recipes.filter((x) => matchesSelection(x, sel, ctx)).map((x) => x.name)).toEqual(['Schweinegulasch']);
  });
  test('Zahl am Knopf: andere Gruppen zählen, die eigene nicht', () => {
    const sel = { ...EMPTY_SELECTION, types: ['fleisch'], ingredients: ['nudeln'] };
    expect(optionCount(recipes, 'ingredients', 'kartoffeln', sel, ctx)).toBe(1);
    expect(optionCount(recipes, 'types', 'wochenende', sel, ctx)).toBe(1);
  });
  test('eigene Filter mit Hand-Zuordnung', () => {
    const own: FacetContext = {
      overrides: {},
      customFilters: [{ id: 'k', name: 'Kinder', scope: 'gerichte', keywords: [], maxMinutes: null, includeNames: ['Lasagne'], excludeNames: [] }],
    };
    expect(recipes.filter((x) => matchesSelection(x, { ...EMPTY_SELECTION, custom: ['k'] }, own)).map((x) => x.name)).toEqual(['Lasagne']);
  });
});
