// 0025 – Chefkoch-Automatik: neu übernommene Rezepte sind „zu prüfen“ (Markierung „Neu“, bis man sie behält)
export default [
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS auto_review boolean NOT NULL DEFAULT false`,
  // Einmalig: Chefkoch-Importe der letzten zwei Tage bei Familien mit eingeschalteter Automatik gelten als neu
  // (die Automatik lief schon, bevor es die Markierung gab; Eigenimporte lassen sich einfach „behalten“)
  `UPDATE recipes SET auto_review = true
    WHERE source = 'import' AND source_url LIKE '%chefkoch.de%' AND created_at > now() - interval '2 days'
      AND profile_id IN (SELECT id FROM profiles WHERE chefkoch_auto)`,
];
