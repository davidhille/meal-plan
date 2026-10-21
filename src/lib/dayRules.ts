import { DayRule, DayRules } from '../types';

/** Wochentage in Anzeige-Reihenfolge (Mo–So), Schlüssel wie getDay (0 = Sonntag) */
export const WEEKDAYS: { key: string; short: string; long: string }[] = [
  { key: '1', short: 'Mo', long: 'Montag' },
  { key: '2', short: 'Di', long: 'Dienstag' },
  { key: '3', short: 'Mi', long: 'Mittwoch' },
  { key: '4', short: 'Do', long: 'Donnerstag' },
  { key: '5', short: 'Fr', long: 'Freitag' },
  { key: '6', short: 'Sa', long: 'Samstag' },
  { key: '0', short: 'So', long: 'Sonntag' },
];

export const MINUTE_CHOICES = [15, 20, 30, 45, 60];

/** Regel für ein Datum (YYYY-MM-DD, lokal) */
export function ruleForDate(iso: string, rules: DayRules | undefined): DayRule {
  return rules?.[String(new Date(`${iso}T12:00:00`).getDay())] ?? {};
}

/** Kurzbeschreibung, z. B. „Mi max. 20 Min · Fr Brotzeit · So frei · 2× Brotzeit pro Woche“ */
export function describeDayRules(rules: DayRules | undefined, brotzeitPerWeek = 0): string {
  const parts = WEEKDAYS.flatMap((d) => {
    const r = rules?.[d.key];
    if (r?.off) return [`${d.short} frei`];
    if (r?.brotzeit) return [`${d.short} Brotzeit`];
    if (r?.maxMinutes) return [`${d.short} max. ${r.maxMinutes} Min`];
    return [];
  });
  if (brotzeitPerWeek > 0) parts.push(`${brotzeitPerWeek}× Brotzeit pro Woche`);
  return parts.length ? parts.join(' · ') : 'Jeder Tag wird normal geplant';
}
