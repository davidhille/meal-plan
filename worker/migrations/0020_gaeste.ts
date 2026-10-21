// 0020 – Gäste pro Tag: zusätzliche Portionen für ein Gericht im Plan (Einkaufsliste und Rezeptansicht rechnen mit)
export default [`ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS guests real NOT NULL DEFAULT 0`];
