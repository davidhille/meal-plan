// Eigene Nachtische (aus der Chefkoch-Suche oder aus einem Hauptgericht verschoben) – neben der festen Sammlung im Frontend
export default [
  `CREATE TABLE IF NOT EXISTS custom_desserts (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL DEFAULT 'creme',
    yield text NOT NULL DEFAULT '4 Portionen',
    duration_min integer,
    ingredients text[] NOT NULL DEFAULT '{}',
    instructions text NOT NULL DEFAULT '',
    source_url text,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name)
  )`,
];
