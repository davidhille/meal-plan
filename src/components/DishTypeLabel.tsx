import { Beef, Fish, Leaf, Sunset } from 'lucide-react';
import { DISH_KIND_LABEL, DishKind } from '../lib/dishType';

/** Farbe des Balkens und des Symbols je Typ (nur aus der Palette) */
export const DISH_KIND_STYLE: Record<DishKind, { bar: string; icon: string }> = {
  vegetarisch: { bar: 'bg-brand-600', icon: 'text-brand-700' },
  fleisch: { bar: 'bg-coral-500', icon: 'text-coral-700' },
  fisch: { bar: 'bg-coral-300', icon: 'text-coral-700' },
  wochenende: { bar: 'bg-brand-900', icon: 'text-brand-900' },
};

const ICON = { vegetarisch: Leaf, fleisch: Beef, fisch: Fish, wochenende: Sunset };

/** Symbol + Name des Typs, z. B. 🐟 Fisch – überall gleich */
export default function DishTypeLabel({ kind }: { kind: DishKind }) {
  const Icon = ICON[kind];
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <Icon size={11} className={DISH_KIND_STYLE[kind].icon} aria-hidden="true" />
      {DISH_KIND_LABEL[kind]}
    </span>
  );
}
