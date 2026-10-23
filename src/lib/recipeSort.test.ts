import { describe, expect, test } from 'bun:test';
import { CatalogRecipe } from '../types';
import { sortRecipes } from './recipeSort';

const r = (name: string, ingredients: string[] = [], durationMin: number | null = null): CatalogRecipe => ({
  name,
  type: 'vegetarisch',
  ingredients,
  instructions: '',
  durationMin,
  imageUrl: null,
  imageCredit: null,
  origin: 'basis',
});

const recipes = [
  r('Ägyptisches Fatteh', ['500 g Rindfleisch'], 150),
  r('Kürbissuppe', ['1 kg Hokkaido-Kürbis'], 40),
  r('Linsen-Dal', ['200 g rote Linsen'], 30),
  r('Pfannkuchen', ['3 Eier'], null),
  r('Zucchini-Pasta', ['2 Zucchini'], 20),
];
const ctx = { ratings: { 'Linsen-Dal': 5, 'Zucchini-Pasta': 1 }, favorites: new Set(['Pfannkuchen']), month: 10 };
const names = (mode: Parameters<typeof sortRecipes>[1]) => sortRecipes(recipes, mode, ctx).map((x) => x.name);

describe('Sortierung der Rezept-Übersicht', () => {
  test('Empfohlen: Favorit, gut bewertet, Saison zuerst, schlecht bewertet zuletzt', () => {
    expect(names('empfohlen')).toEqual(['Pfannkuchen', 'Linsen-Dal', 'Kürbissuppe', 'Ägyptisches Fatteh', 'Zucchini-Pasta']);
  });
  test('Beste Bewertung: Unbewertete hinten, sonst alphabetisch', () => {
    expect(names('bewertung')).toEqual(['Linsen-Dal', 'Zucchini-Pasta', 'Ägyptisches Fatteh', 'Kürbissuppe', 'Pfannkuchen']);
  });
  test('Schnellste zuerst: ohne Zeit hinten', () => {
    expect(names('schnell')).toEqual(['Zucchini-Pasta', 'Linsen-Dal', 'Kürbissuppe', 'Ägyptisches Fatteh', 'Pfannkuchen']);
  });
  test('A–Z mit Umlauten', () => {
    expect(names('az')[0]).toBe('Ägyptisches Fatteh');
  });
});
