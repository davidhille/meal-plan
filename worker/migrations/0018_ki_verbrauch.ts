// 0018 – KI-Verbrauch pro Familie: jeder erfolgreiche Workers-AI-Aufruf mit geschätzten Neurons
// (profile_id NULL = von der App selbst, z. B. Bilder per Cron; gelöschte Familien landen ebenfalls dort)
export default [
  `CREATE TABLE IF NOT EXISTS ai_usage (
    id bigserial PRIMARY KEY,
    profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    kind text NOT NULL,
    model text NOT NULL,
    neurons real NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage (created_at)`,
];
