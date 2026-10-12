import { FamilyMember } from '../types';

/** Alle hinterlegten Rezepte sind für 4 Portionen geschrieben */
export const RECIPE_BASE_PORTIONS = 4;

/** Portionsbedarf pro Person: Erwachsene 1, Kinder je nach Alter */
export function portionFor(member: Pick<FamilyMember, 'type' | 'age'>): number {
  if (member.type === 'adult') return 1;
  const age = member.age ?? 8;
  if (age <= 6) return 0.5;
  if (age <= 12) return 0.75;
  return 1;
}

/** Portionen für die ganze Familie, auf halbe Portionen gerundet (ohne Familie: 4) */
export function familyPortions(members: FamilyMember[]): number {
  if (members.length === 0) return RECIPE_BASE_PORTIONS;
  const sum = members.reduce((acc, m) => acc + portionFor(m), 0);
  return Math.max(1, Math.round(sum * 2) / 2);
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const QTY_RE = /^(\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾])(\s*)(.*)$/;
const FINE_UNITS = /^(g|kg|ml|l)\b/i;
/** Maßeinheiten, bei denen halbe Mengen sinnvoll sind (½ EL, 1,5 Dosen …) */
const MEASURE_UNITS = /^(el|tl|msp|dose|dosen|glas|gläser|bund|prise|prisen|pck|päckchen|packung|becher|tasse|tassen|stange|stangen|scheibe|scheiben|zehe|zehen|handvoll|liter|cm)\b/i;

function parseQty(raw: string): number {
  if (raw in FRACTIONS) return FRACTIONS[raw];
  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map(Number);
    return b ? a / b : NaN;
  }
  return Number(raw.replace(',', '.'));
}

function formatQty(value: number, rest: string): string {
  let rounded: number;
  if (/^(g|ml)\b/i.test(rest)) {
    rounded = value >= 100 ? Math.round(value / 25) * 25 : Math.max(5, Math.round(value / 5) * 5);
  } else if (FINE_UNITS.test(rest)) {
    rounded = Math.round(value * 10) / 10;
  } else if (value >= 1.5 && !MEASURE_UNITS.test(rest)) {
    // Ganze Stücke aufrunden: „3,5 Hähnchenschenkel“ → 4 (kleine Mengen wie ½ Zwiebel bleiben)
    rounded = Math.ceil(value - 0.01);
  } else {
    // EL, TL, Dosen …: auf halbe Einheiten, mindestens ½
    rounded = Math.max(0.5, Math.round(value * 2) / 2);
  }
  if (rounded === 0.5) return '½';
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
}

/** Mengenangabe am Anfang einer Zutat umrechnen, z. B. "400g Spaghetti" × 0,75 → "300g Spaghetti" */
export function scaleIngredient(ingredient: string, factor: number): string {
  if (factor === 1) return ingredient;
  const m = ingredient.match(QTY_RE);
  if (!m) return ingredient;
  const qty = parseQty(m[1]);
  if (!Number.isFinite(qty)) return ingredient;
  return `${formatQty(qty * factor, m[3])}${m[2]}${m[3]}`;
}

export function formatPortions(p: number): string {
  return Number.isInteger(p) ? String(p) : String(p).replace('.', ',');
}
