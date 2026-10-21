// 0021 – Wochenplan teilen: Nur-Lese-Link ohne Anmeldung (in der Datenbank nur der Hash des Tokens)
export default [
  `ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS share_hash text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_share_idx ON meal_plans (share_hash) WHERE share_hash IS NOT NULL`,
];
