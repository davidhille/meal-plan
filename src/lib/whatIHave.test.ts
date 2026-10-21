import { describe, expect, test } from 'bun:test';
import { matchHave, parseHave, stem } from './whatIHave';

const r = (name: string, ingredients: string[]) => ({ name, ingredients });

describe('Was hab ich da?', () => {
  test('Eingabe zerlegen', () => {
    expect(parseHave('Zucchini, Feta; Reis und Tomaten')).toEqual(['zucchini', 'feta', 'reis', 'tomaten']);
  });

  test('Wortstamm', () => {
    expect(stem('Tomaten')).toBe('tomat');
    expect(stem('Kartoffeln')).toBe('kartoffel');
    expect(stem('Ei')).toBe('ei');
  });

  test('mehr Treffer zuerst, Plural egal', () => {
    const list = [
      r('Zucchini-Pfanne', ['2 Zucchini', '200 g Reis', '1 Zwiebel']),
      r('Feta-Zucchini-Reis', ['1 Zucchini', '150 g Feta', '200 g Reis', '3 Tomaten']),
      r('Nudeln', ['500 g Nudeln']),
    ];
    const m = matchHave(list, parseHave('Zucchini, Feta, Reis, Tomate'));
    expect(m.map((x) => x.recipe.name)).toEqual(['Feta-Zucchini-Reis', 'Zucchini-Pfanne']);
    expect(m[0].matched).toEqual(['zucchini', 'feta', 'reis', 'tomate']);
  });
});
