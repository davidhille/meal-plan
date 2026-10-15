import { describe, expect, test } from 'bun:test';
import { DISH_KINDS, MAIN_INGREDIENTS, inCategory, matchesCategory, toggleCategory } from './recipeCategories';

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
  test('Hackfleisch ohne Angabe: Rind und Schwein; Rinderhack nur Rind', () => {
    expect(matchesCategory(main('rind'), r('Chili con Carne', ['500 g Hackfleisch']))).toBe(true);
    expect(matchesCategory(main('schwein'), r('Chili con Carne', ['500 g Hackfleisch']))).toBe(true);
    expect(matchesCategory(main('schwein'), r('Köfte', ['500 g Rinderhackfleisch']))).toBe(false);
    expect(matchesCategory(main('rind'), r('Gyros', ['500 g Schweinehackfleisch']))).toBe(false);
  });
  test('„fein gehackt“ ist kein Hackfleisch', () =>
    expect(matchesCategory(main('rind'), r('Gemüsepfanne', ['1 Bund Petersilie, fein gehackt', '2 gehackte Zwiebeln']))).toBe(false));
  test('Würzzutaten zählen nicht: Hühnerbrühe, Fischsauce', () => {
    expect(matchesCategory(main('gefluegel'), r('Kürbissuppe', ['500 ml Hühnerbrühe']))).toBe(false);
    expect(matchesCategory(main('fisch'), r('Thai-Curry', ['2 EL Fischsauce']))).toBe(false);
    expect(matchesCategory(main('gefluegel'), r('Thai-Curry', ['400 g Hähnchenbrust']))).toBe(true);
  });
  test('Thunfisch- und Schweinesteak, Schweinegulasch sind kein Rind', () => {
    expect(matchesCategory(main('rind'), r('Thunfischsteak mit Salat'))).toBe(false);
    expect(matchesCategory(main('rind'), r('Schweinesteak mit Pommes'))).toBe(false);
    expect(matchesCategory(main('rind'), r('Schweinegulasch', ['800 g Schweinefleisch']))).toBe(false);
  });
  test('Käse nur am Namen (Parmesan zum Bestreuen zählt nicht)', () =>
    expect(matchesCategory(main('kaese'), r('Spaghetti Bolognese', ['50 g Parmesan']))).toBe(false));
});

describe('Korrekturen von Hand', () => {
  const dish = r('Omas Nudelpfanne', ['300 g Bandnudeln']);
  test('Korrektur geht vor der Erkennung', () => {
    expect(inCategory(main('nudeln'), dish, { 'Omas Nudelpfanne': { nudeln: false } })).toBe(false);
    expect(inCategory(main('reis'), dish, { 'Omas Nudelpfanne': { reis: true } })).toBe(true);
  });
  test('Antippen: erkannt → ausnehmen → wieder automatisch', () => {
    expect(toggleCategory(main('nudeln'), dish, {})).toBe('exclude');
    expect(toggleCategory(main('nudeln'), dish, { 'Omas Nudelpfanne': { nudeln: false } })).toBe('auto');
    expect(toggleCategory(main('reis'), dish, {})).toBe('include');
    expect(toggleCategory(main('reis'), dish, { 'Omas Nudelpfanne': { reis: true } })).toBe('auto');
  });
});
