// Kalenderwochen (ISO-8601) für die KW-Auswahl – übernommen aus der Juli-Version.
// Korrektur: Datumsangaben werden lokal formatiert (toISOString hätte in Deutschland
// wegen der Zeitzone den Vortag geliefert).

export interface PlanWeek {
  key: string;
  kw: number;
  weekStart: string;
  weekEnd: string;
}

export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** ISO-Kalenderwoche und deren Jahr (kann um den 1. Januar vom Kalenderjahr abweichen) */
function isoWeek(date: Date): { kw: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { kw: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

/** Eine KW pro Kalenderwoche, die der Plan berührt (chronologisch) */
export function getWeeksInRange(startDate: string, endDate: string): PlanWeek[] {
  const weeks = new Map<string, PlanWeek>();
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cursor <= end) {
    const { kw, year } = isoWeek(cursor);
    const key = `${year}-W${kw}`;
    if (!weeks.has(key)) {
      const monday = new Date(cursor);
      monday.setDate(monday.getDate() - ((cursor.getDay() || 7) - 1));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      weeks.set(key, { key, kw, weekStart: toIso(monday), weekEnd: toIso(sunday) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return [...weeks.values()];
}

export function isDateInWeek(dateStr: string, week: PlanWeek): boolean {
  return dateStr >= week.weekStart && dateStr <= week.weekEnd;
}

/** "2026-10-13" → "Di, 13.10." */
export function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
