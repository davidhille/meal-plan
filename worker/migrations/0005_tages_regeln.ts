// 0005 – Regeln pro Wochentag: frei (nicht planen) oder höchstens X Minuten Kochzeit
export default [
  // { "0".."6": { "off": true } | { "maxMinutes": 20 } } – Schlüssel wie getUTCDay (0 = Sonntag)
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS day_rules jsonb NOT NULL DEFAULT '{}'::jsonb`,
];
