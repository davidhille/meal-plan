import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, X, Loader2, ShoppingCart } from 'lucide-react';
import { MealPlan, ShoppingItem, ShoppingLabel, DEFAULT_LABELS, LABEL_COLORS, BASICS_ITEMS, ProductResult } from '../types';
import {
  getShopping,
  updateShoppingItem,
  addShoppingItem,
  removeShoppingItem,
  saveProductLink,
  addToKnusprCart,
  createLabel,
  type WeekRange,
  deleteLabel,
  updateLabel,
  addToPantry,
  removeFromPantry,
} from '../lib/api';
import ShoppingSection from './ShoppingSection';
import ProductSearchModal from './ProductSearchModal';

interface ShoppingListViewProps {
  plan: MealPlan | null;
  /** Gewählte Kalenderwoche (nur bei Plänen über mehrere Wochen) */
  week?: WeekRange;
  onCreatePlan: () => void;
}

const lc = (s: string) => s.trim().toLowerCase();

export default function ShoppingListView({ plan, week, onCreatePlan }: ShoppingListViewProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [labels, setLabels] = useState<ShoppingLabel[]>([...DEFAULT_LABELS]);
  const [pantryNeeded, setPantryNeeded] = useState<string[]>([]);
  const [customPantry, setCustomPantry] = useState<string[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [newPantryName, setNewPantryName] = useState('');
  const [showBasics, setShowBasics] = useState(false);
  const [basicPickerTarget, setBasicPickerTarget] = useState<string | null>(null);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[2]);
  const [newItemName, setNewItemName] = useState('');
  const [productItem, setProductItem] = useState<ShoppingItem | null>(null);
  const [standardLabel, setStandardLabel] = useState('knuspr');
  const [notice, setNotice] = useState<string | null>(null);

  const planId = plan?.id;

  const load = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getShopping(planId, week);
    if (data) {
      setItems(data.items);
      setLabels(data.labels);
      setPantryNeeded(data.pantryNeeded);
      setCustomPantry(data.customPantry);
      setStandardLabel(data.standardLabel);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, week?.from]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Artikel ---

  const patchLocal = (id: string, change: Partial<ShoppingItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));

  const toggleItem = async (id: string) => {
    if (!planId) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    // Abgehakte Basics wandern zurück in den Vorrat
    if (item.isBasic && !item.checked) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      await removeShoppingItem(planId, id);
      return;
    }
    patchLocal(id, { checked: !item.checked });
    const ok = await updateShoppingItem(planId, item, { checked: !item.checked });
    if (!ok) patchLocal(id, { checked: item.checked });
  };

  const changeLabel = async (id: string, label: string) => {
    if (!planId) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    patchLocal(id, { label });
    const ok = await updateShoppingItem(planId, item, { label });
    if (!ok) patchLocal(id, { label: item.label });
  };

  const addItem = async (name: string, label: string, isBasic = false) => {
    if (!planId || !name.trim()) return;
    const data = await addShoppingItem(planId, name.trim(), label, isBasic, week);
    if (data) setItems(data.items);
  };

  const removeItem = async (item: ShoppingItem) => {
    if (!planId) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await removeShoppingItem(planId, item.id);
  };

  // --- Labels ---

  const addLabel = async () => {
    if (!newLabelName.trim()) return;
    const next = editingLabelId
      ? await updateLabel(editingLabelId, newLabelName.trim(), newLabelColor)
      : await createLabel(newLabelName.trim(), newLabelColor);
    if (next) setLabels(next);
    setNewLabelName('');
    setEditingLabelId(null);
    setShowAddLabel(false);
  };

  const startEditLabel = (label: ShoppingLabel) => {
    setEditingLabelId(label.id);
    setNewLabelName(label.name);
    setNewLabelColor(label.color);
    setShowAddLabel(true);
  };

  // --- Vorrat ---

  const moveToPantry = async (item: ShoppingItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (await addToPantry(item.baseName)) await load();
  };

  const takeFromPantry = async (name: string) => {
    setCustomPantry((prev) => prev.filter((n) => n !== name));
    if (await removeFromPantry(name)) await load();
  };

  const removeLabel = async (labelId: string) => {
    const next = await deleteLabel(labelId);
    if (next) {
      setLabels(next);
      await load();
    }
  };

  // --- Shops ---

  const productLabel = productItem ? labels.find((l) => l.id === productItem.label) : undefined;

  const handleProductSelect = async (product: ProductResult) => {
    if (!productItem || !productLabel?.provider) return;
    const base = lc(productItem.baseName);
    const labelId = productItem.label;
    setItems((prev) =>
      prev.map((i) =>
        lc(i.baseName) === base && i.label === labelId
          ? { ...i, productId: product.productId, productName: product.name, productImage: product.imageUrl }
          : i
      )
    );
    await saveProductLink(productItem.baseName, productLabel.provider, product);
    setProductItem(null);
  };

  const handleAddToCart = async (labelId: string) => {
    const ids = items.filter((i) => i.label === labelId && i.productId && !i.checked).map((i) => i.productId!);
    if (ids.length === 0) return;
    try {
      const result = await addToKnusprCart(ids);
      setNotice(
        result.failed.length
          ? `${result.added} Artikel im Knuspr-Warenkorb, ${result.failed.length} fehlgeschlagen.`
          : `${result.added} Artikel liegen jetzt in deinem Knuspr-Warenkorb.`
      );
    } catch (e) {
      setNotice((e as Error).message === 'not_connected' ? 'Knuspr ist nicht verbunden – bitte im Profil verbinden.' : (e as Error).message);
    }
    setTimeout(() => setNotice(null), 6000);
  };

  // --- Ansicht ---

  if (!plan) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-center gap-3">
        <ShoppingCart size={32} className="text-gray-300" />
        <p className="text-sm text-gray-500">Noch kein Plan vorhanden.</p>
        <p className="text-xs text-gray-400">Die Einkaufsliste entsteht automatisch aus deinem Speiseplan.</p>
        <button
          onClick={onCreatePlan}
          className="mt-3 px-6 h-11 rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600"
        >
          Plan erstellen
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-12 flex justify-center">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const onListBasics = new Set(items.filter((i) => i.isBasic).map((i) => lc(i.name)));
  const neededSet = new Set(pantryNeeded.map(lc));
  const availableBasics = [
    ...pantryNeeded.filter((b) => !BASICS_ITEMS.some((x) => lc(x) === lc(b))),
    ...BASICS_ITEMS,
  ].filter((b) => !onListBasics.has(lc(b)));
  // Benötigte Basics zuerst
  availableBasics.sort((a, b) => Number(neededSet.has(lc(b))) - Number(neededSet.has(lc(a))));

  const itemsByLabel = labels.reduce<Record<string, ShoppingItem[]>>((acc, label) => {
    acc[label.id] = items
      .filter((i) => i.label === label.id)
      .sort((a, b) => Number(a.checked) - Number(b.checked));
    return acc;
  }, {});

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {/* Eigenen Artikel hinzufügen */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = newItemName;
            setNewItemName('');
            await addItem(name, standardLabel);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Artikel hinzufügen, z. B. Klopapier"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            aria-label="Hinzufügen"
            className="w-10 flex items-center justify-center rounded-xl bg-green-500 text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            <Plus size={16} />
          </button>
        </form>

        {/* Listen je Label */}
        {labels.map((label) => (
          <ShoppingSection
            key={label.id}
            label={label}
            items={itemsByLabel[label.id] || []}
            allLabels={labels}
            onToggle={toggleItem}
            onLabelChange={changeLabel}
            onFindProduct={setProductItem}
            onAddToCart={() => handleAddToCart(label.id)}
            onRemove={removeItem}
            onMoveToPantry={moveToPantry}
          />
        ))}

        {/* Eigenes Label */}
        {showAddLabel ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{editingLabelId ? 'Liste bearbeiten' : 'Neue Liste'}</span>
              <button
                onClick={() => {
                  setShowAddLabel(false);
                  setEditingLabelId(null);
                  setNewLabelName('');
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                placeholder="z. B. Aldi, Rewe, DM …"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-400"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      newLabelColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={addLabel}
                disabled={!newLabelName.trim()}
                className="w-full py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
              >
                {editingLabelId ? 'Speichern' : 'Liste hinzufügen'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddLabel(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            <Plus size={16} />
            Liste hinzufügen
          </button>
        )}

        {/* Eigene Labels verwalten */}
        {labels.some((l) => !l.provider && !DEFAULT_LABELS.some((d) => d.id === l.id)) && (
          <div className="flex flex-wrap gap-2 px-1">
            {labels
              .filter((l) => !l.provider && !DEFAULT_LABELS.some((d) => d.id === l.id))
              .map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                >
                  <button onClick={() => startEditLabel(l)} title="Liste bearbeiten" className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </button>
                  <button
                    onClick={() => removeLabel(l.id)}
                    title="Liste löschen (Artikel wandern zu Knuspr)"
                    className="w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
          </div>
        )}

        {/* Basics & Vorrat */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowBasics(!showBasics)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50"
          >
            <div className="flex items-center gap-2">
              <Package size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">Basics & Vorrat</span>
              {pantryNeeded.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pantryNeeded.length} im Plan
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showBasics ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBasics && (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-3">
                Vorrat steht nicht automatisch auf der Liste. Gelb markiert: wird diese Woche gebraucht. Tippen, um
                es auf eine Liste zu setzen, falls es ausgeht.
              </p>
              <div className="flex flex-wrap gap-2">
                {availableBasics.map((basic) => {
                  const needed = neededSet.has(lc(basic));
                  return (
                    <div key={basic} className="relative">
                      <button
                        onClick={() => setBasicPickerTarget(basicPickerTarget === basic ? null : basic)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium active:scale-95 transition-all ${
                          needed
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                      >
                        + {basic}
                      </button>
                      {basicPickerTarget === basic && (
                        <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                          {labels.map((l) => (
                            <button
                              key={l.id}
                              onClick={async () => {
                                setBasicPickerTarget(null);
                                await addItem(basic, l.id, true);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                              {l.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {availableBasics.length === 0 && (
                  <p className="text-xs text-gray-400">Alle Basics sind bereits auf einer Liste.</p>
                )}
              </div>

              {/* Eigener Vorrat */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">Haben wir immer da</p>
                {customPantry.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {customPantry.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-amber-50 text-xs text-amber-900">
                        {name}
                        <button
                          onClick={() => takeFromPantry(name)}
                          title="Wieder auf die Einkaufsliste"
                          className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-amber-100"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">
                    Tippe bei einer Zutat auf das Kisten-Symbol, damit sie nicht mehr auf der Liste landet.
                  </p>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = newPantryName.trim();
                    if (!name) return;
                    setNewPantryName('');
                    if (await addToPantry(name)) await load();
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={newPantryName}
                    onChange={(e) => setNewPantryName(e.target.value)}
                    placeholder="z. B. Reis, Nudeln, Eier"
                    className="flex-1 h-9 px-3 rounded-xl border border-gray-200 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!newPantryName.trim()}
                    className="px-3 h-9 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 disabled:text-gray-300"
                  >
                    Hinzufügen
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {productItem && productLabel && (productLabel.provider === 'knuspr' || productLabel.provider === 'picnic') && (
        <ProductSearchModal
          ingredientName={productItem.baseName}
          label={productLabel}
          provider={productLabel.provider}
          currentProductId={productItem.productId}
          onSelect={handleProductSelect}
          onClose={() => setProductItem(null)}
        />
      )}

      {notice && (
        <div className="fixed bottom-24 inset-x-4 z-40 max-w-md mx-auto px-4 py-3 rounded-2xl bg-gray-800 text-white text-sm shadow-lg">
          {notice}
        </div>
      )}
    </>
  );
}
