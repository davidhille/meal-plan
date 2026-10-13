// 0002 – Rezepte bearbeiten und Filter einzelnen Gerichten zuordnen
export default [
  // Bearbeitete Gerichte der Grundsammlung: Zeile in `recipes`, die das Original (Name) ersetzt
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS replaces text`,
  // Eigene Filter: Gerichte von Hand dazunehmen bzw. ausnehmen (zusätzlich zu Suchbegriffen/Zeit)
  `ALTER TABLE recipe_filters ADD COLUMN IF NOT EXISTS include_names text[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE recipe_filters ADD COLUMN IF NOT EXISTS exclude_names text[] NOT NULL DEFAULT '{}'`,
];
