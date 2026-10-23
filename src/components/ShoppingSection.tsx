import { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check, ShoppingCart, ChevronDown, X, Tag, Link2, Package, FileDown } from 'lucide-react';
import { ShopProvider, ShoppingItem, ShoppingLabel } from '../types';
import { packagesNeeded } from '../lib/unitPrice';

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

interface ShoppingSectionProps {
  label: ShoppingLabel;
  items: ShoppingItem[];
  allLabels: ShoppingLabel[];
  onToggle: (id: string) => void;
  onLabelChange: (itemId: string, newLabelId: string) => void;
  /** Knuspr/Picnic: Produktsuche öffnen (optional für einen bestimmten Shop) */
  onFindProduct?: (item: ShoppingItem, provider?: ShopProvider) => void;
  /** Liegt das gewählte Produkt schon im Warenkorb seines Shops? */
  isInCart?: (item: ShoppingItem) => boolean;
  /** Gemeinsame Lieferdienst-Liste: pro Artikel den Shop wählen */
  deliveryShops?: { provider: ShopProvider; label: ShoppingLabel }[];
  onAssignShop?: (item: ShoppingItem, provider: ShopProvider) => void;
  onRemove?: (item: ShoppingItem) => void;
  /** Plan-Zutat dauerhaft in den Vorrat legen */
  onMoveToPantry?: (item: ShoppingItem) => void;
  /** Offene Einträge als PDF herunterladen (nur Listen ohne Shop) */
  onDownloadPdf?: () => void;
}

export default function ShoppingSection({
  label,
  items,
  allLabels,
  onToggle,
  onLabelChange,
  onFindProduct,
  isInCart,
  deliveryShops,
  onAssignShop,
  onRemove,
  onMoveToPantry,
  onDownloadPdf,
}: ShoppingSectionProps) {
  const [copied, setCopied] = useState(false);
  // Auf-/zugeklappt pro Liste auf diesem Gerät merken
  const storageKey = `liste-offen-${label.id}`;
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== '0';
    } catch {
      return true;
    }
  });
  const toggleExpanded = () =>
    setExpanded((v) => {
      try {
        localStorage.setItem(storageKey, v ? '0' : '1');
      } catch {
        // dann nur bis zum Neuladen
      }
      return !v;
    });
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
  const done = items.filter((i) => i.checked);
  const [showDone, setShowDone] = useState(false);
  const shopLabelIds = new Set((deliveryShops ?? []).map((s) => s.label.id));
  const otherLabels = allLabels.filter((l) => l.id !== label.id && !shopLabelIds.has(l.id));
  const provider = label.provider ?? null;
  const isShopList = !!deliveryShops || provider === 'knuspr' || provider === 'picnic';
  const labelOf = (item: ShoppingItem) => allLabels.find((l) => l.id === item.label) ?? label;

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

  const renderItem = (item: ShoppingItem) => {
            const nameClass = `text-sm leading-snug ${item.checked ? 'line-through text-gray-500' : 'text-gray-700'}`;
            const nameContent = (
              <>
                {item.name}
                {item.isBasic && !item.checked && <span className="ml-1.5 text-[11px] text-gray-500">Vorrat</span>}
                {item.productName && !item.checked && (
                  <span className="block text-[11px] text-gray-500 truncate">→ {item.productName}</span>
                )}
                {item.productId && !item.checked && isInCart?.(item) && (
                  <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50 text-brand-800">
                    <ShoppingCart size={10} aria-hidden="true" /> im Warenkorb
                  </span>
                )}
              </>
            );
            return (
              <li key={item.id} className="relative flex flex-wrap items-center gap-x-3 px-4 py-3">
                <button
                  onClick={() => onToggle(item.id)}
                  role="checkbox"
                  aria-checked={item.checked}
                  aria-label={item.name}
                  className={`tap w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center border-2 transition-colors ${
                    item.checked ? 'bg-brand-600 border-brand-500' : 'bg-white border-gray-300'
                  }`}
                >
                  {item.checked && <Check size={14} className="text-white" strokeWidth={3} />}
                </button>

                {item.productImage && !item.checked && (
                  <img src={item.productImage} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                )}

                {/* Name: bei Knuspr/Picnic öffnet ein Tipp die Produktsuche */}
                {!item.checked && isShopList && onFindProduct ? (
                  <button onClick={() => onFindProduct(item)} className={`flex-1 min-w-0 text-left ${nameClass} hover:text-brand-800`}>
                    {nameContent}
                  </button>
                ) : (
                  <span className={`flex-1 min-w-0 ${nameClass}`}>{nameContent}</span>
                )}

                {!item.checked && isShopList && !deliveryShops && onFindProduct && !item.productId && (
                  <button
                    onClick={() => onFindProduct(item)}
                    title="Produkt auswählen"
                    aria-label={`${item.baseName}: Produkt auswählen`}
                    className="tap w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:text-brand-700 hover:bg-brand-50"
                  >
                    <Link2 size={14} />
                  </button>
                )}

                <button
                  onClick={() => setOpenPickerId(openPickerId === item.id ? null : item.id)}
                  className="flex-shrink-0 h-7 px-1.5 rounded-lg flex items-center gap-0.5 hover:bg-gray-100"
                  style={{ color: deliveryShops ? "#A396A7" : labelOf(item).color }}
                  title="Liste ändern"
                  aria-label={`${item.baseName}: Liste ändern`}
                  aria-haspopup="menu"
                  aria-expanded={openPickerId === item.id}
                >
                  <Tag size={13} />
                  <ChevronDown size={10} />
                </button>

                {onMoveToPantry && item.id.startsWith('p:') && !item.checked && (
                  <button
                    onClick={() => onMoveToPantry(item)}
                    title="Haben wir immer da – in den Vorrat legen"
                    aria-label={`${item.baseName}: haben wir immer da`}
                    className="tap flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-amber-700 hover:bg-amber-50"
                  >
                    <Package size={13} />
                  </button>
                )}

                {onRemove && item.id.startsWith('x:') && !item.isBasic && (
                  <button
                    onClick={() => onRemove(item)}
                    title="Entfernen"
                    aria-label={`${item.name} entfernen`}
                    className="tap flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50"
                  >
                    <X size={13} />
                  </button>
                )}

                {openPickerId === item.id && (
                  <div
                    ref={pickerRef}
                    role="menu"
                    className="absolute right-4 top-full -mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44"
                  >
                    {otherLabels.map((l) => (
                      <button
                        key={l.id}
                        role="menuitem"
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

                {deliveryShops && !item.checked && (
                  <ShopChips
                    item={item}
                    shops={deliveryShops}
                    onAssign={(p) => onAssignShop?.(item, p)}
                    onChoose={(p) => onFindProduct?.(item, p)}
                  />
                )}
              </li>
            );
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Kopf */}
      <div className={`flex items-center justify-between gap-2 pl-2 pr-4 py-2 ${expanded ? 'border-b border-gray-100' : ''}`}>
        <button
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-label={`${label.name}: ${expanded ? 'zuklappen' : 'aufklappen'}`}
          className="flex items-center gap-2 min-w-0 flex-1 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50"
        >
          <ChevronDown
            size={15}
            className={`flex-shrink-0 text-gray-400 transition-transform ${expanded ? '' : '-rotate-90'}`}
            aria-hidden="true"
          />
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
          <h2 className="text-sm font-semibold text-gray-800 truncate">{label.name}</h2>
          {open.length > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">{open.length}</span>
          )}
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              disabled={open.length === 0}
              title="Offene Einträge als PDF"
              aria-label={`${label.name}: offene Einträge als PDF herunterladen`}
              className={`tap flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                open.length === 0 ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FileDown size={14} />
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={open.length === 0}
            title="Offene Einträge als Text kopieren"
            aria-label={copied ? `${label.name}: kopiert` : `${label.name}: offene Einträge kopieren`}
            className={`tap flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              copied
                ? 'bg-brand-100 text-brand-700'
                : open.length === 0
                ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {!expanded ? null : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-500">Keine Einträge</div>
      ) : (
        <>
          {open.length > 0 && <ul className="divide-y divide-gray-100">{open.map(renderItem)}</ul>}
          {open.length === 0 && (
            <p className="flex items-center justify-center gap-1.5 px-4 py-4 text-sm font-medium text-brand-800">
              <Check size={15} aria-hidden="true" /> Alles erledigt
            </p>
          )}
          {/* Abgehakte Einträge zusammengeklappt unten – die offenen bleiben im Blick */}
          {done.length > 0 && (
            <div className="border-t border-gray-100">
              <button
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 rounded-b-xl"
              >
                <ChevronDown size={14} className={`transition-transform ${showDone ? '' : '-rotate-90'}`} aria-hidden="true" />
                {done.length} erledigt
              </button>
              {showDone && <ul className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/50">{done.map(renderItem)}</ul>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Preis je Shop als Knopf: antippen = bei diesem Shop bestellen (ohne Produkt: erst auswählen) */
function ShopChips({
  item,
  shops,
  onAssign,
  onChoose,
}: {
  item: ShoppingItem;
  shops: { provider: ShopProvider; label: ShoppingLabel }[];
  onAssign: (provider: ShopProvider) => void;
  onChoose: (provider: ShopProvider) => void;
}) {
  const offers = shops.map(({ provider, label }) => {
    const link = item.links?.[provider];
    const packs = link ? packagesNeeded(item.name, link.productAmount) : 1;
    const total = link?.productPrice != null ? link.productPrice * packs : null;
    return { provider, label, link, packs, total, active: item.label === label.id };
  });
  const priced = offers.filter((o) => o.total != null);
  const cheapest =
    priced.length > 1 ? priced.reduce((m, o) => (o.total! < m.total! ? o : m)) : null;
  const tie = cheapest && priced.every((o) => Math.abs(o.total! - cheapest.total!) < 0.005);

  return (
    <div className="w-full flex flex-wrap gap-1.5 mt-2 pl-9" role="group" aria-label={`${item.baseName}: Shop wählen`}>
      {offers.map((o) => {
        const isCheapest = !!cheapest && !tie && o === cheapest;
        const text = !o.link
          ? 'Produkt wählen'
          : o.total != null
          ? `${o.packs > 1 ? `${o.packs}× ` : ''}${euro(o.total)}`
          : 'Preis ?';
        return (
          <button
            key={o.provider}
            onClick={() => (o.link && !o.active ? onAssign(o.provider) : onChoose(o.provider))}
            aria-pressed={o.active}
            aria-label={
              o.active
                ? `${o.label.name}: ${text} – gewählt, antippen für anderes Produkt`
                : o.link
                ? `Bei ${o.label.name} bestellen: ${text}${isCheapest ? ', günstiger' : ''}`
                : `${o.label.name}: Produkt wählen`
            }
            className={`inline-flex items-center gap-1 h-8 px-3 rounded-full border text-xs font-bold transition-colors ${
              o.active
                ? 'bg-brand-700 border-brand-700 text-white'
                : isCheapest
                ? 'bg-coral-50 border-coral-500 text-coral-700 hover:bg-coral-100'
                : o.link
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'bg-white border-dashed border-gray-300 text-gray-500 font-semibold hover:bg-gray-50'
            }`}
          >
            {o.active && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            <span>{o.label.name}</span>
            <span aria-hidden="true">·</span>
            <span>{text}</span>
            {isCheapest && <span aria-hidden="true">↓</span>}
          </button>
        );
      })}
    </div>
  );
}
