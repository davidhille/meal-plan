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

/**
 * Chefkoch-Automatik: welche Familie ist in diesem Cron-Lauf dran? Je Lauf nur eine – eine Familie braucht ca. 20 Unteranfragen
 * (Datenbank + Chefkoch), das Free-Limit liegt bei 50 je Lauf. Reihum unter den fälligen Familien, die das Tageslimit noch nicht
 * erreicht haben (`tick` = laufende Nummer des 15-Minuten-Takts); so kommt jede dran, auch wenn eine gerade nichts Passendes findet.
 */
export function pickAutoFamily<T extends { id: string; due: boolean; open: boolean }>(families: T[], tick: number): T | undefined {
  const candidates = families.filter((f) => f.due && f.open).sort((a, b) => a.id.localeCompare(b.id));
  return candidates.length ? candidates[tick % candidates.length] : undefined;
}

/** Laufende Nummer des 15-Minuten-Takts (für `pickAutoFamily`) */
export const cronTick = (nowMs: number) => Math.floor(nowMs / (15 * 60 * 1000));
