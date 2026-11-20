/**
 * Zutatenname ohne Füllwörter aus dem Rezepttext: „Etwas Butter zum Braten“ → „Butter“.
 * Geteilt: der Server prüft damit den Vorrat (worker/shopping.ts), die App füllt damit den Namen im Vorrat-Fenster vor.
 * Bleibt der Name danach leer, gilt der Originaltext.
 */
const LEADING = /^(?:etwas|ein\s+(?:bisschen|wenig|paar\s+spritzer)|evtl\.?|eventuell|optional:?)\s+/i;
const TRAILING_COOKING =
  /\s+(?:zum|zur|zu)\s+(?:an|aus|ein|ab|durch)?(?:braten|fetten|frittieren|backen|kochen|bestreichen|beträufeln|bestäuben|panieren|würzen|abschmecken|servieren|garnieren|anbraten|anbräunen|ablöschen|dünsten|anschwitzen|pinseln)\b.*$/i;
const TRAILING_AMOUNT = /\s+(?:nach\s+(?:belieben|bedarf|geschmack)|nach\s+wunsch|zum\s+servieren)\s*$/i;

export function cleanIngredientName(name: string): string {
  let n = name.trim();
  for (let i = 0; i < 3; i++) {
    const next = n.replace(LEADING, "").replace(TRAILING_COOKING, "").replace(TRAILING_AMOUNT, "").trim();
    if (next === n) break;
    n = next;
  }
  return n || name.trim();
}
