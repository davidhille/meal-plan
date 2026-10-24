// 0026 – Chefkoch-Automatik: Uhrzeit pro Familie einstellbar, Foto-Nachholen mit Versuchszähler
export default [
  // „HH:MM“ (Berliner Zeit): ab dann holt der Cron in Portionen neue Rezepte
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chefkoch_auto_time text NOT NULL DEFAULT '06:00'`,
  // Wie oft das Foto eines Chefkoch-Rezepts schon nachgeholt wurde (nach 5 Versuchen gibt der Cron auf)
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS photo_attempts integer NOT NULL DEFAULT 0`,
];
