// 0032 – Chefkoch-Automatik: Rezepte mit zu wenigen Bewertungen nur zeitweise überspringen (neue Rezepte bekommen später mehr)
export default [
  // NULL = dauerhaft übersprungen (gelöscht, passt nicht); sonst ab diesem Zeitpunkt erneut prüfen
  `ALTER TABLE chefkoch_auto_skipped ADD COLUMN IF NOT EXISTS retry_after timestamptz`,
];
