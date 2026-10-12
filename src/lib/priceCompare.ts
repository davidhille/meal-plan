import { ShopProvider, ShopRule, ShoppingItem, ShoppingLabel } from '../types';
import { packagesNeeded } from './unitPrice';

export interface ShopTotal {
  provider: ShopProvider;
  label: ShoppingLabel;
  /** Summe der vergleichbaren Artikel (Preis × Packungen) */
  total: number;
  deliveryFee: number;
  minOrder: number;
  /** Was bis zum Mindestbestellwert fehlt (0 = erreicht) */
  missing: number;
  /** Artikel, die nur in diesem Shop verknüpft sind */
  onlyHere: number;
}

export interface PriceComparison {
  shops: ShopTotal[];
  /** Artikel mit Preis in allen Shops */
  comparable: ShoppingItem[];
  /** Offene Artikel auf Shop-Listen insgesamt */
  considered: number;
  /** Ohne Verknüpfung in irgendeinem Shop */
  unlinked: number;
  /** Empfohlener Shop (null = kein klarer Vorteil) */
  best: ShopTotal | null;
  /** Ersparnis gegenüber dem anderen Shop (inkl. Liefergebühr) */
  saving: number;
}

const providers: ShopProvider[] = ['knuspr', 'picnic'];

/** Offene Artikel auf Knuspr-/Picnic-Listen in allen verbundenen Shops vergleichen */
export function compareShops(
  items: ShoppingItem[],
  labels: ShoppingLabel[],
  rules: Partial<Record<ShopProvider, ShopRule>>
): PriceComparison | null {
  const shopLabels = providers
    .map((p) => ({ provider: p, label: labels.find((l) => l.provider === p) }))
    .filter((s): s is { provider: ShopProvider; label: ShoppingLabel } => !!s.label);
  if (shopLabels.length < 2) return null;

  const shopLabelIds = new Set(shopLabels.map((s) => s.label.id));
  const open = items.filter((i) => !i.checked && shopLabelIds.has(i.label));
  const priced = (i: ShoppingItem, p: ShopProvider) => i.links?.[p]?.productPrice != null;
  const comparable = open.filter((i) => shopLabels.every((s) => priced(i, s.provider)));

  const shops: ShopTotal[] = shopLabels.map(({ provider, label }) => {
    const total = comparable.reduce((sum, i) => {
      const l = i.links![provider]!;
      return sum + l.productPrice! * packagesNeeded(i.name, l.productAmount);
    }, 0);
    const rule = rules[provider] ?? { minOrder: 0, deliveryFee: 0 };
    return {
      provider,
      label,
      total: Math.round(total * 100) / 100,
      deliveryFee: rule.deliveryFee,
      minOrder: rule.minOrder,
      missing: Math.max(0, Math.round((rule.minOrder - total) * 100) / 100),
      onlyHere: open.filter((i) => priced(i, provider) && shopLabels.some((s) => s.provider !== provider && !priced(i, s.provider))).length,
    };
  });

  const unlinked = open.filter((i) => shopLabels.every((s) => !i.links?.[s.provider])).length;
  if (!comparable.length) return { shops, comparable, considered: open.length, unlinked, best: null, saving: 0 };

  // Effektive Kosten: Summe + Liefergebühr; wer den Mindestbestellwert nicht erreicht, muss mindestens bis dahin auffüllen
  const effective = (s: ShopTotal) => Math.max(s.total, s.minOrder) + s.deliveryFee;
  const sorted = [...shops].sort((a, b) => a.total + a.deliveryFee - (b.total + b.deliveryFee));
  const [cheapest, other] = sorted;
  let best: ShopTotal | null = cheapest;
  let saving = other.total + other.deliveryFee - (cheapest.total + cheapest.deliveryFee);
  // Lohnt sich der günstigere Shop noch, wenn man dort bis zum Mindestbestellwert auffüllen muss?
  if (cheapest.missing > 0 && other.missing === 0 && effective(cheapest) >= effective(other)) {
    best = other;
    saving = 0;
  }
  // Praktisch gleich teuer → keine Empfehlung
  if (best === cheapest && saving < 0.01) best = null;
  return { shops, comparable, considered: open.length, unlinked, best, saving: Math.round(Math.max(0, saving) * 100) / 100 };
}
