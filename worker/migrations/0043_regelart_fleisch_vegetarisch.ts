// 0043 – „Fleisch höchstens X× pro Woche“ (`meat_max_per_week`) und „Vegetarisch mindestens X× pro Woche“ (`veg_min_per_week`,
// NULL = Standard 3) sind jetzt Mengen-Regeln mit den Kategorien „fleisch“ und „vegetarisch“ (`profiles.variety_rules`).
// Wer noch keine eigenen Regeln hatte (NULL), bekommt die bisherigen Standard-Regeln ausdrücklich eingetragen. Die alten
// Spalten bleiben (nur additiv), werden aber nicht mehr gelesen.
const DEFAULTS = `'[
  {"id":"meeresfruechte","period":"week","max":1},
  {"id":"nudeln","period":"week","max":2},
  {"id":"asiatisch","period":"week","max":2},
  {"id":"asiatisch","period":"month","max":5},
  {"id":"pizza","period":"week","max":1},
  {"id":"burger","period":"week","max":1},
  {"id":"curry","period":"week","max":1}
]'::jsonb`;

export default [
  `UPDATE profiles SET variety_rules =
      COALESCE(variety_rules, ${DEFAULTS})
      || CASE WHEN meat_max_per_week IS NOT NULL
           THEN jsonb_build_array(jsonb_build_object('id', 'fleisch', 'period', 'week', 'max', meat_max_per_week))
           ELSE '[]'::jsonb END
      || CASE WHEN COALESCE(veg_min_per_week, 3) > 0
           THEN jsonb_build_array(jsonb_build_object('id', 'vegetarisch', 'period', 'week', 'min', COALESCE(veg_min_per_week, 3)))
           ELSE '[]'::jsonb END
    WHERE NOT (COALESCE(variety_rules, '[]'::jsonb) @> '[{"id":"fleisch"}]'::jsonb)
      AND NOT (COALESCE(variety_rules, '[]'::jsonb) @> '[{"id":"vegetarisch"}]'::jsonb)`,
];
