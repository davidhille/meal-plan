// 0042 – Planung: Gericht, das ihr weggetauscht oder mit dem Plan verworfen habt, kommt lange nicht wieder
// (`meal_skips`), und eine Mindestzahl vegetarischer Gerichte pro Woche (`profiles.veg_min_per_week`, NULL = Standard 3).
export default [
  `CREATE TABLE IF NOT EXISTS meal_skips (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name text NOT NULL,
    times integer NOT NULL DEFAULT 1,
    last_skipped date NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (profile_id, meal_name)
  )`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS veg_min_per_week integer`,
];
