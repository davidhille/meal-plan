import { useEffect, useState } from 'react';
import { X, Search, Loader2, Check, ImageOff } from 'lucide-react';
import { ProductResult, ShoppingLabel } from '../types';
import { searchShop } from '../lib/api';

interface ProductSearchModalProps {
  ingredientName: string;
  label: ShoppingLabel;
  provider: 'knuspr' | 'picnic';
  currentProductId?: string;
  onSelect: (product: ProductResult) => Promise<void>;
  onClose: () => void;
}

/** Produkt bei Knuspr oder Picnic suchen und mit der Zutat verknüpfen (gilt auch für künftige Pläne) */
export default function ProductSearchModal({
  ingredientName,
  label,
  provider,
  currentProductId,
  onSelect,
  onClose,
}: ProductSearchModalProps) {
  // Mengenangaben in Klammern helfen der Shop-Suche nicht
  const [query, setQuery] = useState(ingredientName.replace(/\(.*?\)/g, '').trim());
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

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
      <div className="relative w-full sm:max-w-md max-h-[88vh] bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: label.color }}>
              {label.name}
            </p>
            <h2 className="text-lg font-bold text-gray-800 leading-snug">Produkt für „{ingredientName}“</h2>
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
            className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <button
            type="submit"
            aria-label="Suchen"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-green-500 text-white"
          >
            <Search size={16} />
          </button>
        </form>

        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-2">
          {loading && (
            <div className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          )}
          {!loading && error && <p className="py-6 text-sm text-center text-red-500">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="py-6 text-sm text-center text-gray-400">Keine Produkte gefunden.</p>
          )}
          {!loading &&
            results.map((p) => {
              const active = p.productId === currentProductId;
              return (
                <button
                  key={p.productId}
                  disabled={savingId !== null}
                  onClick={async () => {
                    setSavingId(p.productId);
                    try {
                      await onSelect(p);
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
                  </div>
                  {savingId === p.productId ? (
                    <Loader2 size={16} className="animate-spin text-gray-400" />
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
