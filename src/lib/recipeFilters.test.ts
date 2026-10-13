import { describe, expect, test } from 'bun:test';
import { matchesRecipeFilter, toggleAssignment } from './recipeFilters';
import type { RecipeFilter } from '../types';

const filter = (over: Partial<RecipeFilter> = {}): RecipeFilter => ({
  id: 'f',
  name: 'Fisch',
  scope: 'gerichte',
  keywords: ['Lachs', 'Fisch'],
  maxMinutes: null,
  includeNames: [],
  excludeNames: [],
  ...over,
});
const lachs = { name: 'Ofenlachs', ingredients: ['4 Lachsfilets'], durationMin: 30 };
const curry = { name: 'Gemüsecurry', ingredients: ['1 EL Fischsauce'], durationMin: 25 };
const nudeln = { name: 'Spaghetti Bolognese', ingredients: ['400 g Spaghetti'], durationMin: 40 };

describe('matchesRecipeFilter', () => {
  test('nach Suchbegriffen, ohne Groß-/Kleinschreibung', () => {
    expect(matchesRecipeFilter(filter(), lachs)).toBe(true);
    expect(matchesRecipeFilter(filter(), nudeln)).toBe(false);
  });
  test('von Hand ausgenommen geht vor Suchbegriff', () =>
    expect(matchesRecipeFilter(filter({ excludeNames: ['Gemüsecurry'] }), curry)).toBe(false));
  test('von Hand zugeordnet passt immer', () =>
    expect(matchesRecipeFilter(filter({ includeNames: ['Spaghetti Bolognese'] }), nudeln)).toBe(true));
  test('Filter ohne Regeln enthält nur zugeordnete Gerichte', () => {
    const f = filter({ keywords: [], includeNames: ['Ofenlachs'] });
    expect(matchesRecipeFilter(f, lachs)).toBe(true);
    expect(matchesRecipeFilter(f, curry)).toBe(false);
  });
  test('Zeit-Filter', () => {
    const f = filter({ keywords: [], maxMinutes: 30 });
    expect(matchesRecipeFilter(f, lachs)).toBe(true);
    expect(matchesRecipeFilter(f, nudeln)).toBe(false);
  });
});

describe('toggleAssignment', () => {
  test('passt nach Begriff → ausnehmen', () => expect(toggleAssignment(filter(), curry)).toBe('exclude'));
  test('ausgenommen → wieder automatisch', () =>
    expect(toggleAssignment(filter({ excludeNames: ['Gemüsecurry'] }), curry)).toBe('auto'));
  test('passt nicht → zuordnen', () => expect(toggleAssignment(filter(), nudeln)).toBe('include'));
  test('zugeordnet → Zuordnung lösen', () =>
    expect(toggleAssignment(filter({ includeNames: ['Spaghetti Bolognese'] }), nudeln)).toBe('auto'));
});
