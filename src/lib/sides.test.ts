import { describe, expect, test } from 'bun:test';
import { SIDES } from '../data/sides';
import { toPlanSide, toggleSide } from './sides';

describe('Beilagen-Sammlung', () => {
  test('Namen eindeutig, Zutaten und Schritte vorhanden', () => {
    expect(new Set(SIDES.map((s) => s.name)).size).toBe(SIDES.length);
    for (const s of SIDES) {
      expect(s.ingredients.length).toBeGreaterThan(0);
      expect(s.instructions.split('\n').length).toBeGreaterThan(0);
      expect(s.durationMin).toBeGreaterThan(0);
    }
  });
  test('Beilagen und Salate sind beide vertreten, sättigende haben eine Grundlage', () => {
    expect(SIDES.filter((s) => s.kind === 'salat').length).toBeGreaterThan(5);
    expect(SIDES.filter((s) => s.kind === 'beilage' && s.carb).length).toBeGreaterThan(10);
  });
});

describe('toggleSide', () => {
  const reis = toPlanSide(SIDES.find((s) => s.name === 'Basmatireis')!);
  const kartoffeln = toPlanSide(SIDES.find((s) => s.name === 'Salzkartoffeln')!);
  const salat = toPlanSide(SIDES.find((s) => s.kind === 'salat')!);
  test('je Art nur eine, andere Art bleibt', () => {
    expect(toggleSide([reis], kartoffeln)).toEqual([kartoffeln]);
    expect(toggleSide([reis], salat)).toEqual([reis, salat]);
  });
  test('noch einmal antippen entfernt', () => expect(toggleSide([reis, salat], reis)).toEqual([salat]));
});
