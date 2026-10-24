/**
 * Das Chefkoch-CDN schickt CORS-Header nur für bestimmte Zuschnitte (geprüft am 24.10.2026 von miyummy.com aus): 160x120, 240x300,
 * 600x400, 720x480 und 960x640 gehen, der Zuschnitt der Rezeptseite (960x540) und andere Größen nicht (kein CORS bzw. 400).
 * Die App probiert deshalb zuerst die erlaubten Größen und zuletzt die Adresse von der Rezeptseite.
 */
const ALLOWED_CROPS = ['960x640', '600x400'];

/** Bild-Adressen in der Reihenfolge, in der der Browser sie versucht */
export function photoCandidates(url: string): string[] {
  const swapped = /\/crop-\d+x\d+\//.test(url) ? ALLOWED_CROPS.map((c) => url.replace(/\/crop-\d+x\d+\//, `/crop-${c}/`)) : [];
  return [...new Set([...swapped, url])];
}
