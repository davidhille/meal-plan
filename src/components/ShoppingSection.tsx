import { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ShoppingCart, ChevronDown, X, Tag, ExternalLink, Link2, Loader2, Package } from 'lucide-react';
import { ShoppingItem, ShoppingLabel } from '../types';
import { buildAmazonSearchUrl } from '../lib/amazon';

interface ShoppingSectionProps {
  label: ShoppingLabel;
  items: ShoppingItem[];
  allLabels: ShoppingLabel[];
  onToggle: (id: string) => void;
  onLabelChange: (itemId: string, newLabelId: string) => void;
  /** Knuspr/Picnic: Produktsuche öffnen */
  onFindProduct?: (item: ShoppingItem) => void;
  /** Knuspr: verknüpfte offene Artikel in den Warenkorb */
  onAddToCart?: () => Promise<void>;
  onRemove?: (item: ShoppingItem) => void;
  /** Plan-Zutat dauerhaft in den Vorrat legen */
  onMoveToPantry?: (item: ShoppingItem) => void;
}

export default function ShoppingSection({
  label,
  items,
  allLabels,
  onToggle,
  onLabelChange,
  onFindProduct,
  onAddToCart,
  onRemove,
  onMoveToPantry,
}: ShoppingSectionProps) {
  const [copied, setCopied] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPickerId(null);
    };
    if (openPickerId) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openPickerId]);

  const open = items.filter((i) => !i.checked);
  const linkedOpen = open.filter((i) => i.productId);
  const otherLabels = allLabels.filter((l) => l.id !== label.id);
  const provider = label.provider ?? null;

  const handleCopy = useCallback(async () => {
    const text = open.map((i) => i.name).join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [open]);

  return (
    <section className="bg-white rounded-2xl shadow-card border border-gray-200/70">
      {/* Kopf */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
          <h3 className="text-[15px] font-semibold text-gray-800 truncate">{label.name}</h3>
          {open.length > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{open.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {provider === 'knuspr' && onAddToCart && linkedOpen.length > 0 && (
            <button
              onClick={async () => {
                setCartBusy(true);
                try {
                  await onAddToCart();
                } finally {
                  setCartBusy(false);
                }
              }}
              disabled={cartBusy}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300"
            >
              {cartBusy ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />}
              Warenkorb ({linkedOpen.length})
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={open.length === 0}
            title="Offene Einträge als Text kopieren"
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : open.length === 0
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Keine Einträge</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const nameClass = `text-sm leading-snug ${item.checked ? 'line-through text-gray-300' : 'text-gray-700'}`;
            const nameContent = (
              <>
                {item.name}
                {item.isBasic && !item.checked && <span className="ml-1.5 text-[11px] text-gray-400">Vorrat</span>}
                {item.productName && !item.checked && (
                  <span className="block text-[11px] text-gray-400 truncate">→ {item.productName}</span>
                )}
              </>
            );
            return (
              <li key={item.id} className="relative flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => onToggle(item.id)}
                  aria-label={item.checked ? 'Als offen markieren' : 'Abhaken'}
                  className={`w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center border-2 transition-colors ${
                    item.checked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                  }`}
                >
                  {item.checked && <Check size={14} className="text-white" strokeWidth={3} />}
                </button>

                {item.productImage && !item.checked && (
                  <img src={item.productImage} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                )}

                {/* Name: je nach Shop Amazon-Suche oder Produktsuche */}
                {!item.checked && provider === 'amazon' ? (
                  <a
                    href={buildAmazonSearchUrl(item.baseName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 min-w-0 ${nameClass} hover:text-amber-700`}
                  >
                    {nameContent}
                    <ExternalLink size={11} className="inline ml-1 -mt-0.5 text-gray-400" />
                  </a>
                ) : !item.checked && (provider === 'knuspr' || provider === 'picnic') && onFindProduct ? (
                  <button onClick={() => onFindProduct(item)} className={`flex-1 min-w-0 text-left ${nameClass} hover:text-green-700`}>
                    {nameContent}
                  </button>
                ) : (
                  <span className={`flex-1 min-w-0 ${nameClass}`}>{nameContent}</span>
                )}

                {!item.checked && (provider === 'knuspr' || provider === 'picnic') && onFindProduct && !item.productId && (
                  <button
                    onClick={() => onFindProduct(item)}
                    title="Produkt auswählen"
                    className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50"
                  >
                    <Link2 size={14} />
                  </button>
                )}

                <button
                  onClick={() => setOpenPickerId(openPickerId === item.id ? null : item.id)}
                  className="flex-shrink-0 h-7 px-1.5 rounded-lg flex items-center gap-0.5 hover:bg-gray-100"
                  style={{ color: label.color }}
                  title="Liste ändern"
                >
                  <Tag size={13} />
                  <ChevronDown size={10} />
                </button>

                {onMoveToPantry && item.id.startsWith('p:') && !item.checked && (
                  <button
                    onClick={() => onMoveToPantry(item)}
                    title="Haben wir immer da – in den Vorrat legen"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-amber-700 hover:bg-sand"
                  >
                    <Package size={13} />
                  </button>
                )}

                {onRemove && item.id.startsWith('x:') && !item.isBasic && (
                  <button
                    onClick={() => onRemove(item)}
                    title="Entfernen"
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                  >
                    <X size={13} />
                  </button>
                )}

                {openPickerId === item.id && (
                  <div
                    ref={pickerRef}
                    className="absolute right-4 top-full -mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44"
                  >
                    {otherLabels.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          onLabelChange(item.id, l.id);
                          setOpenPickerId(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
