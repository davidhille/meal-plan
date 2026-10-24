// 0029 – Routinen: Versuche pro Tag zählen. Scheitert das Erstellen des Plans, versucht der nächste Cron-Lauf es erneut
// (höchstens 3 Versuche am Tag, danach Push an den Betreiber), statt bis zur nächsten Woche zu warten.
export default [
  `ALTER TABLE routines ADD COLUMN IF NOT EXISTS run_attempts int NOT NULL DEFAULT 0`,
  `ALTER TABLE routines ADD COLUMN IF NOT EXISTS run_attempt_date date`,
];
