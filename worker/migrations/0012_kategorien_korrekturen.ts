// Speiseart/Hauptzutat pro Gericht von Hand korrigieren. Dazu: die eigenen Filter, die jetzt fest eingebaut sind
// (Nudeln, Reis, Huhn, Rind, Schwein), in Korrekturen umwandeln und löschen – von Hand Zugeordnetes bleibt erhalten.
const MAP = `(VALUES ('nudeln', 'nudeln'), ('reis', 'reis'), ('huhn', 'gefluegel'), ('rind', 'rind'), ('schwein', 'schwein')) AS m(filter_name, category_id)`;
const OLD = `lower(trim(f.name)) = m.filter_name AND f.scope IN ('gerichte', 'beide')`;

export default [
  `CREATE TABLE IF NOT EXISTS recipe_category_overrides (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipe_name text NOT NULL,
    category_id text NOT NULL,
    included boolean NOT NULL,
    PRIMARY KEY (profile_id, recipe_name, category_id)
  )`,
  `INSERT INTO recipe_category_overrides (profile_id, recipe_name, category_id, included)
    SELECT f.profile_id, n, m.category_id, true FROM recipe_filters f JOIN ${MAP} ON ${OLD}
    CROSS JOIN LATERAL unnest(f.include_names) AS n
    ON CONFLICT DO NOTHING`,
  `INSERT INTO recipe_category_overrides (profile_id, recipe_name, category_id, included)
    SELECT f.profile_id, n, m.category_id, false FROM recipe_filters f JOIN ${MAP} ON ${OLD}
    CROSS JOIN LATERAL unnest(f.exclude_names) AS n
    ON CONFLICT DO NOTHING`,
  `DELETE FROM recipe_filters f USING ${MAP} WHERE ${OLD}`,
];
