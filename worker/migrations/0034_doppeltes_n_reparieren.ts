// 0034 – Einmalige Datenreparatur: „4 Prisenn Salz“, „16 Scheibenn Käse“, „8 Zehenn Knoblauch“ → ein „n“ weniger.
// Ursache war die Umrechnung beim Import („Prise(n)“ → „Prisen(n)“ → „Prisenn“, behoben in src/lib/portions.ts).
// Läuft über alle Tabellen mit Zutatenlisten und ist wiederholbar (ohne Treffer ändert sich nichts).
const TABLES = ["recipes", "plan_meals", "favorites", "custom_desserts"];
const BAD = "\\m(Prisen|Scheiben|Dosen|Zehen|Tassen|Stangen|Packungen)n\\M";

export default TABLES.map(
  (t) => `UPDATE ${t} SET ingredients = ARRAY(
    SELECT regexp_replace(i, '${BAD}', '\\1', 'gi') FROM unnest(ingredients) WITH ORDINALITY AS u(i, ord) ORDER BY ord
  ) WHERE EXISTS (SELECT 1 FROM unnest(ingredients) AS i WHERE i ~* '${BAD}')`
);
