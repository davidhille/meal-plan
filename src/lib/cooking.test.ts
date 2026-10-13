import { describe, expect, test } from 'bun:test';
import { findTimers, formatCountdown, toSteps } from './cooking';

describe('toSteps', () => {
  test('eine Zeile pro Schritt, Nummern entfernt', () =>
    expect(toSteps('1. Zwiebeln schneiden.\n\n2) Anbraten.\n')).toEqual(['Zwiebeln schneiden.', 'Anbraten.']));
  test('leer', () => expect(toSteps('')).toEqual([]));
});

describe('findTimers', () => {
  test('Minuten und Stunden', () => {
    expect(findTimers('Bei 200 °C 25 Minuten backen.')).toEqual([{ label: '25 Min', seconds: 1500 }]);
    expect(findTimers('Zugedeckt 1,5 Stunden schmoren.')).toEqual([{ label: '1½ Std', seconds: 5400 }]);
    expect(findTimers('1½ Std. ruhen lassen')).toEqual([{ label: '1½ Std', seconds: 5400 }]);
    expect(findTimers('30 Sekunden pürieren')).toEqual([{ label: '30 Sek', seconds: 30 }]);
  });
  test('Spannen nehmen die längere Zeit', () =>
    expect(findTimers('15–20 Min. köcheln, dann 5 Minuten ziehen lassen.')).toEqual([
      { label: '20 Min', seconds: 1200 },
      { label: '5 Min', seconds: 300 },
    ]));
  test('keine Zeit, keine Verwechslung mit Mengen/Temperaturen', () => {
    expect(findTimers('200 g Mehl unterrühren, Ofen auf 180 Grad.')).toEqual([]);
    expect(findTimers('Minze hacken')).toEqual([]);
  });
});

describe('formatCountdown', () => {
  test('Minuten und Stunden', () => {
    expect(formatCountdown(754)).toBe('12:34');
    expect(formatCountdown(3725)).toBe('1:02:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
