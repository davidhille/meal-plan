import { describe, expect, test } from 'bun:test';
import { allReasons, reasonsOf, swapExample, unsuitableDetail, unsuitableSubject } from './health';

describe('swapExample', () => {
  test('passend zur ersten Einstellung mit Beispiel', () => {
    expect(swapExample(['gluten_free'])).toBe('glutenfreie Nudeln statt normaler');
    expect(swapExample(['diabetes', 'lactose_intolerant'])).toBe('laktosefreie Sahne statt normaler');
  });
  test('ohne passende Einstellung kein Beispiel', () => {
    expect(swapExample([])).toBeNull();
    expect(swapExample(['diabetes'])).toBeNull();
    expect(swapExample(['no_alcohol'])).toBe('Brühe statt Weißwein');
  });
});

describe('Grund unpassender Gerichte', () => {
  test('ohne Angabe (ältere Antwort) gilt Gesundheit', () => {
    expect(reasonsOf({})).toEqual(['health']);
    expect(reasonsOf({ unsuitableBy: [] })).toEqual(['health']);
  });

  test('Gründe mehrerer Gerichte ohne Dubletten', () => {
    expect(allReasons([{ unsuitableBy: ['dislike'] }, { unsuitableBy: ['dislike'] }])).toEqual(['dislike']);
    expect(allReasons([{ unsuitableBy: ['dislike'] }, { unsuitableBy: ['health', 'dislike'] }])).toEqual(['dislike', 'health']);
  });

  test('der Hinweis nennt den echten Grund', () => {
    expect(unsuitableSubject(['health'])).toBe('zu euren Einstellungen');
    expect(unsuitableSubject(['dislike'])).toBe('zu euren Abneigungen');
    expect(unsuitableSubject(['health', 'dislike'])).toBe('zu euren Einstellungen oder Abneigungen');
  });

  test('Klammerzusatz nennt nur Passendes, leer ohne Namen', () => {
    expect(unsuitableDetail(['dislike'], ['Diabetes'], ['Fisch'])).toBe(' (Fisch)');
    expect(unsuitableDetail(['health'], ['Diabetes'], ['Fisch'])).toBe(' (Diabetes)');
    expect(unsuitableDetail(['health', 'dislike'], ['Diabetes'], ['Fisch'])).toBe(' (Diabetes, Fisch)');
    expect(unsuitableDetail(['dislike'], ['Diabetes'], [])).toBe('');
  });
});
