import { useState, useEffect } from 'react';
import { X, Search, ShoppingCart, Loader2 } from 'lucide-react';
import { searchAmazon, AmazonSuggestion } from '../lib/amazon';

interface AmazonPreviewModalProps {
  ingredientName: string;
  onSelect: (asin: string, productName: string) => void;
  onClose: () => void;
}

export default function AmazonPreviewModal({
  ingredientName,
  onSelect,
  onClose,
}: AmazonPreviewModalProps) {
  const [suggestions, setSuggestions] = useState<AmazonSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setLoading(true);
      setError(false);
      try {
        const results = await searchAmazon(`Knuspr ${ingredientName}`);
        setSuggestions(results);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [ingredientName]);

  const handleSelect = (suggestion: AmazonSuggestion) => {
    if (suggestion.asin) {
      onSelect(suggestion.asin, suggestion.value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Amazon Produkt-Vorschau</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Context */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500">
            Suchbegriff: <span className="font-medium text-gray-700">Knuspr {ingredientName}</span>
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500">Suche auf Amazon.de...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Search size={24} className="text-gray-300" />
              <p className="text-sm text-gray-500">Suche nicht verfuegbar</p>
              <p className="text-xs text-gray-400">Bitte versuche es spaeter erneut</p>
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Search size={24} className="text-gray-300" />
              <p className="text-sm text-gray-500">Keine Produkte gefunden</p>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <ul className="divide-y divide-gray-50">
              {suggestions.map((suggestion, idx) => (
                <li key={idx}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{suggestion.value}</p>
                      {suggestion.asin && (
                        <p className="text-xs text-gray-400 mt-0.5">ASIN: {suggestion.asin}</p>
                      )}
                    </div>
                    {suggestion.asin ? (
                      <button
                        onClick={() => handleSelect(suggestion)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all"
                      >
                        Auswaehlen
                      </button>
                    ) : (
                      <span className="flex-shrink-0 text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">
                        Kein ASIN
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Produkte werden auf Amazon.de gesucht. Ausgewaehlte Artikel koennen in den Warenkorb gelegt werden.
          </p>
        </div>
      </div>
    </div>
  );
}
