// 0037 – Eigene Beilagen und Salate je Familie (Chefkoch-Link, KI, selbst geschrieben)
export default [
  `CREATE TABLE IF NOT EXISTS custom_sides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL,
    ingredients text[] NOT NULL,
    instructions text NOT NULL DEFAULT '',
    duration_min integer,
    source_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (profile_id, name)
  )`,
];
