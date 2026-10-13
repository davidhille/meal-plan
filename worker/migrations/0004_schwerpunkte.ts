// 0004 – Ernährungs-Schwerpunkte (Mehrfachauswahl) statt eines Gesundheitsziels, Fleisch-Grenze pro Woche
export default [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_focus text[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meat_max_per_week integer`,
  // Bisheriges Ziel übernehmen (health_goal bleibt als Spalte stehen, wird aber nicht mehr benutzt)
  `UPDATE profiles SET health_focus = CASE health_goal
      WHEN 'weight_loss' THEN '{calorie_light}'::text[]
      WHEN 'muscle_gain' THEN '{high_protein}'::text[]
      WHEN 'healthy_lifestyle' THEN '{whole_grain}'::text[]
      ELSE '{}'::text[] END
    WHERE health_focus = '{}'`,
  // Halal und koscher gibt es nicht mehr
  `UPDATE profiles SET health_conditions = array_remove(array_remove(health_conditions, 'kosher'), 'halal')`,
];
