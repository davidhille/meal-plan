import { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, Check, ImageOff, Unlink, TrendingDown } from 'lucide-react';
import { ProductResult, ShopProvider, ShoppingItem, ShoppingLabel } from '../types';
import { searchShop } from '../lib/api';
import { useDialog } from '../lib/useDialog';
import { packagesNeeded, parseEuro, unitPrice } from '../lib/unitPrice';

interface ProductSearchModalProps {
  item: ShoppingItem;
  /** Verbundene Shops (Knuspr/Picnic) mit ihrer Liste */
  shops: { provider: ShopProvider; label: ShoppingLabel }[];
  onSelect: (provider: ShopProvider, product: ProductResult) => Promise<void>;
  /** Verknüpfung in einem Shop lösen */
  onRemove: (provider: ShopProvider) => Promise<void>;
  onClose: () => void;
}

type ShopResults = { loading: boolean; error: string | null; results: ProductResult[] };

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Produkt suchen und verknüpfen – alle verbundenen Shops nebeneinander mit Grundpreis */
export default function ProductSearchModal({ item, shops, onSelect, onRemove, onClose }: ProductSearchModalProps) {
  // Mengenangaben in Klammern helfen der Shop-Suche nicht
  const [query, setQuery] = useState(item.baseName.replace(/\(.*?\)/g, '').trim());
  const [byShop, setByShop] = useState<Partial<Record<ShopProvider, ShopResults>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialog(onClose);

  const run = (q: string) => {
    if (!q.trim()) return;
    for (const { provider, label } of shops) {
      setByShop((prev) => ({ ...prev, [provider]: { loading: true, error: null, results: prev[provider]?.results ?? [] } }));
      searchShop(provider, q)
        .then((results) => setByShop((prev) => ({ ...prev, [provider]: { loading: false, error: null, results } })))
        .catch((e) =>
          setByShop((prev) => ({
            ...prev,
            [provider]: {
              loading: false,
              results: [],
              error:
                (e as Error).message === 'not_connected'
                  ? `${label.name} ist nicht (mehr) verbunden – bitte in den Einstellungen neu verbinden.`
                  : (e as Error).message,
            },
          }))
        );
    }
  };

  useEffect(() => {
    run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Günstigster Grundpreis über alle Shops (nur innerhalb der häufigsten Einheit vergleichbar)
  const best = useMemo(() => {
    const all = shops.flatMap(({ provider }) =>
      (byShop[provider]?.results ?? []).map((p) => ({ key: `${provider}:${p.productId}`, up: unitPrice(parseEuro(p.price), p.amount) }))
    );
    const counts = new Map<string, number>();
    for (const a of all) if (a.up) counts.set(a.up.unit, (counts.get(a.up.unit) ?? 0) + 1);
    const unit = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const candidates = all.filter((a) => a.up && a.up.unit === unit);
    if (candidates.length < 2) return null;
    return candidates.reduce((m, a) => (a.up!.value < m.up!.value ? a : m)).key;
  }, [byShop, shops]);

  // Vergleich der verknüpften Produkte (wenn in mehreren Shops verknüpft)
  const linkedCompare = shops
    .map(({ provider, label }) => {
      const l = item.links?.[provider];
      if (!l || l.productPrice == null) return null;
      const packs = packagesNeeded(item.name, l.productAmount);
      return { provider, label, link: l, packs, total: l.productPrice * packs, up: unitPrice(l.productPrice, l.productAmount) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const cheapestLinked = linkedCompare.length > 1 ? linkedCompare.reduce((m, x) => (x.total < m.total ? x : m)) : null;

  const choose = async (provider: ShopProvider, p: ProductResult, active: boolean) => {
    setSavingId(`${provider}:${p.productId}`);
    setError(null);
    try {
      // Gewähltes Produkt nochmal antippen = abwählen
      if (active) await onRemove(provider);
      else await onSelect(provider, p);
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        tabIndex={-1}
        className="outline-none relative w-full sm:max-w-md max-h-[90vh] bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Produkt wählen · {item.name}</p>
            <h2 id="product-dialog-title" className="text-lg font-bold text-gray-800 leading-snug">
              Produkt für „{item.baseName}“
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
          className="flex gap-2 px-5 pb-3"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Suchbegriff"
            type="search"
            className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button type="submit" aria-label="Suchen" className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-700 text-white">
            <Search size={16} />
          </button>
        </form>

        {cheapestLinked && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-white border border-gray-100 text-xs text-gray-700 space-y-0.5" aria-live="polite">
            {linkedCompare.map((x) => (
              <p key={x.provider} className={x === cheapestLinked ? 'font-semibold text-brand-800' : ''}>
                {x.label.name}: {x.packs > 1 ? `${x.packs} × ${euro(x.link.productPrice!)} = ` : ''}
                {euro(x.total)}
                {x.up ? ` (${x.up.label})` : ''}
                {x === cheapestLinked ? ' – günstiger' : ''}
              </p>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="mx-5 mb-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          {shops.map(({ provider, label }) => {
            const state = byShop[provider];
            const linked = item.links?.[provider];
            return (
              <section key={provider} aria-labelledby={`shop-${provider}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
                  <h3 id={`shop-${provider}`} className="flex-1 text-sm font-semibold text-gray-800">
                    {label.name}
                  </h3>
                  {linked && (
                    <button
                      onClick={async () => {
                        setSavingId(`${provider}:remove`);
                        try {
                          await onRemove(provider);
                        } finally {
                          setSavingId(null);
                        }
                      }}
                      disabled={savingId !== null}
                      className="flex items-center gap-1 px-2 h-7 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      {savingId === `${provider}:remove` ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}
                      Auswahl entfernen
                    </button>
                  )}
                </div>
                {state?.loading ? (
                  <div className="py-6 flex justify-center" role="status" aria-label={`Suche bei ${label.name} läuft`}>
                    <Loader2 size={18} className="animate-spin text-gray-300" />
                  </div>
                ) : state?.error ? (
                  <p role="alert" className="py-3 text-xs text-red-600">
                    {state.error}
                  </p>
                ) : !state || state.results.length === 0 ? (
                  <p className="py-3 text-xs text-gray-500">Keine Produkte gefunden.</p>
                ) : (
                  <ul className="space-y-2">
                    {state.results.map((p) => {
                      const key = `${provider}:${p.productId}`;
                      const active = linked?.productId === p.productId;
                      const price = parseEuro(p.price);
                      const up = unitPrice(price, p.amount);
                      const packs = packagesNeeded(item.name, p.amount);
                      return (
                        <li key={p.productId}>
                          <button
                            disabled={savingId !== null}
                            aria-pressed={active}
                            onClick={() => choose(provider, p, active)}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                              active ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white hover:bg-gray-50'
                            }`}
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-contain bg-white flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <ImageOff size={16} className="text-gray-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 leading-snug">{p.name}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {[p.amount, price != null ? euro(price) : p.price].filter(Boolean).join(' · ')}
                                {up && <span className="text-gray-500"> · {up.label}</span>}
                              </p>
                              {price != null && packs > 1 && (
                                <p className="text-xs text-gray-600">
                                  Für {item.name.split(' ')[0]}: {packs} × = {euro(price * packs)}
                                </p>
                              )}
                              {best === key && (
                                <p className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md text-xs font-semibold bg-brand-100 text-brand-800">
                                  <TrendingDown size={10} aria-hidden="true" /> Günstigster Grundpreis
                                </p>
                              )}
                              {active && <p className="text-xs text-brand-700 mt-0.5">Ausgewählt – nochmal antippen zum Abwählen</p>}
                            </div>
                            {savingId === key ? (
                              <Loader2 size={16} className="animate-spin text-gray-500" />
                            ) : active ? (
                              <Check size={18} className="text-brand-600" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
