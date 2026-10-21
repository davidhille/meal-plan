// 0022 – Admin-Werkzeuge: KI-Budget pro Familie, Fehler-Protokoll, Feedback der Familien
export default [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_daily_limit integer`,
  `CREATE TABLE IF NOT EXISTS app_errors (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    source text NOT NULL,
    message text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS app_errors_created_idx ON app_errors (created_at)`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    user_name text,
    message text NOT NULL,
    done boolean NOT NULL DEFAULT false
  )`,
];
