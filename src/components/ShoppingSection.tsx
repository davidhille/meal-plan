import { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ShoppingBag, ChevronDown, X, Tag } from 'lucide-react';
import { ShoppingItem, ShoppingLabel } from '../types';

interface ShoppingSectionProps {
  label: ShoppingLabel;
  items: ShoppingItem[];
  allLabels: ShoppingLabel[];
  onToggle: (id: string) => void;
  onLabelChange: (itemId: string, newLabelId: string) => void;
  onIngredientClick?: (item: ShoppingItem) => void;
  onAddToCart?: () => void;
  onRemove?: (item: ShoppingItem) => void;
  showCopyButton?: boolean;
  showAmazon?: boolean;
}

export default function ShoppingSection({
  label,
  items,
  allLabels,
  onToggle,
  onLabelChange,
  onIngredientClick,
  onAddToCart,
  onRemove,
  showCopyButton = false,
  showAmazon = false,
}: ShoppingSectionProps) {
  const [copied, setCopied] = useState(false);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPickerId(null);
      }
    };
    if (openPickerId) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openPickerId]);

  const handleCopy = useCallback(async () => {
    const unchecked = items.filter((i) => !i.checked).map((i) => i.name);
    if (unchecked.length === 0) return;
    try {
      await navigator.clipboard.writeText(unchecked.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = unchecked.join('\n');
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [items]);

  const uncheckedCount = items.filter((i) => !i.checked).length;
  const linkedCount = items.filter((i) => i.asin).length;
  const otherLabels = allLabels.filter((l) => l.id !== label.id);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-200/70 overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: label.color }}
          />
          <span className="text-sm font-semibold text-gray-800">{label.name}</span>
          {uncheckedCount > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">
              {uncheckedCount}
            </span>
          )}
          {showAmazon && linkedCount > 0 && (
            <span className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {linkedCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showAmazon && onAddToCart && linkedCount > 0 && (
            <button
              onClick={onAddToCart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all"
            >
              <ShoppingBag size={13} />
              Warenkorb ({linkedCount})
            </button>
          )}
          {showCopyButton && (
            <button
              onClick={handleCopy}
              disabled={uncheckedCount === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : uncheckedCount === 0
                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
              }`}
            >
              {copied ? <><Check size={13} /> Kopiert!</> : <><Copy size={13} /> Kopieren</>}
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Keine Einträge</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => (
            <li key={item.id}>
              <div className="relative flex items-center gap-2 px-4 py-3">
                {/* Checkbox */}
                <button
                  onClick={() => onToggle(item.id)}
                  className={`w-5 h-5 flex-shrink-0 rounded flex items-center justify-center border-2 transition-all duration-200 ${
                    item.checked
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {item.checked && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {/* Name */}
                {showAmazon && onIngredientClick && !item.checked ? (
                  <button
                    onClick={() => onIngredientClick(item)}
                    className="flex-1 text-left text-sm text-gray-700 hover:text-orange-600 transition-colors"
                  >
                    {item.name}
                    {item.isBasic && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">Basics</span>
                    )}
                  </button>
                ) : (
                  <span className={`flex-1 text-sm transition-all duration-200 ${
                    item.checked ? 'line-through text-gray-300' : 'text-gray-700'
                  }`}>
                    {item.name}
                    {item.isBasic && !item.checked && (
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">Basics</span>
                    )}
                  </span>
                )}

                {/* Label picker trigger */}
                <button
                  onClick={() => setOpenPickerId(openPickerId === item.id ? null : item.id)}
                  className="flex-shrink-0 h-6 px-1.5 rounded flex items-center gap-1 text-xs font-medium hover:bg-gray-100 transition-colors"
                  style={{ color: label.color }}
                  title="Liste ändern"
                >
                  <Tag size={12} />
                  <ChevronDown size={10} />
                </button>

                {/* Amazon ASIN indicator */}
                {item.asin && (
                  <a
                    href={`https://www.amazon.de/dp/${item.asin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded bg-orange-100 text-orange-500 hover:bg-orange-200 transition-colors"
                    title={`Amazon: ${item.productName || item.asin}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  </a>
                )}

                {/* Eigene Artikel entfernen */}
                {onRemove && item.id.startsWith('x:') && !item.isBasic && (
                  <button
                    onClick={() => onRemove(item)}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Entfernen"
                  >
                    <X size={12} />
                  </button>
                )}

                {/* Inline label picker dropdown */}
                {openPickerId === item.id && (
                  <div
                    ref={pickerRef}
                    className="absolute right-4 top-full -mt-1 z-30 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40"
                  >
                    {otherLabels.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          onLabelChange(item.id, l.id);
                          setOpenPickerId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
