// Regeln für Routinen (reine Rechnung, ohne Datenbank – testbar)

/** Höchstens so oft am Tag wird eine gescheiterte Routine erneut versucht (alle 15 Min, ein Versuch je Cron-Lauf) */
export const MAX_ROUTINE_ATTEMPTS = 3;

/** Nach einem Fehlschlag noch einmal versuchen? (`attempts` = Versuche heute, den gescheiterten eingerechnet) */
export const shouldRetryRoutine = (attempts: number) => attempts < MAX_ROUTINE_ATTEMPTS;

/** Ist die Routine jetzt fällig? Wöchentlich am Wochentag, monatlich am 1.; erst ab der Uhrzeit und höchstens einmal am Tag */
export function routineDue(
  r: { frequency: string; day_of_week: number | null; time: string | null; last_run_date: string | null },
  now: { date: string; time: string; weekday: number; day: number }
): boolean {
  const dueToday = r.frequency === "weekly" ? r.day_of_week === now.weekday : now.day === 1;
  return dueToday && now.time >= (r.time || "00:00") && r.last_run_date !== now.date;
}
