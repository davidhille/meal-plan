import { describe, expect, test } from 'bun:test';
import { currentWeekIndex, formatShortDate, getWeeksInRange, isDateInWeek, toIso, upcomingWeeks } from './dateUtils';

describe('toIso', () => {
  test('nutzt das lokale Datum (nicht UTC)', () => {
    expect(toIso(new Date(2026, 9, 13, 0, 30))).toBe('2026-10-13');
    expect(toIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('getWeeksInRange', () => {
  const weeks = getWeeksInRange('2026-10-13', '2026-10-25');
  test('eine KW pro berührter Woche, Montag bis Sonntag', () => {
    expect(weeks).toEqual([
      { key: '2026-W42', kw: 42, weekStart: '2026-10-12', weekEnd: '2026-10-18' },
      { key: '2026-W43', kw: 43, weekStart: '2026-10-19', weekEnd: '2026-10-25' },
    ]);
  });
  test('Jahreswechsel: 1.1.2027 gehört zu KW 53 von 2026', () => {
    const w = getWeeksInRange('2026-12-31', '2027-01-04');
    expect(w.map((x) => x.key)).toEqual(['2026-W53', '2027-W1']);
  });
  test('isDateInWeek', () => {
    expect(isDateInWeek('2026-10-18', weeks[0])).toBe(true);
    expect(isDateInWeek('2026-10-19', weeks[0])).toBe(false);
  });
  test('currentWeekIndex', () => {
    expect(currentWeekIndex(weeks, '2026-10-20')).toBe(1);
    expect(currentWeekIndex(weeks, '2026-10-01')).toBe(0);
    expect(currentWeekIndex(weeks, '2026-11-30')).toBe(1);
    expect(currentWeekIndex([], '2026-10-20')).toBe(0);
  });
});

describe('formatShortDate', () => {
  test('deutscher Wochentag und Datum', () => expect(formatShortDate('2026-10-13')).toBe('Di., 13.10.'));
});

describe('upcomingWeeks', () => {
  const weeks = getWeeksInRange('2026-10-14', '2026-10-27'); // KW 42–44
  test('vergangene Wochen fallen weg', () => {
    expect(upcomingWeeks(weeks, '2026-10-21').map((w) => w.kw)).toEqual([43, 44]);
    expect(upcomingWeeks(weeks, '2026-10-18').map((w) => w.kw)).toEqual([42, 43, 44]);
  });
  test('Plan ganz vorbei: letzte Woche bleibt', () => {
    expect(upcomingWeeks(weeks, '2026-11-10').map((w) => w.kw)).toEqual([44]);
  });
});
