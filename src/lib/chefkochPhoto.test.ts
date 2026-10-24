import { describe, expect, test } from 'bun:test';
import { photoCandidates } from './chefkochPhoto';

const page = 'https://img.chefkoch-cdn.de/rezepte/1975801320767344/bilder/415444/crop-960x540/hatopasa.jpg';
const at = (crop: string) => `https://img.chefkoch-cdn.de/rezepte/1975801320767344/bilder/415444/crop-${crop}/hatopasa.jpg`;

describe('photoCandidates', () => {
  test('erlaubte Zuschnitte zuerst, die Adresse der Rezeptseite zuletzt', () => {
    expect(photoCandidates(page)).toEqual([at('960x640'), at('600x400'), page]);
  });
  test('ohne Zuschnitt in der Adresse bleibt nur die Adresse selbst', () => {
    const plain = 'https://img.chefkoch-cdn.de/rezepte/1/bilder/2/foto.jpg';
    expect(photoCandidates(plain)).toEqual([plain]);
  });
  test('ein schon erlaubter Zuschnitt kommt nicht doppelt vor', () => {
    expect(photoCandidates(at('600x400'))).toEqual([at('960x640'), at('600x400')]);
  });
});
