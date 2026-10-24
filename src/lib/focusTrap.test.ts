import { describe, expect, test } from 'bun:test';
import { trapIndex } from './focusTrap';

describe('Tab bleibt im Fenster', () => {
  test('Tab am letzten Element springt zum ersten', () => {
    expect(trapIndex(5, 4, false)).toBe(0);
  });
  test('Umschalt+Tab am ersten Element springt zum letzten', () => {
    expect(trapIndex(5, 0, true)).toBe(4);
  });
  test('in der Mitte darf der Browser selbst weiterspringen', () => {
    expect(trapIndex(5, 2, false)).toBeNull();
    expect(trapIndex(5, 2, true)).toBeNull();
  });
  test('Fokus außerhalb der Liste (auf dem Fenster selbst) geht ins Fenster', () => {
    expect(trapIndex(5, -1, false)).toBe(0);
    expect(trapIndex(5, -1, true)).toBe(4);
  });
  test('ein einziges Element hält den Fokus fest', () => {
    expect(trapIndex(1, 0, false)).toBe(0);
    expect(trapIndex(1, 0, true)).toBe(0);
  });
  test('ohne bedienbare Elemente nichts tun', () => {
    expect(trapIndex(0, -1, false)).toBeNull();
  });
});
