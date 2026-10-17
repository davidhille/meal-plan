// 0013 – Bewusst leer gelassene Tage eines Plans („Tag leeren“, Gericht weg verschoben) merken,
// damit „Plan verlängern“ sie nicht wieder befüllt
export default [`ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS cleared_dates date[] NOT NULL DEFAULT '{}'`];
