import { describe, expect, test } from 'bun:test';
import { seasonHighlights, seasonalWords } from './season';

describe('Saison', () => {
  test('Oktober: Kürbis, kein Apfelessig', () => {
    expect(seasonHighlights('Kürbissuppe', ['1 kg Hokkaido-Kürbis', '1 EL Apfelessig'], 10)).toEqual(['Kürbis']);
  });
  test('Rosenkohl statt „Kohl“ doppelt', () => {
    expect(seasonHighlights('Rosenkohl-Pfanne', ['500 g Rosenkohl'], 11)).toEqual(['Rosenkohl']);
  });
  test('außerhalb der Saison nichts', () => {
    expect(seasonHighlights('Spargel mit Kartoffeln', ['1 kg Spargel'], 10)).toEqual([]);
    expect(seasonalWords(4)).toContain('spargel');
  });
});
