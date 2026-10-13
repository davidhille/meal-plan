import { describe, expect, test } from 'bun:test';
import { familyPortions, formatPortions, portionFor, scaleIngredient } from './portions';
import type { FamilyMember } from '../types';

const member = (type: 'adult' | 'child', age: number | null = null) => ({ type, age }) as FamilyMember;

describe('portionFor', () => {
  test('Erwachsene essen eine Portion', () => expect(portionFor(member('adult'))).toBe(1));
  test('Kinder je nach Alter', () => {
    expect(portionFor(member('child', 4))).toBe(0.5);
    expect(portionFor(member('child', 6))).toBe(0.5);
    expect(portionFor(member('child', 7))).toBe(0.75);
    expect(portionFor(member('child', 12))).toBe(0.75);
    expect(portionFor(member('child', 13))).toBe(1);
  });
  test('Kind ohne Alter zählt wie 8 Jahre', () => expect(portionFor(member('child'))).toBe(0.75));
});

describe('familyPortions', () => {
  test('ohne Familie: Rezeptgröße 4', () => expect(familyPortions([])).toBe(4));
  test('auf halbe Portionen gerundet', () => {
    // 1 + 1 + 0,75 + 0,75 = 3,5
    expect(familyPortions([member('adult'), member('adult'), member('child', 7), member('child', 5)])).toBe(3.5);
  });
  test('mindestens eine Portion', () => expect(familyPortions([member('child', 3)])).toBe(1));
});

describe('scaleIngredient', () => {
  test('Gramm auf 25er-Schritte', () => expect(scaleIngredient('400g Spaghetti', 0.875)).toBe('350g Spaghetti'));
  test('ganze Stücke werden aufgerundet', () =>
    expect(scaleIngredient('4 Hähnchenschenkel', 0.875)).toBe('4 Hähnchenschenkel'));
  test('kleine Mengen werden zu ½', () => {
    expect(scaleIngredient('1 Zwiebel', 0.25)).toBe('½ Zwiebel');
    expect(scaleIngredient('2 EL Öl', 0.25)).toBe('½ EL Öl');
  });
  test('Brüche werden gelesen', () => expect(scaleIngredient('1/2 TL Oregano', 2)).toBe('1 TL Oregano'));
  test('ohne Menge bleibt alles gleich', () => expect(scaleIngredient('Salz', 2)).toBe('Salz'));
  test('Faktor 1 ändert nichts', () => expect(scaleIngredient('3 Dosen Tomaten', 1)).toBe('3 Dosen Tomaten'));
  test('Einzahl/Mehrzahl der Einheit passt zur Menge', () => {
    expect(scaleIngredient('1,5 Dosen Tomaten', 0.5)).toBe('1 Dose Tomaten');
    expect(scaleIngredient('1 Dose Kokosmilch', 2)).toBe('2 Dosen Kokosmilch');
    expect(scaleIngredient('2 Dosen Mais', 0.25)).toBe('½ Dose Mais');
    expect(scaleIngredient('1 Glas Oliven', 3)).toBe('3 Gläser Oliven');
  });
});

describe('formatPortions', () => {
  test('mit deutschem Komma', () => {
    expect(formatPortions(4)).toBe('4');
    expect(formatPortions(3.5)).toBe('3,5');
  });
});
