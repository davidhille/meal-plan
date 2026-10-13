import { describe, expect, test } from 'bun:test';
import { swapExample } from './health';

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
