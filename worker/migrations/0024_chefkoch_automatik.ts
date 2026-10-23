// 0024 – Chefkoch-Automatik: täglich neue Hauptspeisen (ab 4,5 Sternen) in die Sammlung der Familie
export default [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chefkoch_auto boolean NOT NULL DEFAULT false`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chefkoch_auto_day text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chefkoch_auto_count integer NOT NULL DEFAULT 0`,
  // Geprüft, aber nicht übernommen (zu wenige Bewertungen, passt nicht …) – wird nicht noch einmal geladen
  `CREATE TABLE IF NOT EXISTS chefkoch_auto_skipped (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, url)
  )`,
];
