// 0041 – Einmalige Datenreparatur: Gerichte mit Ente, Gans, Wild, Hack usw. waren als „vegetarisch“ gespeichert
// („Schnelle Knusperente auf Grillgemüse“ – die Fleisch-Erkennung kannte „Enten“ nicht, behoben in worker/meals.ts `MEAT_RE`).
// Betrifft nur Rezepte mit Typ „vegetarisch“; ohne Treffer ändert sich nichts.
const WORDS =
  "\\m(ente|enten|entenbrust|entenkeule|gans|gänse|truthahn|putenbrust|kaninchen|wildschwein|rumpsteak|entrecôte|entrecote|kotelett|gyros|frikadelle|bulette|gulasch|pancetta|bacon|hack|zander|scholle|seelachs|pangasius|matjes|anchovis|hummer)\\M";
export default [
  `UPDATE recipes SET type = 'fleisch' WHERE type = 'vegetarisch'
    AND (name ~* '${WORDS}' OR array_to_string(ingredients, ' | ') ~* '${WORDS}')`,
];
