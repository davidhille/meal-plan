// 0040 – Mengen-Regeln: Kategorie je Gericht von Hand zuordnen (included = zählt dazu) oder ausnehmen (false)
export default [
  `CREATE TABLE IF NOT EXISTS recipe_variety_overrides (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipe_name text NOT NULL,
    category_id text NOT NULL,
    included boolean NOT NULL,
    PRIMARY KEY (profile_id, recipe_name, category_id)
  )`,
];
