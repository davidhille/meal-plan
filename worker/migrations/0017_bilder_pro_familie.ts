// 0017 – Bilder pro Familie: „Neues Bild“ und „Bild entfernen“ legen eine eigene Fassung der Familie an
// (profile_id gesetzt); ohne profile_id = gemeinsames Bild für alle Familien
export default [
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE`,
  `ALTER TABLE meal_images DROP CONSTRAINT IF EXISTS meal_images_meal_name_key`,
  // Falls die Eindeutigkeit von meal_name anders heißt: jede Unique-Regel nur auf meal_name entfernen
  `DO $$ DECLARE c text; BEGIN
    FOR c IN SELECT conname FROM pg_constraint
      WHERE conrelid = 'meal_images'::regclass AND contype = 'u'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'meal_images'::regclass AND attname = 'meal_name')]::smallint[]
    LOOP EXECUTE format('ALTER TABLE meal_images DROP CONSTRAINT %I', c); END LOOP;
  END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meal_images_shared_idx ON meal_images (meal_name) WHERE profile_id IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meal_images_family_idx ON meal_images (profile_id, meal_name) WHERE profile_id IS NOT NULL`,
];
