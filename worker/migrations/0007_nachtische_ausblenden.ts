// 0007 – Nachtische aus der Sammlung ausblenden (die Sammlung selbst liegt im Frontend)
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hidden_desserts text[] NOT NULL DEFAULT '{}'`];
