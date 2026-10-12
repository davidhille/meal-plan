import { useState } from 'react';
import { Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import { ShopProvider, ShopRule, ShoppingLabel } from '../types';
import type { CartSummary } from '../lib/api';

interface CartBarProps {
  shops: { provider: ShopProvider; label: ShoppingLabel }[];
  /** undefined = lädt noch, null = nicht lesbar */
  carts: Partial<Record<ShopProvider, CartSummary | null>>;
  /** Dem Shop zugeordnet, aber noch nicht im Warenkorb (geschätzt) */
  pending: Partial<Record<ShopProvider, number>>;
  rules: Partial<Record<ShopProvider, ShopRule>>;
  onOpen: (provider: ShopProvider) => void;
  /** Warenkörbe und Preise neu laden; liefert eine kurze Meldung */
  onRefresh: () => Promise<string>;
}

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Immer sichtbare Leiste unten: aktueller Warenkorbwert je Shop und Stand zum Mindestbestellwert */
export default function CartBar({ shops, carts, pending, rules, onOpen, onRefresh }: CartBarProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setNote(null);
    try {
      setNote(await onRefresh());
    } catch (e) {
      setNote((e as Error).message || 'Aktualisieren hat nicht geklappt.');
    } finally {
      setRefreshing(false);
      setTimeout(() => setNote(null), 4000);
    }
  };

  return (
    <div className="sticky bottom-0 z-20 px-4 pb-3 pt-2 bg-gradient-to-t from-gray-50 via-gray-50 to-gray-50/0">
      {note && (
        <p role="status" className="mb-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs text-center">
          {note}
        </p>
      )}
      <div className="flex items-stretch gap-2">
        {shops.map(({ provider, label }) => {
          const cart = carts[provider];
          const rule = rules[provider] ?? { minOrder: 0, deliveryFee: 0 };
          const current = cart?.total ?? (cart ? cart.items.reduce((s, c) => s + (c.lineTotal ?? 0), 0) : 0);
          const extra = pending[provider] ?? 0;
          const total = current + extra;
          const missing = Math.max(0, rule.minOrder - total);
          const pct = rule.minOrder > 0 ? Math.min(100, (total / rule.minOrder) * 100) : 100;
          return (
            <button
              key={provider}
              onClick={() => onOpen(provider)}
              aria-label={`${label.name}-Warenkorb öffnen`}
              className="flex-1 min-w-0 flex flex-col justify-start text-left px-3 py-2 rounded-xl bg-white border border-gray-200 shadow-md hover:bg-gray-50"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} aria-hidden="true" />
                <span className="truncate">{label.name}</span>
                <ShoppingCart size={11} className="ml-auto text-gray-400 flex-shrink-0" aria-hidden="true" />
              </span>
              {cart === undefined ? (
                <span className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <Loader2 size={11} className="animate-spin" /> lädt …
                </span>
              ) : cart === null ? (
                <span className="block mt-1 text-xs text-gray-500">nicht lesbar</span>
              ) : (
                <>
                  <span className="block mt-0.5 text-sm font-bold text-gray-900 leading-tight">
                    {euro(current)}
                    {extra > 0 && <span className="text-xs font-semibold text-gray-600"> +{euro(extra)}</span>}
                  </span>
                  {rule.minOrder > 0 && (
                    <span
                      className="block mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                      role="progressbar"
                      aria-label={`${label.name}: Fortschritt bis zum Mindestbestellwert`}
                      aria-valuemin={0}
                      aria-valuemax={rule.minOrder}
                      aria-valuenow={Math.round(total * 100) / 100}
                    >
                      <span className={`block h-full rounded-full ${missing ? 'bg-amber-500' : 'bg-green-600'}`} style={{ width: `${pct}%` }} />
                    </span>
                  )}
                  <span className={`block mt-0.5 text-[11px] truncate ${missing ? 'text-amber-800' : 'text-green-800'}`}>
                    {missing ? `noch ${euro(missing)}` : rule.minOrder > 0 ? '✓ Mindestwert' : 'kein Mindestwert'}
                  </span>
                  {rule.deliveryFee > 0 && (
                    <span className="block text-[11px] text-gray-500 truncate">+{euro(rule.deliveryFee)} Liefergebühr</span>
                  )}
                </>
              )}
            </button>
          );
        })}
        <button
          onClick={refresh}
          disabled={refreshing}
          aria-label="Warenkörbe und Preise aktualisieren"
          title="Warenkörbe und Preise aktualisieren"
          className="w-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-white border border-gray-200 shadow-md text-gray-600 hover:bg-gray-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>
    </div>
  );
}
