import { describe, expect, test } from 'bun:test';
import { NETWORK_ERROR, TIMEOUT_ERROR, fetchErrorText, httpErrorText } from './errorText';

describe('fetchErrorText', () => {
  test('Zeitlimit und Abbruch', () => {
    expect(fetchErrorText(new DOMException('x', 'TimeoutError'))).toBe(TIMEOUT_ERROR);
    expect(fetchErrorText(new DOMException('x', 'AbortError'))).toBe(TIMEOUT_ERROR);
  });
  test('alles andere ist ein Netzproblem (kein englisches „Failed to fetch“)', () => {
    expect(fetchErrorText(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR);
    expect(fetchErrorText(null)).toBe(NETWORK_ERROR);
  });
});

describe('httpErrorText', () => {
  test('Meldung vom Server hat Vorrang', () => {
    expect(httpErrorText(401, 'E-Mail oder Passwort stimmt nicht.')).toBe('E-Mail oder Passwort stimmt nicht.');
    expect(httpErrorText(500, 'not_connected')).toBe('not_connected');
  });
  test('ohne Meldung nie „HTTP 502“', () => {
    for (const status of [400, 403, 404, 429, 500, 502, 503]) {
      const text = httpErrorText(status, undefined);
      expect(text).not.toContain('HTTP');
      expect(text).not.toMatch(/\d{3}/);
      expect(text.length).toBeGreaterThan(10);
    }
  });
  test('leere oder falsche Server-Meldung zählt als keine', () => {
    expect(httpErrorText(502, '')).toBe(httpErrorText(502, undefined));
    expect(httpErrorText(502, '  ')).toBe(httpErrorText(502, undefined));
    expect(httpErrorText(502, { error: 1 })).toBe(httpErrorText(502, undefined));
  });
  test('Server-Fehler und Drosselung sagen, was zu tun ist', () => {
    expect(httpErrorText(503)).toContain('noch einmal');
    expect(httpErrorText(429)).toContain('warten');
  });
});
