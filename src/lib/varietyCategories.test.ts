import { describe, expect, test } from 'bun:test';
import { VarietyRule, groupVarietyRules } from './varietyCategories';

describe('groupVarietyRules', () => {
  test('fasst Woche und Monat einer Kategorie zusammen, Woche zuerst', () => {
    const rules: VarietyRule[] = [
      { id: 'meeresfruechte', period: 'month', max: 2 },
      { id: 'nudeln', period: 'week', max: 2 },
      { id: 'meeresfruechte', period: 'week', max: 1 },
    ];
    expect(groupVarietyRules(rules)).toEqual([[2, 0], [1]]);
  });

  test('leere Liste ergibt keine Gruppen', () => {
    expect(groupVarietyRules([])).toEqual([]);
  });
});
