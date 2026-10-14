// 0008 – Nachtische endgültig löschen (verschwinden auch aus der Liste der ausgeblendeten)
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_desserts text[] NOT NULL DEFAULT '{}'`];
