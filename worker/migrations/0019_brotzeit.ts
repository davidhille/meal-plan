// 0019 – Brotzeit: Tage im Plan ohne Kochen (Platzhalter ohne Zutaten) und „x-mal pro Woche“ in den Einstellungen
export default [
  `ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS brotzeit boolean NOT NULL DEFAULT false`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brotzeit_per_week integer NOT NULL DEFAULT 0`,
];
