// 0035 – Beilagen und Salate am Gericht (Plan)
export default [
  // [{ "name", "kind": "beilage" | "salat", "ingredients": [], "instructions", "durationMin" }]; NULL = keine
  `ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS sides jsonb`,
];
