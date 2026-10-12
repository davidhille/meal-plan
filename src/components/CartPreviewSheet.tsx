import { useMemo, useState } from 'react';
import { X, Loader2, Check, ShoppingCart, ChevronDown, ImageOff } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { CartItem, ShoppingItem } from '../types';

interface CartPreviewSheetProps {
  /** Offene, mit einem Produkt verknüpfte Artikel dieser Liste */
  items: ShoppingItem[];
  /** Aktueller Knuspr-Warenkorb (null = konnte nicht geladen werden) */
  cart: CartItem[] | null;
  cartLoading: boolean;
  /** Ausgewählte Produkte übertragen; liefert die Meldung */
  onTransfer: (productIds: string[]) => Promise<string>;
  onClose: () => void;
}

/** Vorschau vor dem Übertragen: was kommt in den Warenkorb, was liegt dort schon */
export default function CartPreviewSheet({ items, cart, cartLoading, onTransfer, onClose }: CartPreviewSheetProps) {
  const dialogRef = useDialog(onClose);
  const inCart = useMemo(() => new Map((cart ?? []).map((c) => [c.productId, c])), [cart]);
  // Was schon im Warenkorb liegt, ist zunächst abgewählt
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => !inCart.has(i.productId!)).map((i) => i.id))
  );
  const [showCart, setShowCart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Wenn der Warenkorb erst nach dem Öffnen geladen ist, dort liegende Artikel abwählen
  const [syncedCart, setSyncedCart] = useState(cart);
  if (cart !== syncedCart) {
    setSyncedCart(cart);
    if (cart) setSelected((prev) => new Set([...prev].filter((id) => !inCart.has(items.find((i) => i.id === id)?.productId ?? ''))));
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = items.filter((i) => selected.has(i.id));

  const transfer = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await onTransfer(chosen.map((i) => i.productId!)));
    } catch (e) {
      setMessage((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-preview-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <ShoppingCart size={16} className="text-green-700" aria-hidden="true" />
          <h2 id="cart-preview-title" className="flex-1 text-base font-semibold text-gray-900">
            In den Knuspr-Warenkorb
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="px-4 pt-3 pb-1 text-xs text-gray-500">
            Wähle, was übertragen wird. Artikel, die schon im Warenkorb liegen, sind abgewählt.
          </p>
          <ul className="divide-y divide-gray-100">
            {items.map((i) => {
              const already = inCart.get(i.productId!);
              const on = selected.has(i.id);
              return (
                <li key={i.id}>
                  <button
                    onClick={() => toggle(i.id)}
                    role="checkbox"
                    aria-checked={on}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                  >
                    <span
                      className={`w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center border-2 ${
                        on ? 'bg-green-600 border-green-500' : 'bg-white border-gray-300'
                      }`}
                    >
                      {on && <Check size={14} className="text-white" strokeWidth={3} />}
                    </span>
                    {i.productImage ? (
                      <img src={i.productImage} alt="" className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageOff size={14} className="text-gray-300" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{i.productName ?? i.name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">für: {i.name}</span>
                      {already && (
                        <span className="block text-[11px] font-medium text-amber-700">Schon im Warenkorb ({already.quantity}×)</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Was schon im Warenkorb liegt */}
          <div className="px-4 py-3 border-t border-gray-100">
            {cartLoading ? (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" /> Warenkorb wird geladen …
              </p>
            ) : cart === null ? (
              <p className="text-xs text-gray-500">Der aktuelle Warenkorb konnte nicht geladen werden.</p>
            ) : (
              <>
                <button
                  onClick={() => setShowCart((v) => !v)}
                  aria-expanded={showCart}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-700"
                >
                  <ChevronDown size={14} className={`transition-transform ${showCart ? 'rotate-180' : ''}`} />
                  Aktuell im Knuspr-Warenkorb: {cart.length} Artikel
                </button>
                {showCart && cart.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {cart.map((c) => (
                      <li key={c.productId} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-6 text-right font-semibold text-gray-700">{c.quantity}×</span>
                        <span className="flex-1 min-w-0 truncate">{c.name}</span>
                        {c.price && <span className="text-gray-500">{c.price}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {message && (
            <p role="status" className="text-xs text-center text-gray-700">
              {message}
            </p>
          )}
          <button
            onClick={transfer}
            disabled={!chosen.length || busy}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
            {chosen.length ? `${chosen.length} Artikel übertragen` : 'Nichts ausgewählt'}
          </button>
        </div>
      </div>
    </div>
  );
}
