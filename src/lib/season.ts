// Was in Deutschland gerade Saison hat (grob nach Monat). Gemeinsam für Planung (worker/nutrition.ts) und Anzeige im Plan.

/** Suchwort (klein, Wortanfang reicht) → Anzeigename */
const SEASON: { months: number[]; words: Record<string, string> }[] = [
  {
    months: [3, 4, 5],
    words: { spargel: 'Spargel', bärlauch: 'Bärlauch', radieschen: 'Radieschen', spinat: 'Spinat', rhabarber: 'Rhabarber',
      frühlingszwiebel: 'Frühlingszwiebeln', kohlrabi: 'Kohlrabi', erbsen: 'Erbsen' },
  },
  {
    months: [6, 7, 8],
    words: { tomate: 'Tomaten', zucchini: 'Zucchini', paprika: 'Paprika', aubergine: 'Auberginen', gurke: 'Gurken', bohnen: 'Bohnen',
      mais: 'Mais', beeren: 'Beeren', erdbeer: 'Erdbeeren', kirsch: 'Kirschen', fenchel: 'Fenchel', mangold: 'Mangold' },
  },
  {
    months: [9, 10, 11],
    words: { kürbis: 'Kürbis', rosenkohl: 'Rosenkohl', wirsing: 'Wirsing', kohl: 'Kohl', pfifferling: 'Pfifferlinge', pilz: 'Pilze',
      champignon: 'Champignons', apfel: 'Äpfel', birne: 'Birnen', 'rote bete': 'Rote Bete', lauch: 'Lauch', maronen: 'Maronen',
      pastinake: 'Pastinaken', steckrübe: 'Steckrüben', zwetschg: 'Zwetschgen' },
  },
  {
    months: [12, 1, 2],
    words: { grünkohl: 'Grünkohl', rotkohl: 'Rotkohl', wirsing: 'Wirsing', rosenkohl: 'Rosenkohl', 'rote bete': 'Rote Bete',
      pastinake: 'Pastinaken', schwarzwurzel: 'Schwarzwurzeln', lauch: 'Lauch', sellerie: 'Sellerie', feldsalat: 'Feldsalat',
      steckrübe: 'Steckrüben', kohl: 'Kohl' },
  },
];

const entries = (month: number) => Object.entries(SEASON.find((s) => s.months.includes(month))?.words ?? {});

/** Suchwörter der Saison (für die Planung „saisonal“) */
export function seasonalWords(month: number): string[] {
  return entries(month).map(([w]) => w);
}

/**
 * Saison-Zutaten eines Gerichts (Anzeigenamen, höchstens zwei), z. B. ["Kürbis"]. Zutaten wie „Apfelessig“ zählen nicht.
 * month = 1–12 (Monat des Plan-Tags).
 */
export function seasonHighlights(name: string, ingredients: string[], month: number): string[] {
  const text = [name, ...ingredients].join(' | ').toLowerCase().replace(/\w*essig|\w*saft|\w*mark\b|\w*pulver/g, '');
  const found: string[] = [];
  for (const [word, label] of entries(month)) {
    // „kohl“ nicht, wenn schon Rosenkohl/Rotkohl/Grünkohl/Kohlrabi gefunden wurde
    if (word === 'kohl' && found.some((f) => /kohl/i.test(f))) continue;
    if (text.includes(word) && !found.includes(label)) found.push(label);
    if (found.length === 2) break;
  }
  return found;
}
