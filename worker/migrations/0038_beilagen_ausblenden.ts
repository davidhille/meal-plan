// 0038 – Beilagen/Salate der festen Sammlung ausblenden (je Familie)
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hidden_sides text[] NOT NULL DEFAULT '{}'`];
