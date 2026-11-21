import { describe, expect, test } from 'bun:test';
import { parseSidesMode, suggestSides } from './sidesSuggest';

describe('suggestSides', () => {
  test('Schnitzel ohne Beilage: Kartoffel/Knödel/Reis plus Salat', () => {
    const r = suggestSides({ name: 'Wiener Schnitzel', ingredients: ['4 Schweineschnitzel', '2 Eier', '100 g Mehl', 'Semmelbrösel'] });
    expect(r.map((s) => s.kind)).toEqual(['beilage', 'salat']);
  });
  test('Nudelgericht mit Gemüse bekommt nichts', () => {
    expect(suggestSides({ name: 'Nudeln mit Tomatensauce', ingredients: ['400 g Nudeln', '500 g Tomaten'] })).toEqual([]);
  });
  test('Suppe und Brotzeit bekommen nichts', () => {
    expect(suggestSides({ name: 'Kürbissuppe', ingredients: ['1 Kürbis'] })).toEqual([]);
    expect(suggestSides({ name: 'Brotzeit', ingredients: [], brotzeit: true })).toEqual([]);
  });
  test('Curry bekommt Reis, nie Nudeln', () => {
    const r = suggestSides({ name: 'Hähnchencurry', ingredients: ['500 g Hähnchenbrust', '200 ml Kokosmilch', '2 EL Currypaste', '1 Paprika'] });
    expect(r).toHaveLength(1);
    expect(r[0].name.toLowerCase()).toMatch(/reis/);
  });
  test('stabil und abwechslungsreich', () => {
    const m = { name: 'Gebratenes Fischfilet', ingredients: ['600 g Kabeljaufilet', 'Zitrone'] };
    expect(suggestSides(m)).toEqual(suggestSides(m));
    const first = suggestSides(m)[0].name;
    expect(suggestSides(m, { [first]: 3 })[0].name).not.toBe(first);
  });
  test('ausgeblendete werden nicht vorgeschlagen', () => {
    const m = { name: 'Gebratenes Fischfilet', ingredients: ['600 g Kabeljaufilet', 'Zitrone'] };
    const first = suggestSides(m)[0].name;
    expect(suggestSides(m, {}, [first])[0].name).not.toBe(first);
  });
  test('parseSidesMode', () => {
    expect(parseSidesMode('auto')).toBe('auto');
    expect(parseSidesMode('x')).toBe('off');
    expect(parseSidesMode(null)).toBe('off');
  });
});
