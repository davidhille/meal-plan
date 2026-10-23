import { useMemo, useState } from 'react';
import { X, Loader2, Check, ShoppingCart, ImageOff, Minus, Plus, Trash2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { CartItem, ShopRule, ShoppingItem } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { packagesNeeded } from '../lib/unitPrice';

interface CartPreviewSheetProps {
  /** Name des Shops (Knuspr, Picnic) */
  shopName: string;
  /** Offene, mit einem Produkt verknüpfte Artikel dieser Liste */
  items: ShoppingItem[];
  /** Aktueller Warenkorb (null = konnte nicht geladen werden) */
  cart: CartItem[] | null;
  /** Summe des Warenkorbs laut Shop (null = unbekannt) */
  cartTotal?: number | null;
  /** Mindestbestellwert und Liefergebühr */
  rule?: ShopRule;
  cartLoading: boolean;
  /** Ausgewählte Produkte mit Menge übertragen; liefert die Meldung */
  onTransfer: (items: { productId: string; quantity: number }[]) => Promise<string>;
  /** Menge im Warenkorb ändern (0 = entfernen); wirft bei Fehlern */
  onSetQuantity: (productId: string, quantity: number) => Promise<void>;
  /** Warenkorb leeren; wirft bei Fehlern */
  onClearCart: () => Promise<void>;
  onClose: () => void;
}

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** Fortschritt bis zum Mindestbestellwert */
function MinOrderBar({ current, added, unknown, rule }: { current: number; added: number; unknown: number; rule: ShopRule }) {
  const total = current + added;
  const missing = Math.max(0, rule.minOrder - total);
  const pct = rule.minOrder > 0 ? Math.min(100, (total / rule.minOrder) * 100) : 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-gray-600">
          {added > 0 ? (
            <>
              {euro(current)} + ca. {euro(added)} = <strong className="text-gray-900">ca. {euro(total)}</strong>
            </>
          ) : (
            <>
              Im Warenkorb: <strong className="text-gray-900">{euro(current)}</strong>
            </>
          )}
        </span>
        <span className="text-gray-500 whitespace-nowrap">Mindestens {euro(rule.minOrder)}</span>
      </div>
      <div
        className="h-2 rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-label="Fortschritt bis zum Mindestbestellwert"
        aria-valuemin={0}
        aria-valuemax={rule.minOrder}
        aria-valuenow={Math.round(total * 100) / 100}
      >
        <div className={`h-full rounded-full ${missing ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs font-medium ${missing ? 'text-amber-800' : 'text-brand-800'}`}>
        {missing ? `Noch ${euro(missing)} bis zum Mindestbestellwert` : '✓ Mindestbestellwert erreicht'}
        {rule.deliveryFee > 0 && <span className="font-normal text-gray-600"> · Liefergebühr {euro(rule.deliveryFee)}</span>}
      </p>
      {unknown > 0 && (
        <p className="text-[11px] text-gray-500">
          Für {unknown} {unknown === 1 ? 'Produkt' : 'Produkte'} ist kein Preis bekannt – nochmal im Produkt-Dialog auswählen, dann wird er gemerkt.
        </p>
      )}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label={`Menge ${label}`}>
      <button
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`${label}: weniger`}
        className="tap w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:text-gray-300"
      >
        <Minus size={12} />
      </button>
      <span className="w-6 text-center text-sm font-semibold text-gray-800" aria-live="polite">
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= 50}
        aria-label={`${label}: mehr`}
        className="tap w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:text-gray-300"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

/** Vorschau vor dem Übertragen und Bearbeiten des Warenkorbs (Knuspr oder Picnic) */
export default function CartPreviewSheet({
  shopName,
  items,
  cart,
  cartTotal = null,
  rule,
  cartLoading,
  onTransfer,
  onSetQuantity,
  onClearCart,
  onClose,
}: CartPreviewSheetProps) {
  const dialogRef = useDialog(onClose);
  const inCart = useMemo(() => new Map((cart ?? []).map((c) => [c.productId, c])), [cart]);
  // Was schon im Warenkorb liegt, ist zunächst abgewählt
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => !inCart.has(i.productId!)).map((i) => i.id))
  );
  const [qty, setQty] = useState<Record<string, number>>({});
  // Vorschlag: so viele Packungen, wie das Rezept braucht
  const qtyOf = (i: ShoppingItem) => qty[i.id] ?? Math.min(packagesNeeded(i.name, i.productAmount), 50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cartBusyId, setCartBusyId] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Wenn der Warenkorb erst nach dem Öffnen geladen ist, dort liegende Artikel abwählen
  const [syncedCart, setSyncedCart] = useState(cart);
  if (cart !== syncedCart) {
    const firstLoad = syncedCart === null && cart !== null;
    setSyncedCart(cart);
    if (firstLoad) setSelected((prev) => new Set([...prev].filter((id) => !inCart.has(items.find((i) => i.id === id)?.productId ?? ''))));
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = items.filter((i) => selected.has(i.id));
  const totalPieces = chosen.reduce((sum, i) => sum + (qtyOf(i)), 0);
  const addedPrice = chosen.reduce((sum, i) => sum + (i.productPrice ?? 0) * (qtyOf(i)), 0);
  const unknownPrices = chosen.filter((i) => i.productPrice == null).length;
  const currentTotal = cartTotal ?? (cart ?? []).reduce((sum, c) => sum + (c.lineTotal ?? 0), 0);

  const transfer = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await onTransfer(chosen.map((i) => ({ productId: i.productId!, quantity: qtyOf(i) }))));
      setSelected(new Set());
    } catch (e) {
      setMessage((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const changeCart = async (productId: string, quantity: number) => {
    setCartBusyId(productId);
    setCartError(null);
    try {
      await onSetQuantity(productId, quantity);
    } catch (e) {
      setCartError((e as Error).message || 'Die Änderung hat nicht geklappt.');
    } finally {
      setCartBusyId(null);
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
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <ShoppingCart size={16} className="text-brand-700" aria-hidden="true" />
          <h2 id="cart-preview-title" className="flex-1 text-base font-semibold text-gray-900">
            {shopName}-Warenkorb
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Neu hinzufügen */}
          <h3 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Hinzufügen</h3>
          <p className="px-4 pb-1 text-xs text-gray-500">Abgehakt wird übertragen. Was schon im Warenkorb liegt, ist abgewählt.</p>
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Gerade ist nichts mit {shopName}-Produkt bei {shopName} eingeplant.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((i) => {
                const already = inCart.get(i.productId!);
                const on = selected.has(i.id);
                const name = i.productName ?? i.name;
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      onClick={() => toggle(i.id)}
                      role="checkbox"
                      aria-checked={on}
                      aria-label={name}
                      className={`tap w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center border-2 ${
                        on ? 'bg-brand-600 border-brand-500' : 'bg-white border-gray-300'
                      }`}
                    >
                      {on && <Check size={14} className="text-white" strokeWidth={3} />}
                    </button>
                    {i.productImage ? (
                      <img src={i.productImage} alt="" className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-100 flex-shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageOff size={14} className="text-gray-300" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">für: {i.name}</span>
                      {i.productPrice != null && (
                        <span className="block text-[11px] text-gray-600">
                          ca. {euro(i.productPrice)}
                          {i.productAmount ? ` · ${i.productAmount}` : ''}
                        </span>
                      )}
                      {already && (
                        <span className="block text-[11px] font-medium text-amber-700">Schon im Warenkorb ({already.quantity}×)</span>
                      )}
                    </span>
                    {on && (
                      <Stepper
                        value={qtyOf(i)}
                        min={1}
                        label={name}
                        onChange={(v) => setQty((prev) => ({ ...prev, [i.id]: v }))}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Aktueller Warenkorb */}
          <div className="mt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 px-4 pt-3">
              <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Im Warenkorb{cart && cart.length ? ` (${cart.length})` : ''}
              </h3>
              {cart && cart.length > 0 && (
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={!!cartBusyId}
                  className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100"
                >
                  <Trash2 size={12} /> Leeren
                </button>
              )}
            </div>
            {cartLoading ? (
              <p className="flex items-center gap-2 px-4 py-3 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" /> Warenkorb wird geladen …
              </p>
            ) : cart === null ? (
              <p className="px-4 py-3 text-xs text-gray-500">Der Warenkorb konnte nicht geladen werden.</p>
            ) : cart.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500">Der Warenkorb ist leer.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {cart.map((c) => (
                  <li key={c.productId} className={`flex items-center gap-2 px-4 py-2 ${cartBusyId === c.productId ? 'opacity-60' : ''}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 truncate">{c.name}</span>
                      {(c.lineTotal != null || c.price) && (
                        <span className="block text-[11px] text-gray-500">
                          {c.lineTotal != null ? euro(c.lineTotal) : c.price}
                          {c.quantity > 1 && c.price ? ` (${c.quantity} × ${c.price})` : ''}
                        </span>
                      )}
                    </span>
                    {cartBusyId === c.productId && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    <Stepper
                      value={c.quantity}
                      min={1}
                      label={c.name}
                      disabled={!!cartBusyId}
                      onChange={(v) => changeCart(c.productId, v)}
                    />
                    <button
                      onClick={() => changeCart(c.productId, 0)}
                      disabled={!!cartBusyId}
                      aria-label={`${c.name} aus dem Warenkorb entfernen`}
                      className="tap w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cartError && (
              <p role="alert" className="px-4 pb-2 text-xs text-red-600">
                {cartError}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {rule && cart !== null && !cartLoading && (
            <MinOrderBar current={currentTotal} added={addedPrice} unknown={unknownPrices} rule={rule} />
          )}
          {message && (
            <p role="status" className="text-xs text-center text-gray-700">
              {message}
            </p>
          )}
          <button
            onClick={transfer}
            disabled={!chosen.length || busy}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
            {chosen.length
              ? `${chosen.length} ${chosen.length === 1 ? 'Produkt' : 'Produkte'}${totalPieces > chosen.length ? ` (${totalPieces} Stück)` : ''} übertragen`
              : 'Nichts zum Übertragen ausgewählt'}
          </button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Warenkorb leeren?"
          message={<>Alle {cart?.length ?? 0} Artikel werden aus deinem {shopName}-Warenkorb entfernt – auch die, die du direkt bei {shopName} hineingelegt hast.</>}
          confirmLabel="Leeren"
          danger
          onConfirm={onClearCart}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
