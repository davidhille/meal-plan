// 0009 – Bewertungen: Datum der letzten Änderung (für „Eure Bewertung“ in der Rezept-Ansicht)
export default [
  `ALTER TABLE meal_ratings ADD COLUMN IF NOT EXISTS updated_at timestamptz`,
  `UPDATE meal_ratings SET updated_at = created_at WHERE updated_at IS NULL`,
];
