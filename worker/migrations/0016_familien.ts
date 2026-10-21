// 0016 – Mehrere Familien: Name/Sperre je Familie, Betreiber (is_owner), Einladungslinks,
// eigene Rezepte (KI, Import, Bearbeitungen) gehören zu einer Familie
export default [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false`,
  // Betreiber = der erste Zugang überhaupt
  `UPDATE users SET is_owner = true
    WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE is_owner)`,
  `CREATE TABLE IF NOT EXISTS invites (
    token_hash text PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    used_at timestamptz
  )`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE`,
  // Bisherige Rezepte gehören der ersten Familie
  `UPDATE recipes SET profile_id = (SELECT id FROM profiles ORDER BY created_at LIMIT 1) WHERE profile_id IS NULL`,
  `ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_name_key`,
  // Falls die Eindeutigkeit von name anders heißt (ältere Datenbank): jede Unique-Regel nur auf name entfernen
  `DO $$ DECLARE c text; BEGIN
    FOR c IN SELECT conname FROM pg_constraint
      WHERE conrelid = 'recipes'::regclass AND contype = 'u'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'recipes'::regclass AND attname = 'name')]::smallint[]
    LOOP EXECUTE format('ALTER TABLE recipes DROP CONSTRAINT %I', c); END LOOP;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS recipes_profile_name_idx ON recipes (profile_id, name)`,
];
