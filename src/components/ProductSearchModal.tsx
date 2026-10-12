import { useEffect, useState } from 'react';
import { X, Search, Loader2, Check, ImageOff, Unlink } from 'lucide-react';
import { ProductResult, ShoppingLabel } from '../types';
import { searchShop } from '../lib/api';
import { useDialog } from '../lib/useDialog';

interface ProductSearchModalProps {
  ingredientName: string;
  label: ShoppingLabel;
  provider: 'knuspr' | 'picnic';
  currentProductId?: string;
  onSelect: (product: ProductResult) => Promise<void>;
  /** Verknüpfung lösen (gewähltes Produkt abwählen) */
  onRemove?: () => Promise<void>;
  onClose: () => void;
}

/** Produkt bei Knuspr oder Picnic suchen und mit der Zutat verknüpfen (gilt auch für künftige Pläne) */
export default function ProductSearchModal({
  ingredientName,
  label,
  provider,
  currentProductId,
  onSelect,
  onRemove,
  onClose,
}: ProductSearchModalProps) {
  // Mengenangaben in Klammern helfen der Shop-Suche nicht
  const [query, setQuery] = useState(ingredientName.replace(/\(.*?\)/g, '').trim());
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const dialogRef = useDialog(onClose);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchShop(provider, q));
    } catch (e) {
      setResults([]);
      setError((e as Error).message === 'not_connected' ? `${label.name} ist nicht (mehr) verbunden – bitte im Profil neu verbinden.` : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        tabIndex={-1}
        className="outline-none relative w-full sm:max-w-md max-h-[88vh] bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} aria-hidden="true" />
              {label.name}
            </p>
            <h2 id="product-dialog-title" className="text-lg font-bold text-gray-800 leading-snug">Produkt für „{ingredientName}“</h2>
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
            className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <button
            type="submit"
            aria-label="Suchen"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-700 text-white"
          >
            <Search size={16} />
          </button>
        </form>

        {currentProductId && onRemove && (
          <div className="px-5 pb-3">
            <button
              onClick={async () => {
                setSavingId('remove');
                try {
                  await onRemove();
                } finally {
                  setSavingId(null);
                }
              }}
              disabled={savingId !== null}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100"
            >
              {savingId === 'remove' ? <Loader2 size={13} className="animate-spin" /> : <Unlink size={13} />}
              Auswahl entfernen – kein festes Produkt
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {loading && (
            <div className="py-10 flex justify-center" role="status" aria-label="Suche läuft">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          )}
          {!loading && error && <p role="alert" className="py-6 text-sm text-center text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="py-6 text-sm text-center text-gray-500">Keine Produkte gefunden.</p>
          )}
          {!loading &&
            results.map((p) => {
              const active = p.productId === currentProductId;
              return (
                <button
                  key={p.productId}
                  disabled={savingId !== null}
                  aria-pressed={active}
                  title={active && onRemove ? 'Nochmal antippen, um die Auswahl zu entfernen' : undefined}
                  onClick={async () => {
                    setSavingId(p.productId);
                    try {
                      // Gewähltes Produkt nochmal antippen = abwählen
                      if (active && onRemove) await onRemove();
                      else await onSelect(p);
                    } finally {
                      setSavingId(null);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                    active ? 'border-green-400 bg-green-50' : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" loading="lazy" className="w-14 h-14 rounded-xl object-contain bg-white flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ImageOff size={16} className="text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{p.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{[p.amount, p.price].filter(Boolean).join(' · ')}</p>
                    {active && onRemove && <p className="text-[11px] text-green-700 mt-0.5">Ausgewählt – nochmal antippen zum Abwählen</p>}
                  </div>
                  {savingId === p.productId ? (
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                  ) : active ? (
                    <Check size={18} className="text-green-500" />
                  ) : null}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
