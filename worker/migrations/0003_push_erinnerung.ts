// 0003 – Erinnerung zum Bewerten per Push
export default [
  // Ein Eintrag pro Gerät, auf dem die Erinnerung eingeschaltet ist
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint text PRIMARY KEY,
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    label text,
    created_at timestamptz DEFAULT now()
  )`,
  // App-weite Einstellungen, z. B. die VAPID-Schlüssel (privater Teil verschlüsselt)
  `CREATE TABLE IF NOT EXISTS app_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    iv text,
    updated_at timestamptz DEFAULT now()
  )`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT '20:00'`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_last_sent date`,
];
