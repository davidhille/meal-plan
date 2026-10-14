import { describe, expect, test } from 'bun:test';
import { DESSERTS } from './desserts';

describe('Nachtisch-Sammlung', () => {
  test('Namen eindeutig, alles ausgefüllt', () => {
    const names = DESSERTS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
    for (const d of DESSERTS) {
      expect(d.ingredients.length).toBeGreaterThan(1);
      expect(d.instructions.split('\n').length).toBeGreaterThan(1);
      expect(d.durationMin).toBeGreaterThan(0);
      expect(['kuchen', 'gebaeck', 'creme', 'pfanne', 'obst', 'eis']).toContain(d.category);
    }
  });
  test('alphabetisch sortiert', () => {
    const names = DESSERTS.map((d) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')));
  });
});
