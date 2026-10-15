import { describe, expect, test } from 'bun:test';
import { guessDessertCategory } from './desserts';

describe('guessDessertCategory', () => {
  test.each([
    ['Zimtschnecken-Tiramisu', 'creme'],
    ['Schoko-Mousse', 'creme'],
    ['Omas Apfelkuchen', 'kuchen'],
    ['Zimtschnecken', 'gebaeck'],
    ['Kaiserschmarrn', 'pfanne'],
    ['Erdbeer-Parfait', 'eis'],
    ['Rote Grütze mit Beeren', 'obst'],
    ['Unbekanntes Dessert', 'creme'],
  ])('%s → %s', (name, category) => expect(guessDessertCategory(name)).toBe(category as ReturnType<typeof guessDessertCategory>));
});
