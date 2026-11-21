// 0036 – Einstellung „Beilagen“ je Familie: off (Standard) | suggest | auto
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sides_mode text`];
