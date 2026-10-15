import { describe, expect, test } from 'bun:test';
import { DISH_KINDS, MAIN_INGREDIENTS, matchesCategory } from './recipeCategories';

const kind = (id: string) => DISH_KINDS.find((c) => c.id === id)!;
const main = (id: string) => MAIN_INGREDIENTS.find((c) => c.id === id)!;
const r = (name: string, ingredients: string[] = []) => ({ name, ingredients });

describe('Speiseart', () => {
  test('Auflauf und Pasta zugleich', () => {
    expect(matchesCategory(kind('auflauf'), r('Lasagne Bolognese'))).toBe(true);
    expect(matchesCategory(kind('pasta'), r('Lasagne Bolognese'))).toBe(true);
  });
  test('„gebraten“ ist kein Braten', () => {
    expect(matchesCategory(kind('braten'), r('Gebratene Nudeln mit Gemüse'))).toBe(false);
    expect(matchesCategory(kind('braten'), r('Schweinebraten mit Knödeln'))).toBe(true);
  });
  test('Suppe nur am Namen', () => expect(matchesCategory(kind('suppe'), r('Curry', ['500 ml Gemüsebrühe']))).toBe(false));
});

describe('Hauptzutat', () => {
  test('Reis auch als Zutat, aber nicht „Preis“ oder „Reibekäse“', () => {
    expect(matchesCategory(main('reis'), r('Gemüse-Curry', ['200 g Basmatireis']))).toBe(true);
    expect(matchesCategory(main('reis'), r('Ofengemüse', ['50 g Reibekäse']))).toBe(false);
  });
  test('Fleisch aus den Zutaten', () => expect(matchesCategory(main('fleisch'), r('Chili con Carne', ['500 g Hackfleisch']))).toBe(true));
  test('Käse nur am Namen (Parmesan zum Bestreuen zählt nicht)', () =>
    expect(matchesCategory(main('kaese'), r('Spaghetti Bolognese', ['50 g Parmesan']))).toBe(false));
});
