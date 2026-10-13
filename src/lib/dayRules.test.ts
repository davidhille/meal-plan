import { describe, expect, test } from 'bun:test';
import { describeDayRules, ruleForDate } from './dayRules';

describe('Wochentag-Regeln', () => {
  const rules = { '0': { off: true }, '3': { maxMinutes: 20 } };
  test('Regel für ein Datum', () => {
    expect(ruleForDate('2026-10-18', rules)).toEqual({ off: true });
    expect(ruleForDate('2026-10-14', rules)).toEqual({ maxMinutes: 20 });
    expect(ruleForDate('2026-10-13', rules)).toEqual({});
  });
  test('Beschreibung in der Reihenfolge Mo–So', () => {
    expect(describeDayRules(rules)).toBe('Mi max. 20 Min · So frei');
    expect(describeDayRules({})).toBe('Jeder Tag wird normal geplant');
  });
});
