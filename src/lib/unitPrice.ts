// Grundpreis-Berechnung für den Preisvergleich (Packungsangaben der Shops sind Freitext)

export type BaseUnit = 'g' | 'ml' | 'stk';

/** „1,99 €“ → 1.99 */
export function parseEuro(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const m = raw.replace(/\s/g, '').match(/(\d+(?:[.,]\d{1,2})?)/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

const num = (s: string) => Number(s.replace(',', '.'));

/**
 * Packungsangabe in Basiseinheit: „500 g“ → 500 g, „1,5 l“ → 1500 ml, „6 x 0,33 l“ → 1980 ml, „10 Stück“ → 10 Stk.
 * null, wenn nichts Verwertbares drinsteht.
 */
export function parseAmount(raw: string | undefined | null): { qty: number; unit: BaseUnit } | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/ca\.?/g, '').trim();
  const multi = s.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (multi) {
    const one = parseAmount(`${multi[2]} ${multi[3]}`);
    return one ? { qty: one.qty * Number(multi[1]), unit: one.unit } : null;
  }
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|stück|stk|st\.|er|eier|blatt|scheiben)\b/);
  if (!m) return null;
  const v = num(m[1]);
  switch (m[2]) {
    case 'kg':
      return { qty: v * 1000, unit: 'g' };
    case 'g':
      return { qty: v, unit: 'g' };
    case 'l':
      return { qty: v * 1000, unit: 'ml' };
    case 'cl':
      return { qty: v * 10, unit: 'ml' };
    case 'ml':
      return { qty: v, unit: 'ml' };
    default:
      return { qty: v, unit: 'stk' };
  }
}

/** Grundpreis je kg, l oder Stück */
export function unitPrice(price: number | null, amount: string | undefined | null): { value: number; unit: BaseUnit; label: string } | null {
  const a = parseAmount(amount);
  if (price == null || !a || a.qty <= 0) return null;
  const value = a.unit === 'stk' ? price / a.qty : (price / a.qty) * 1000;
  const per = a.unit === 'g' ? 'kg' : a.unit === 'ml' ? 'l' : 'Stk.';
  return { value, unit: a.unit, label: `${value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}/${per}` };
}

/**
 * Benötigte Menge aus dem Listeneintrag („800g Spaghetti“, „1,5 kg Kartoffeln“, „3 Zwiebeln“).
 * Ohne Einheit zählt die Zahl als Stück.
 */
export function neededAmount(itemName: string): { qty: number; unit: BaseUnit } | null {
  const withUnit = parseAmount(itemName.match(/^\s*[\d.,]+\s*(?:kg|g|ml|cl|l)\b/i)?.[0]);
  if (withUnit) return withUnit;
  const pieces = itemName.match(/^\s*(\d+(?:[.,]\d+)?)\s+(?!(?:el|tl|prise|bund|dose|dosen|glas|pck)\b)/i);
  return pieces ? { qty: num(pieces[1]), unit: 'stk' } : null;
}

/** Wie viele Packungen werden gebraucht? 1, wenn sich das nicht sinnvoll berechnen lässt */
export function packagesNeeded(itemName: string, amount: string | undefined | null): number {
  const need = neededAmount(itemName);
  const pack = parseAmount(amount);
  if (!need || !pack || need.unit !== pack.unit || pack.qty <= 0) return 1;
  return Math.max(1, Math.min(20, Math.ceil(need.qty / pack.qty - 0.05)));
}
